const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { scopeToUser, requireTeamOwner, requirePlayerOwner } = require('../middleware/auth');

// Every read and write is constrained to teams owned by the caller. Previously
// `GET /players` with no filter returned every player of every account, and
// PUT/DELETE accepted any id.

// GET /players - jugadoras del usuario (opcionalmente filtradas por equipo)
router.get('/', scopeToUser, async (req, res) => {
  try {
    const { team_id } = req.query;

    if (team_id) {
      const teamId = Number(team_id);
      if (!Number.isInteger(teamId) || teamId <= 0) {
        return res.status(400).json({ error: 'Invalid team_id' });
      }
      const [owned] = await pool.query(
        'SELECT id FROM teams WHERE id = ? AND user_id = ?',
        [teamId, req.effectiveUserId]
      );
      if (owned.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }
      const [rows] = await pool.query(
        'SELECT * FROM players WHERE team_id = ? ORDER BY id DESC',
        [teamId]
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      `SELECT p.* FROM players p
       JOIN teams t ON p.team_id = t.id
       WHERE t.user_id = ?
       ORDER BY p.id DESC`,
      [req.effectiveUserId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching players:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// POST /players - crear jugadora en un equipo propio
router.post('/', scopeToUser, async (req, res) => {
  try {
    const { name, team_id, position, number } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name required' });
    }

    const teamId = Number(team_id);
    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'team_id required' });
    }

    const [owned] = await pool.query(
      'SELECT id FROM teams WHERE id = ? AND user_id = ?',
      [teamId, req.effectiveUserId]
    );
    if (owned.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const [result] = await pool.query(
      'INSERT INTO players (name, team_id, position, number) VALUES (?, ?, ?, ?)',
      [String(name).trim(), teamId, position || null, number || null]
    );
    const [rows] = await pool.query('SELECT * FROM players WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating player:', err);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

router.get('/:id', requirePlayerOwner('id'), async (req, res) => {
  res.json(req.player);
});

router.put('/:id', requirePlayerOwner('id'), async (req, res) => {
  try {
    const { name, team_id, position, number } = req.body;

    // Moving a player between teams is only allowed within the caller's own teams.
    let targetTeamId = req.player.team_id;
    if (team_id !== undefined && Number(team_id) !== req.player.team_id) {
      const newTeamId = Number(team_id);
      if (!Number.isInteger(newTeamId) || newTeamId <= 0) {
        return res.status(400).json({ error: 'Invalid team_id' });
      }
      const [owned] = await pool.query(
        'SELECT id FROM teams WHERE id = ? AND user_id = ?',
        [newTeamId, req.auth.userId]
      );
      if (owned.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }
      targetTeamId = newTeamId;
    }

    await pool.query(
      'UPDATE players SET name = ?, team_id = ?, position = ?, number = ? WHERE id = ?',
      [
        name !== undefined ? name : req.player.name,
        targetTeamId,
        position !== undefined ? position : req.player.position,
        number !== undefined ? number : req.player.number,
        req.player.id,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM players WHERE id = ?', [req.player.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating player:', err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

router.delete('/:id', requirePlayerOwner('id'), async (req, res) => {
  try {
    await pool.query('DELETE FROM players WHERE id = ?', [req.player.id]);
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting player:', err);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

module.exports = router;
