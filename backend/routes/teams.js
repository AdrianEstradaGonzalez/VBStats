const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { scopeToUser, requireTeamOwner } = require('../middleware/auth');

// The user id always comes from the authenticated session (req.effectiveUserId),
// never from the query string or body — otherwise any account could read or edit
// another user's teams just by changing a number.

// GET /teams - Obtener todos los equipos del usuario autenticado
router.get('/', scopeToUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM teams WHERE user_id = ? ORDER BY id DESC',
      [req.effectiveUserId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// POST /teams - Crear un nuevo equipo
router.post('/', scopeToUser, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name required' });
    }

    const [result] = await pool.query(
      'INSERT INTO teams (name, user_id) VALUES (?, ?)',
      [String(name).trim(), req.effectiveUserId]
    );

    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating team:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// GET /teams/:id - Obtener un equipo específico
router.get('/:id', requireTeamOwner('id'), async (req, res) => {
  res.json(req.team);
});

// PUT /teams/:id - Actualizar un equipo
router.put('/:id', requireTeamOwner('id'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name required' });
    }

    await pool.query('UPDATE teams SET name = ? WHERE id = ?', [String(name).trim(), req.team.id]);

    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [req.team.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating team:', err);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// DELETE /teams/:id - Eliminar un equipo y sus jugadoras
router.delete('/:id', requireTeamOwner('id'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // players.team_id is ON DELETE SET NULL, so remove them explicitly instead of
    // leaving orphan rows behind.
    await conn.query('DELETE FROM players WHERE team_id = ?', [req.team.id]);
    await conn.query('DELETE FROM teams WHERE id = ?', [req.team.id]);
    await conn.commit();
    res.status(204).end();
  } catch (err) {
    await conn.rollback();
    console.error('Error deleting team:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  } finally {
    conn.release();
  }
});

module.exports = router;
