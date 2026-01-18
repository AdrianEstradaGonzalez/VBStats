const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all matches (optionally filter by user_id)
router.get('/', async (req, res) => {
  try {
    const { user_id, status, team_id } = req.query;
    let query = `
      SELECT m.*, t.name as team_name 
      FROM matches m 
      LEFT JOIN teams t ON m.team_id = t.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (user_id) {
      query += ' AND m.user_id = ?';
      params.push(user_id);
    }
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
router.post('/', async (req, res) => {
  try {
    const { user_id, team_id, opponent, date, location, notes } = req.body;
    
    if (!user_id || !team_id) {
      return res.status(400).json({ error: 'user_id and team_id are required' });
    }
    
    // Convert ISO date to MySQL DATETIME format
    let mysqlDate = new Date();
    if (date) {
      mysqlDate = new Date(date);
    }
    const formattedDate = mysqlDate.toISOString().slice(0, 19).replace('T', ' ');
    
    const [result] = await pool.query(
      `INSERT INTO matches (user_id, team_id, opponent, date, location, status, notes) 
       VALUES (?, ?, ?, ?, ?, 'in_progress', ?)`,
      [user_id, team_id, opponent || null, formattedDate, location || 'home', notes || null]
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

// Get a single match with full details
router.get('/:id', async (req, res) => {
  try {
    const [matches] = await pool.query(`
      SELECT m.*, t.name as team_name 
      FROM matches m 
      LEFT JOIN teams t ON m.team_id = t.id 
      WHERE m.id = ?
    `, [req.params.id]);
    
    if (!matches.length) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    res.json(matches[0]);
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// Update match (e.g., finish match, update sets)
router.put('/:id', async (req, res) => {
  try {
    const { status, total_sets, notes, score_home, score_away } = req.body;
    const updates = [];
    const params = [];
    
    if (status !== undefined) {
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
    
    params.push(req.params.id);
    
    await pool.query(
      `UPDATE matches SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const [rows] = await pool.query(`
      SELECT m.*, t.name as team_name 
      FROM matches m 
      LEFT JOIN teams t ON m.team_id = t.id 
      WHERE m.id = ?
    `, [req.params.id]);
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

// Delete a match and all its statistics
router.delete('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // First delete all match_stats for this match
    await connection.query('DELETE FROM match_stats WHERE match_id = ?', [req.params.id]);
    console.log(`Deleted stats for match ${req.params.id}`);
    
    // Then delete the match
    await connection.query('DELETE FROM matches WHERE id = ?', [req.params.id]);
    console.log(`Deleted match ${req.params.id}`);
    
    await connection.commit();
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
router.get('/:id/stats', async (req, res) => {
  try {
    const matchId = req.params.id;
    
    // Get all stats for this match
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
    
    // Get summary by player and category
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
    
    // Get summary by set
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
    
    res.json({
      stats,
      summary,
      bySet
    });
  } catch (error) {
    console.error('Error fetching match stats:', error);
    res.status(500).json({ error: 'Failed to fetch match stats' });
  }
});

// Save match state (for resuming matches)
router.put('/:id/state', async (req, res) => {
  try {
    const matchId = req.params.id;
    const { positions, current_set, is_set_active, action_history, pending_stats } = req.body;
    
    const stateJson = JSON.stringify({
      positions,
      current_set,
      is_set_active,
      action_history,
      pending_stats
    });
    
    // Check if state already exists
    const [existing] = await pool.query(
      'SELECT id FROM match_states WHERE match_id = ?',
      [matchId]
    );
    
    if (existing.length > 0) {
      // Update existing state
      await pool.query(
        'UPDATE match_states SET state_json = ?, updated_at = NOW() WHERE match_id = ?',
        [stateJson, matchId]
      );
    } else {
      // Insert new state
      await pool.query(
        'INSERT INTO match_states (match_id, state_json) VALUES (?, ?)',
        [matchId, stateJson]
      );
    }
    
    console.log(`Match state saved for match ${matchId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving match state:', error);
    res.status(500).json({ error: 'Failed to save match state' });
  }
});

// Get match state (for resuming matches)
router.get('/:id/state', async (req, res) => {
  try {
    const matchId = req.params.id;
    
    const [rows] = await pool.query(
      'SELECT state_json FROM match_states WHERE match_id = ?',
      [matchId]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'No state found for this match' });
    }
    
    // MySQL JSON columns are auto-parsed by mysql2, handle both cases
    const stateJson = rows[0].state_json;
    const state = typeof stateJson === 'string' ? JSON.parse(stateJson) : stateJson;
    
    console.log(`Match state retrieved for match ${matchId}:`, {
      positions: state.positions?.filter(p => p.playerId).length || 0,
      current_set: state.current_set,
      is_set_active: state.is_set_active,
      pending_stats: state.pending_stats?.length || 0
    });
    
    res.json(state);
  } catch (error) {
    console.error('Error fetching match state:', error);
    res.status(500).json({ error: 'Failed to fetch match state' });
  }
});

// Delete match state when match is finished
router.delete('/:id/state', async (req, res) => {
  try {
    await pool.query('DELETE FROM match_states WHERE match_id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting match state:', error);
    res.status(500).json({ error: 'Failed to delete match state' });
  }
});

module.exports = router;
