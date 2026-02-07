const express = require('express');
const router = express.Router();
const { pool, retryQuery } = require('../db');
const { StatTemplates } = require('../config/statTemplates');

// Get all settings for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    let query = 'SELECT * FROM stat_settings';
    const params = [];
    
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY position, stat_category, stat_type';
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get settings by position for a user
router.get('/position/:position', async (req, res) => {
  try {
    const userId = req.query.userId;
    const position = req.params.position;
    
    if (userId) {
      // Buscar configuraciones específicas del usuario
      const [userSettings] = await retryQuery(() =>
        pool.query(
          'SELECT * FROM stat_settings WHERE position = ? AND user_id = ? ORDER BY stat_category, stat_type',
          [position, userId]
        )
      );
      
      // Si el usuario tiene configuraciones personalizadas, usarlas
      if (userSettings.length > 0) {
        return res.json(userSettings);
      }
      
      // Si no tiene configuraciones personalizadas, devolver las globales
      const [globalSettings] = await retryQuery(() =>
        pool.query(
          'SELECT * FROM stat_settings WHERE position = ? AND user_id IS NULL ORDER BY stat_category, stat_type',
          [position]
        )
      );
      return res.json(globalSettings);
    } else {
      // Sin userId, devolver solo configuraciones globales
      const [rows] = await retryQuery(() =>
        pool.query(
          'SELECT * FROM stat_settings WHERE position = ? AND user_id IS NULL ORDER BY stat_category, stat_type',
          [position]
        )
      );
      res.json(rows);
    }
  } catch (err) {
    console.error('Error fetching position settings:', err);
    res.status(500).json({ error: 'Failed to fetch position settings' });
  }
});

// Create or update setting
router.post('/', async (req, res) => {
  try {
    const { position, stat_category, stat_type, enabled, user_id } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [position, stat_category, stat_type, enabled, user_id || null]
    );
    
    // Fetch the inserted/updated row
    let query = 'SELECT * FROM stat_settings WHERE position = ? AND stat_category = ? AND stat_type = ?';
    const params = [position, stat_category, stat_type];
    
    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    } else {
      query += ' AND user_id IS NULL';
    }
    
    const [rows] = await pool.query(query, params);
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error saving setting:', err);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

// Batch update settings
router.post('/batch', async (req, res) => {
  try {
    const { settings, user_id } = req.body; // array of {position, stat_category, stat_type, enabled}
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Si es un usuario específico, primero verificamos si ya tiene configuraciones personalizadas
      if (user_id) {
        // Para cada configuración, verificar si el usuario ya la tiene personalizada
        for (const setting of settings) {
          // Intentar insertar, si existe actualizar solo el enabled
          await conn.query(
            `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
            [setting.position, setting.stat_category, setting.stat_type, setting.enabled, user_id]
          );
        }
      } else {
        // Para configuraciones globales (user_id IS NULL)
        for (const setting of settings) {
          await conn.query(
            `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
             VALUES (?, ?, ?, ?, NULL)
             ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
            [setting.position, setting.stat_category, setting.stat_type, setting.enabled]
          );
        }
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

// Delete setting
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM stat_settings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Setting deleted' });
  } catch (err) {
    console.error('Error deleting setting:', err);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// Initialize default settings for a position and user
router.post('/init/:position', async (req, res) => {
  try {
    const { position } = req.params;
    const { user_id } = req.body;

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
            [position, stat.category, type, user_id || null]
          );
        }
      }
      
      await conn.commit();
      
      // Return the initialized settings with retry
      let query = 'SELECT * FROM stat_settings WHERE position = ?';
      const params = [position];
      
      if (user_id) {
        query += ' AND user_id = ?';
        params.push(user_id);
      } else {
        query += ' AND user_id IS NULL';
      }
      
      query += ' ORDER BY stat_category, stat_type';
      
      const [rows] = await retryQuery(() => pool.query(query, params));
      
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

// Apply basic configuration (template-defined)
router.post('/apply-basic', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const basicSettings = StatTemplates.getBasicSettings();
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Delete existing user settings
      await conn.query('DELETE FROM stat_settings WHERE user_id = ?', [user_id]);
      
      // Apply basic template
      for (const setting of basicSettings) {
        await conn.query(
          `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [setting.position, setting.stat_category, setting.stat_type, setting.enabled, user_id]
        );
      }
      
      await conn.commit();
      res.json({ message: 'Basic configuration applied successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error applying basic config:', err);
    res.status(500).json({ error: 'Failed to apply basic configuration' });
  }
});

// Apply advanced configuration (all options enabled)
router.post('/apply-advanced', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const advancedSettings = StatTemplates.getAdvancedSettings();
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Delete existing user settings
      await conn.query('DELETE FROM stat_settings WHERE user_id = ?', [user_id]);
      
      // Insert all settings with template values
      for (const setting of advancedSettings) {
        await conn.query(
          `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [setting.position, setting.stat_category, setting.stat_type, setting.enabled, user_id]
        );
      }
      
      await conn.commit();
      res.json({ message: 'Advanced configuration applied successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error applying advanced config:', err);
    res.status(500).json({ error: 'Failed to apply advanced configuration' });
  }
});

module.exports = router;
