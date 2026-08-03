const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { scopeToUser, requireAuth } = require('../middleware/auth');

/**
 * Resolves read access to a match's statistics.
 *
 * Allowed when the caller owns the match, or when the match has been explicitly
 * shared (it has a share_code) — that is the free plan's "view a shared report"
 * feature. Matches without a code stay private to their owner.
 */
async function canReadMatchStats(req, matchId) {
  const [rows] = await pool.query('SELECT user_id, share_code FROM matches WHERE id = ? LIMIT 1', [matchId]);
  if (rows.length === 0) return false;
  if (rows[0].share_code) return true;
  return !!req.auth.userId && rows[0].user_id === req.auth.userId;
}

function withMatchReadAccess(paramName = 'matchId') {
  return async (req, res, next) => {
    const matchId = Number(req.params[paramName]);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return res.status(400).json({ error: 'Invalid match id' });
    }
    try {
      if (!(await canReadMatchStats(req, matchId))) {
        return res.status(404).json({ error: 'Match not found' });
      }
      req.readableMatchId = matchId;
      next();
    } catch (err) {
      console.error('Match stats access check failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ==================== MATCH STATS ====================

// Save multiple stats at once (batch save at end of set/match)
router.post('/match-stats/batch', scopeToUser, async (req, res) => {
  try {
    const { stats } = req.body;

    if (!stats || !Array.isArray(stats) || stats.length === 0) {
      return res.status(400).json({ error: 'stats array is required' });
    }

    // Guard against an oversized payload wedging the connection pool.
    if (stats.length > 5000) {
      return res.status(413).json({ error: 'Too many stats in a single batch' });
    }

    const userId = req.effectiveUserId;

    // Every stat must belong to a match the caller owns. Checked once per distinct
    // match id rather than per row.
    const matchIds = [...new Set(stats.map((s) => Number(s.match_id)).filter((n) => Number.isInteger(n) && n > 0))];
    if (matchIds.length === 0) {
      return res.status(400).json({ error: 'match_id is required on every stat' });
    }
    const [ownedMatches] = await pool.query(
      'SELECT id FROM matches WHERE id IN (?) AND user_id = ?',
      [matchIds, userId]
    );
    if (ownedMatches.length !== matchIds.length) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Same for players: they must belong to one of the caller's teams.
    const playerIds = [...new Set(stats.map((s) => Number(s.player_id)).filter((n) => Number.isInteger(n) && n > 0))];
    if (playerIds.length > 0) {
      const [ownedPlayers] = await pool.query(
        `SELECT p.id FROM players p JOIN teams t ON p.team_id = t.id
         WHERE p.id IN (?) AND t.user_id = ?`,
        [playerIds, userId]
      );
      if (ownedPlayers.length !== playerIds.length) {
        return res.status(404).json({ error: 'Player not found' });
      }
    }

    // Resolve stat_setting_id per category/type once, instead of issuing two or three
    // queries for every single stat in the batch.
    const [existingSettings] = await pool.query(
      'SELECT id, stat_category, stat_type FROM stat_settings WHERE user_id = ?',
      [userId]
    );
    const settingByKey = new Map(
      existingSettings.map((s) => [`${s.stat_category}||${s.stat_type}`, s.id])
    );

    const processedStats = [];

    for (const s of stats) {
      const key = `${s.stat_category}||${s.stat_type}`;
      let validSettingId = settingByKey.get(key);

      if (!validSettingId) {
        const [newSetting] = await pool.query(
          `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
           VALUES ('General', ?, ?, true, ?)
           ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
          [s.stat_category, s.stat_type, userId]
        );
        validSettingId = newSetting.insertId;
        settingByKey.set(key, validSettingId);
      }

      processedStats.push([
        userId,
        s.match_id,
        s.player_id,
        s.set_number,
        validSettingId,
        s.stat_category,
        s.stat_type,
        s.sets_local ?? 0,
        s.sets_visitante ?? 0,
        s.puntos_local ?? 0,
        s.puntos_visitante ?? 0,
      ]);
    }

    const [result] = await pool.query(
      `INSERT INTO match_stats (user_id, match_id, player_id, set_number, stat_setting_id, stat_category, stat_type, sets_local, sets_visitante, puntos_local, puntos_visitante)
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
router.get('/match-stats/:matchId', withMatchReadAccess('matchId'), async (req, res) => {
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
    `, [req.readableMatchId]);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching match stats:', error);
    res.status(500).json({ error: 'Failed to fetch match stats' });
  }
});

// Get stats summary for a match
router.get('/match-stats/:matchId/summary', withMatchReadAccess('matchId'), async (req, res) => {
  try {
    const matchId = req.readableMatchId;

    const [teamSummary] = await pool.query(`
      SELECT stat_category, stat_type, COUNT(*) as total
      FROM match_stats
      WHERE match_id = ?
      GROUP BY stat_category, stat_type
      ORDER BY stat_category, stat_type
    `, [matchId]);

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

    const [setSummary] = await pool.query(`
      SELECT set_number, stat_category, stat_type, COUNT(*) as total
      FROM match_stats
      WHERE match_id = ?
      GROUP BY set_number, stat_category, stat_type
      ORDER BY set_number, stat_category
    `, [matchId]);

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

    res.json({ teamSummary, playerSummary, setSummary, playerSetSummary });
  } catch (error) {
    console.error('Error fetching stats summary:', error);
    res.status(500).json({ error: 'Failed to fetch stats summary' });
  }
});

// Get the authenticated user's all-time stats.
// The :userId segment is kept for URL compatibility but the query is always scoped
// to the session, so it can't be used to read another account's totals.
router.get('/user/:userId/summary', requireAuth, async (req, res) => {
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
    `, [req.auth.userId]);

    res.json(summary);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

module.exports = router;
