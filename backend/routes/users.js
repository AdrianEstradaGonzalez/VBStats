const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('../db');
const { StatTemplates } = require('../config/statTemplates');

const SALT_ROUNDS = 12;

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

    const basicSettings = StatTemplates.getBasicSettings();
    for (const setting of basicSettings) {
      await conn.query(
        `INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled = enabled`,
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
    
    // Obtener usuario con contraseña hasheada
    const [rows] = await pool.query(
      'SELECT id, email, name, password, created_at FROM users WHERE email = ?',
      [email]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    
    // Verificar contraseña con bcrypt
    // Si la contraseña no está hasheada (migración), comparar directamente y luego hashear
    let isValidPassword = false;
    
    if (user.password.startsWith('$2')) {
      // Password está hasheada con bcrypt
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      // Password en texto plano (migración legacy) - comparar directamente
      isValidPassword = (password === user.password);
      
      // Si es válida, hashear para futuras autenticaciones
      if (isValidPassword) {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        console.log(`Password migrada a bcrypt para usuario ${user.id}`);
      }
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generar nuevo token de sesión y guardar (solo una sesión por usuario)
    const sessionToken = crypto.randomUUID();
    await pool.query('UPDATE users SET session_token = ? WHERE id = ?', [sessionToken, user.id]);

    // Ensure default settings exist for this user (all enabled)
    await ensureUserSettings(user.id);

    // Devolver usuario sin la contraseña y con token de sesión
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
      session_token: sessionToken,
    });
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

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password antes de guardar
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const sessionToken = crypto.randomUUID();
    const [result] = await pool.query(
      'INSERT INTO users (email, password, name, session_token) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name || null, sessionToken]
    );
    
    const [rows] = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = rows[0];
    // Initialize default settings for the new user
    await ensureUserSettings(user.id);
    
    res.status(201).json({
      ...user,
      session_token: sessionToken,
    });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current session token for user
router.get('/:id/session', async (req, res) => {
  try {
    const userId = req.params.id;
    const [rows] = await pool.query(
      'SELECT session_token FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ session_token: rows[0].session_token || null });
  } catch (err) {
    console.error('Error fetching session token:', err);
    res.status(500).json({ error: 'Failed to fetch session token' });
  }
});

// Logout (clear session token)
router.post('/:id/logout', async (req, res) => {
  try {
    const userId = req.params.id;
    await pool.query('UPDATE users SET session_token = NULL WHERE id = ?', [userId]);
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ error: 'Logout failed' });
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
      // Hash password antes de guardar
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push('password = ?');
      params.push(hashedPassword);
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

// Change password (requires current password verification)
router.post('/:id/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.params.id;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    // Obtener usuario con contraseña actual
    const [users] = await pool.query(
      'SELECT id, password FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    
    // Verificar contraseña actual
    let isValidPassword = false;
    
    if (user.password.startsWith('$2')) {
      // Password está hasheada con bcrypt
      isValidPassword = await bcrypt.compare(currentPassword, user.password);
    } else {
      // Password en texto plano (migración legacy)
      isValidPassword = (currentPassword === user.password);
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // Actualizar contraseña
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, userId]
    );
    
    console.log(`Password cambiada exitosamente para usuario ${userId}`);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Failed to change password' });
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
