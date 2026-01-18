const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Stat configuration blueprint used to initialize settings per user
// MUST match frontend SettingsScreen.tsx POSITION_STATS exactly
const DEFAULT_STAT_CONFIG = {
  'Receptor': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
  'Opuesto': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
  'Colocador': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
  'Central': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Ataque', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Bloqueo', types: ['Positivo', 'Neutro', 'Error'] },
    { category: 'Saque', types: ['Punto directo', 'Positivo', 'Neutro', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
  'Líbero': [
    { category: 'Recepción', types: ['Doble positiva', 'Positiva', 'Neutra', 'Error'] },
    { category: 'Defensa', types: ['Positiva', 'Error'] },
    { category: 'Colocación', types: ['Positiva', 'Error'] },
  ],
};

async function ensureUserSettings(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check if user already has settings
    const [existingSettings] = await conn.query(
      'SELECT COUNT(*) as count FROM stat_settings WHERE user_id = ?',
      [userId]
    );
    
    if (existingSettings[0].count > 0) {
      // User already has settings, skip initialization
      await conn.commit();
      return;
    }

    // Try to copy settings from user 1 (basic configuration template)
    const [basicSettings] = await conn.query(
      'SELECT * FROM stat_settings WHERE user_id = 1'
    );
    
    if (basicSettings.length > 0) {
      // Copy settings from user 1 (basic configuration)
      for (const setting of basicSettings) {
        await conn.query(
          `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE enabled = enabled`,
          [setting.position, setting.stat_category, setting.stat_type, setting.enabled, userId]
        );
      }
    } else {
      // Fallback: create default settings if user 1 doesn't have settings
      for (const [position, configs] of Object.entries(DEFAULT_STAT_CONFIG)) {
        for (const stat of configs) {
          for (const type of stat.types) {
            await conn.query(
              `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
               VALUES (?, ?, ?, TRUE, ?)
               ON DUPLICATE KEY UPDATE enabled = enabled`,
              [position, stat.category, type, userId]
            );
          }
        }
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Get all users (admin)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, name, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const [rows] = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE email = ? AND password = ?',
      [email, password]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    // Ensure default settings exist for this user (all enabled)
    await ensureUserSettings(user.id);

    res.json(user);
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Check if user already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, password, name || null]
    );
    
    const [rows] = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = rows[0];
    // Initialize default settings for the new user
    await ensureUserSettings(user.id);
    
    res.status(201).json(user);
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const userId = req.params.id;
    
    let query = 'UPDATE users SET ';
    const params = [];
    const updates = [];
    
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (password) {
      updates.push('password = ?');
      params.push(password);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    query += updates.join(', ') + ' WHERE id = ?';
    params.push(userId);
    
    await pool.query(query, params);
    
    const [rows] = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
