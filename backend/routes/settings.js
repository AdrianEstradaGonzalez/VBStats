const express = require('express');
const router = express.Router();
const { pool, retryQuery } = require('../db');
const { StatTemplates } = require('../config/statTemplates');
const { scopeToUser } = require('../middleware/auth');

// Stat settings are per-user. The user id always comes from the session, so a
// request can neither read nor overwrite another account's configuration.
// Global rows (user_id IS NULL) remain readable as the shared default template.

// Get all settings for the authenticated user
router.get('/', scopeToUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM stat_settings WHERE user_id = ? ORDER BY position, stat_category, stat_type',
      [req.effectiveUserId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get settings by position for the authenticated user
router.get('/position/:position', scopeToUser, async (req, res) => {
  try {
    const position = req.params.position;

    const [userSettings] = await retryQuery(() =>
      pool.query(
        'SELECT * FROM stat_settings WHERE position = ? AND user_id = ? ORDER BY stat_category, stat_type',
        [position, req.effectiveUserId]
      )
    );

    if (userSettings.length > 0) {
      return res.json(userSettings);
    }

    // Fall back to the shared defaults when the user has nothing configured yet.
    const [globalSettings] = await retryQuery(() =>
      pool.query(
        'SELECT * FROM stat_settings WHERE position = ? AND user_id IS NULL ORDER BY stat_category, stat_type',
        [position]
      )
    );
    res.json(globalSettings);
  } catch (err) {
    console.error('Error fetching position settings:', err);
    res.status(500).json({ error: 'Failed to fetch position settings' });
  }
});

// Create or update one setting
router.post('/', scopeToUser, async (req, res) => {
  try {
    const { position, stat_category, stat_type, enabled } = req.body;

    if (!position || !stat_category || !stat_type) {
      return res.status(400).json({ error: 'position, stat_category and stat_type are required' });
    }

    await pool.query(
      `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [position, stat_category, stat_type, !!enabled, req.effectiveUserId]
    );

    const [rows] = await pool.query(
      `SELECT * FROM stat_settings
       WHERE position = ? AND stat_category = ? AND stat_type = ? AND user_id = ?`,
      [position, stat_category, stat_type, req.effectiveUserId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('Error saving setting:', err);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

// Batch update settings
router.post('/batch', scopeToUser, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({ error: 'settings array is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const setting of settings) {
        await conn.query(
          `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
          [setting.position, setting.stat_category, setting.stat_type, !!setting.enabled, req.effectiveUserId]
        );
      }

      await conn.commit();
      res.json({ message: 'Settings updated successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error batch updating settings:', err);
    res.status(500).json({ error: 'Failed to batch update settings' });
  }
});

// Delete one of your own settings
router.delete('/:id', scopeToUser, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM stat_settings WHERE id = ? AND user_id = ?',
      [req.params.id, req.effectiveUserId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ message: 'Setting deleted' });
  } catch (err) {
    console.error('Error deleting setting:', err);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// Initialize default settings for a position
router.post('/init/:position', scopeToUser, async (req, res) => {
  try {
    const { position } = req.params;

    const positionStats = StatTemplates.getPositionStats()[position];
    if (!positionStats) {
      return res.status(400).json({ error: 'Invalid position' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const stat of positionStats) {
        for (const type of stat.types) {
          await conn.query(
            `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
             VALUES (?, ?, ?, TRUE, ?)
             ON DUPLICATE KEY UPDATE enabled = enabled`,
            [position, stat.category, type, req.effectiveUserId]
          );
        }
      }

      await conn.commit();

      const [rows] = await retryQuery(() =>
        pool.query(
          'SELECT * FROM stat_settings WHERE position = ? AND user_id = ? ORDER BY stat_category, stat_type',
          [position, req.effectiveUserId]
        )
      );

      res.json(rows);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error initializing settings:', err);
    res.status(500).json({ error: 'Failed to initialize settings' });
  }
});

/** Replaces the caller's whole configuration with one of the built-in templates. */
async function applyTemplate(userId, templateSettings) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM stat_settings WHERE user_id = ?', [userId]);
    for (const setting of templateSettings) {
      await conn.query(
        `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
         VALUES (?, ?, ?, ?, ?)`,
        [setting.position, setting.stat_category, setting.stat_type, setting.enabled, userId]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Apply basic configuration (template-defined)
router.post('/apply-basic', scopeToUser, async (req, res) => {
  try {
    await applyTemplate(req.effectiveUserId, StatTemplates.getBasicSettings());
    res.json({ message: 'Basic configuration applied successfully' });
  } catch (err) {
    console.error('Error applying basic config:', err);
    res.status(500).json({ error: 'Failed to apply basic configuration' });
  }
});

// Apply advanced configuration (all options enabled)
router.post('/apply-advanced', scopeToUser, async (req, res) => {
  try {
    await applyTemplate(req.effectiveUserId, StatTemplates.getAdvancedSettings());
    res.json({ message: 'Advanced configuration applied successfully' });
  } catch (err) {
    console.error('Error applying advanced config:', err);
    res.status(500).json({ error: 'Failed to apply advanced configuration' });
  }
});

module.exports = router;
