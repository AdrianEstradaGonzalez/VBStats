const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all legacy stats
router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM stats ORDER BY id DESC');
  res.json(rows);
});

// Create legacy stat
router.post('/', async (req, res) => {
  const { match_id, player_id, metric, value } = req.body;
  if (!match_id || !player_id || !metric || value === undefined) {
    return res.status(400).json({ error: 'match_id, player_id, metric, and value are required' });
  }
  const [result] = await pool.query(
    'INSERT INTO stats (match_id, player_id, metric, value) VALUES (?, ?, ?, ?)',
    [match_id, player_id, metric, value]
  );
  const [rows] = await pool.query('SELECT * FROM stats WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

// Get legacy stat by id
router.get('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM stats WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

// Delete legacy stat
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM stats WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// ==================== MATCH STATS (New System) ====================

// Save multiple stats at once (batch save at end of set/match)
router.post('/match-stats/batch', async (req, res) => {
  try {
    const { stats } = req.body;
    
    if (!stats || !Array.isArray(stats) || stats.length === 0) {
      return res.status(400).json({ error: 'stats array is required' });
    }

    // Para evitar errores de FK cuando los stat_setting_id no existen,
    // buscamos o creamos settings válidos para cada stat
    const processedStats = [];
    
    for (const s of stats) {
      // Intentar encontrar un setting válido para este user/category/type
      const [existingSettings] = await pool.query(
        `SELECT id FROM stat_settings 
         WHERE user_id = ? AND stat_category = ? AND stat_type = ? 
         LIMIT 1`,
        [s.user_id, s.stat_category, s.stat_type]
      );
      
      let validSettingId = s.stat_setting_id;
      
      if (existingSettings.length > 0) {
        // Usar el setting existente
        validSettingId = existingSettings[0].id;
      } else {
        // Verificar si el stat_setting_id proporcionado existe
        const [settingExists] = await pool.query(
          'SELECT id FROM stat_settings WHERE id = ?',
          [s.stat_setting_id]
        );
        
        if (settingExists.length === 0) {
          // El setting no existe, crear uno nuevo
          const [newSetting] = await pool.query(
            `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id) 
             VALUES ('General', ?, ?, true, ?)`,
            [s.stat_category, s.stat_type, s.user_id]
          );
          validSettingId = newSetting.insertId;
          console.log(`Created new stat_setting (id: ${validSettingId}) for ${s.stat_category}/${s.stat_type}`);
        }
      }
      
      processedStats.push([
        s.user_id,
        s.match_id,
        s.player_id,
        s.set_number,
        validSettingId,
        s.stat_category,
        s.stat_type
      ]);
    }
    
    const [result] = await pool.query(
      `INSERT INTO match_stats (user_id, match_id, player_id, set_number, stat_setting_id, stat_category, stat_type) 
       VALUES ?`,
      [processedStats]
    );
    
    res.status(201).json({ 
      success: true, 
      inserted: result.affectedRows 
    });
  } catch (error) {
    console.error('Error saving batch stats:', error);
    res.status(500).json({ error: 'Failed to save stats' });
  }
});

// Get match stats by match_id
router.get('/match-stats/:matchId', async (req, res) => {
  try {
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
    `, [req.params.matchId]);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching match stats:', error);
    res.status(500).json({ error: 'Failed to fetch match stats' });
  }
});

// Get stats summary for a match
router.get('/match-stats/:matchId/summary', async (req, res) => {
  try {
    const matchId = req.params.matchId;
    
    // Overall team summary by category and type
    const [teamSummary] = await pool.query(`
      SELECT 
        stat_category,
        stat_type,
        COUNT(*) as total
      FROM match_stats
      WHERE match_id = ?
      GROUP BY stat_category, stat_type
      ORDER BY stat_category, stat_type
    `, [matchId]);
    
    // Per-player summary
    const [playerSummary] = await pool.query(`
      SELECT 
        ms.player_id,
        p.name as player_name,
        p.number as player_number,
        p.position as player_position,
        ms.stat_category,
        ms.stat_type,
        COUNT(*) as total
      FROM match_stats ms
      JOIN players p ON ms.player_id = p.id
      WHERE ms.match_id = ?
      GROUP BY ms.player_id, ms.stat_category, ms.stat_type
      ORDER BY p.name, ms.stat_category
    `, [matchId]);
    
    // Per-set summary
    const [setSummary] = await pool.query(`
      SELECT 
        set_number,
        stat_category,
        stat_type,
        COUNT(*) as total
      FROM match_stats
      WHERE match_id = ?
      GROUP BY set_number, stat_category, stat_type
      ORDER BY set_number, stat_category
    `, [matchId]);
    
    // Per-player per-set summary
    const [playerSetSummary] = await pool.query(`
      SELECT 
        ms.set_number,
        ms.player_id,
        p.name as player_name,
        ms.stat_category,
        ms.stat_type,
        COUNT(*) as total
      FROM match_stats ms
      JOIN players p ON ms.player_id = p.id
      WHERE ms.match_id = ?
      GROUP BY ms.set_number, ms.player_id, ms.stat_category, ms.stat_type
      ORDER BY ms.set_number, p.name
    `, [matchId]);
    
    res.json({
      teamSummary,
      playerSummary,
      setSummary,
      playerSetSummary
    });
  } catch (error) {
    console.error('Error fetching stats summary:', error);
    res.status(500).json({ error: 'Failed to fetch stats summary' });
  }
});

// Get user's all-time stats
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const [summary] = await pool.query(`
      SELECT 
        ms.stat_category,
        ms.stat_type,
        COUNT(*) as total,
        COUNT(DISTINCT ms.match_id) as matches_count
      FROM match_stats ms
      WHERE ms.user_id = ?
      GROUP BY ms.stat_category, ms.stat_type
      ORDER BY ms.stat_category, total DESC
    `, [req.params.userId]);
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

module.exports = router;
