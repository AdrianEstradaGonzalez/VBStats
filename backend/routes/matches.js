const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { scopeToUser, requireMatchOwner } = require('../middleware/auth');

// Get all matches for the authenticated user
router.get('/', scopeToUser, async (req, res) => {
  try {
    const { status, team_id } = req.query;
    let query = `
      SELECT m.*, t.name as team_name
      FROM matches m
      LEFT JOIN teams t ON m.team_id = t.id
      WHERE m.user_id = ?
    `;
    const params = [req.effectiveUserId];

    if (status) {
      query += ' AND m.status = ?';
      params.push(status);
    }
    if (team_id) {
      query += ' AND m.team_id = ?';
      params.push(team_id);
    }

    query += ' ORDER BY m.date DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Create a new match
router.post('/', scopeToUser, async (req, res) => {
  try {
    const { team_id, opponent, date, location, notes } = req.body;

    const teamId = Number(team_id);
    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    // The match must belong to one of the caller's own teams.
    const [owned] = await pool.query(
      'SELECT id FROM teams WHERE id = ? AND user_id = ?',
      [teamId, req.effectiveUserId]
    );
    if (owned.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Convert ISO date to MySQL DATETIME format
    let mysqlDate = new Date();
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        mysqlDate = parsed;
      }
    }
    const formattedDate = mysqlDate.toISOString().slice(0, 19).replace('T', ' ');

    const [result] = await pool.query(
      `INSERT INTO matches (user_id, team_id, opponent, date, location, status, notes)
       VALUES (?, ?, ?, ?, ?, 'in_progress', ?)`,
      [req.effectiveUserId, teamId, opponent || null, formattedDate, location || 'home', notes || null]
    );

    const [rows] = await pool.query(`
      SELECT m.*, t.name as team_name
      FROM matches m
      LEFT JOIN teams t ON m.team_id = t.id
      WHERE m.id = ?
    `, [result.insertId]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// Get match by share code.
// Intentionally public: this is how free accounts open a report someone shared
// with them. Only matches that have been explicitly given a code are reachable.
router.get('/by-code/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const [matches] = await pool.query(`
      SELECT m.*, t.name as team_name
      FROM matches m
      LEFT JOIN teams t ON m.team_id = t.id
      WHERE m.share_code = ?
    `, [code]);

    if (!matches.length) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(matches[0]);
  } catch (error) {
    console.error('Error fetching match by code:', error);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// Get a single match with full details (owner only)
router.get('/:id', requireMatchOwner('id'), async (req, res) => {
  try {
    const [matches] = await pool.query(`
      SELECT m.*, t.name as team_name
      FROM matches m
      LEFT JOIN teams t ON m.team_id = t.id
      WHERE m.id = ?
    `, [req.match.id]);

    res.json(matches[0]);
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// Generate share code for a match (owner only)
router.post('/:id/generate-code', requireMatchOwner('id'), async (req, res) => {
  try {
    // Reuse the existing code so a link already shared keeps working.
    if (req.match.share_code) {
      return res.json({ share_code: req.match.share_code });
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = null;

    // Bounded retries: the previous unbounded `while` could spin forever if the
    // uniqueness query ever failed to converge.
    for (let attempt = 0; attempt < 10 && !code; attempt++) {
      let candidate = '';
      for (let i = 0; i < 8; i++) {
        candidate += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const [existing] = await pool.query('SELECT id FROM matches WHERE share_code = ?', [candidate]);
      if (existing.length === 0) {
        code = candidate;
      }
    }

    if (!code) {
      return res.status(500).json({ error: 'Failed to generate a unique share code' });
    }

    await pool.query('UPDATE matches SET share_code = ? WHERE id = ?', [code, req.match.id]);

    res.json({ share_code: code });
  } catch (error) {
    console.error('Error generating share code:', error);
    res.status(500).json({ error: 'Failed to generate share code' });
  }
});

// Update match (e.g., finish match, update sets)
router.put('/:id', requireMatchOwner('id'), async (req, res) => {
  try {
    const { status, total_sets, notes, score_home, score_away } = req.body;
    const updates = [];
    const params = [];

    if (status !== undefined) {
      const validStatuses = ['in_progress', 'finished', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.push('status = ?');
      params.push(status);
      if (status === 'finished') {
        updates.push('finished_at = NOW()');
      }
    }
    if (total_sets !== undefined) {
      updates.push('total_sets = ?');
      params.push(total_sets);
    }
    if (score_home !== undefined) {
      updates.push('score_home = ?');
      params.push(score_home);
    }
    if (score_away !== undefined) {
      updates.push('score_away = ?');
      params.push(score_away);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.match.id);

    await pool.query(
      `UPDATE matches SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await pool.query(`
      SELECT m.*, t.name as team_name
      FROM matches m
      LEFT JOIN teams t ON m.team_id = t.id
      WHERE m.id = ?
    `, [req.match.id]);

    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

// Delete a match and all its statistics
router.delete('/:id', requireMatchOwner('id'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query('DELETE FROM match_stats WHERE match_id = ?', [req.match.id]);
    await connection.query('DELETE FROM match_states WHERE match_id = ?', [req.match.id]);
    await connection.query('DELETE FROM matches WHERE id = ?', [req.match.id]);

    await connection.commit();
    console.log(`Deleted match ${req.match.id} and its stats`);
    res.status(204).end();
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting match:', error);
    res.status(500).json({ error: 'Failed to delete match' });
  } finally {
    connection.release();
  }
});

// Get match statistics summary
router.get('/:id/stats', requireMatchOwner('id'), async (req, res) => {
  try {
    const matchId = req.match.id;

    const [stats] = await pool.query(`
      SELECT
        ms.*,
        p.name as player_name,
        p.number as player_number,
        p.position as player_position
      FROM match_stats ms
      JOIN players p ON ms.player_id = p.id
      WHERE ms.match_id = ?
      ORDER BY ms.set_number, ms.created_at
    `, [matchId]);

    const [summary] = await pool.query(`
      SELECT
        ms.player_id,
        p.name as player_name,
        p.number as player_number,
        p.position as player_position,
        ms.stat_category,
        ms.stat_type,
        COUNT(*) as count
      FROM match_stats ms
      JOIN players p ON ms.player_id = p.id
      WHERE ms.match_id = ?
      GROUP BY ms.player_id, ms.stat_category, ms.stat_type
      ORDER BY p.name, ms.stat_category, ms.stat_type
    `, [matchId]);

    const [bySet] = await pool.query(`
      SELECT
        ms.set_number,
        ms.player_id,
        p.name as player_name,
        ms.stat_category,
        ms.stat_type,
        COUNT(*) as count
      FROM match_stats ms
      JOIN players p ON ms.player_id = p.id
      WHERE ms.match_id = ?
      GROUP BY ms.set_number, ms.player_id, ms.stat_category, ms.stat_type
      ORDER BY ms.set_number, p.name
    `, [matchId]);

    res.json({ stats, summary, bySet });
  } catch (error) {
    console.error('Error fetching match stats:', error);
    res.status(500).json({ error: 'Failed to fetch match stats' });
  }
});

// Save match state (for resuming matches)
router.put('/:id/state', requireMatchOwner('id'), async (req, res) => {
  try {
    const matchId = req.match.id;
    const { positions, current_set, is_set_active, action_history, pending_stats } = req.body;

    const stateJson = JSON.stringify({
      positions,
      current_set,
      is_set_active,
      action_history,
      pending_stats
    });

    // Single statement instead of SELECT-then-INSERT/UPDATE: two devices saving at
    // once could both see "no row" and race to insert.
    await pool.query(
      `INSERT INTO match_states (match_id, state_json)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = NOW()`,
      [matchId, stateJson]
    );

    console.log(`Match state saved for match ${matchId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving match state:', error);
    res.status(500).json({ error: 'Failed to save match state' });
  }
});

// Get match state (for resuming matches)
router.get('/:id/state', requireMatchOwner('id'), async (req, res) => {
  try {
    const matchId = req.match.id;

    const [rows] = await pool.query(
      'SELECT state_json FROM match_states WHERE match_id = ?',
      [matchId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'No state found for this match' });
    }

    // MySQL JSON columns are auto-parsed by mysql2, handle both cases
    const stateJson = rows[0].state_json;
    let state;
    try {
      state = typeof stateJson === 'string' ? JSON.parse(stateJson) : stateJson;
    } catch (parseErr) {
      console.error(`Corrupt match state for match ${matchId}:`, parseErr);
      return res.status(404).json({ error: 'No state found for this match' });
    }

    res.json(state);
  } catch (error) {
    console.error('Error fetching match state:', error);
    res.status(500).json({ error: 'Failed to fetch match state' });
  }
});

// Delete match state when match is finished
router.delete('/:id/state', requireMatchOwner('id'), async (req, res) => {
  try {
    await pool.query('DELETE FROM match_states WHERE match_id = ?', [req.match.id]);
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting match state:', error);
    res.status(500).json({ error: 'Failed to delete match state' });
  }
});

module.exports = router;
