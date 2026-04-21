const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Middleware to verify superadmin access
async function requireSuperadmin(req, res, next) {
  const userId = req.headers['x-user-id'] || req.body.userId || req.query.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const [rows] = await pool.query('SELECT is_superadmin FROM users WHERE id = ?', [userId]);
    if (rows.length === 0 || !rows[0].is_superadmin) {
      return res.status(403).json({ error: 'Forbidden: superadmin access required' });
    }
    req.adminUserId = Number(userId);
    next();
  } catch (err) {
    console.error('Superadmin check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Check if a user is superadmin
router.get('/is-superadmin', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.json({ isSuperadmin: false });
  }

  try {
    const [rows] = await pool.query('SELECT is_superadmin FROM users WHERE id = ?', [userId]);
    const isSuperadmin = rows.length > 0 && !!rows[0].is_superadmin;
    res.json({ isSuperadmin });
  } catch (err) {
    console.error('Error checking superadmin:', err);
    res.json({ isSuperadmin: false });
  }
});

// ==========================================
// PUSH TOKEN MANAGEMENT
// ==========================================

// Register push token for a user
router.post('/push-token', async (req, res) => {
  const { userId, token, platform } = req.body;
  if (!userId || !token) {
    return res.status(400).json({ error: 'userId and token are required' });
  }

  try {
    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token = VALUES(token), platform = VALUES(platform), updated_at = CURRENT_TIMESTAMP`,
      [userId, token, platform || 'unknown']
    );
    res.json({ message: 'Push token registered' });
  } catch (err) {
    console.error('Error registering push token:', err);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

// ==========================================
// NOTIFICATION MANAGEMENT (superadmin only)
// ==========================================

// Get all notifications sent by admin
router.get('/notifications', requireSuperadmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, body, sent_at, recipients_count
       FROM admin_notifications
       ORDER BY sent_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Send notification to all users
router.post('/notifications/send', requireSuperadmin, async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  try {
    // Get all push tokens
    const [tokens] = await pool.query(
      'SELECT DISTINCT token, platform FROM push_tokens'
    );

    // Store the notification in DB
    const [result] = await pool.query(
      `INSERT INTO admin_notifications (title, body, sent_by, recipients_count)
       VALUES (?, ?, ?, ?)`,
      [title, body, req.adminUserId, tokens.length]
    );

    // Send push notifications via Expo Push API (works for both iOS/Android with Expo)
    let successCount = 0;
    let failCount = 0;

    if (tokens.length > 0) {
      const messages = tokens
        .filter(t => t.token && t.token.startsWith('ExponentPushToken'))
        .map(t => ({
          to: t.token,
          sound: 'default',
          title: title,
          body: body,
          data: { notificationId: result.insertId },
        }));

      // Send in batches of 100 (Expo limit)
      const BATCH_SIZE = 100;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        try {
          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batch),
          });

          const data = await response.json();
          if (data.data) {
            data.data.forEach(ticket => {
              if (ticket.status === 'ok') successCount++;
              else failCount++;
            });
          }
        } catch (pushErr) {
          console.error('Error sending push batch:', pushErr);
          failCount += batch.length;
        }
      }
    }

    // Update recipients count with actual successes
    await pool.query(
      'UPDATE admin_notifications SET recipients_count = ? WHERE id = ?',
      [successCount, result.insertId]
    );

    res.json({
      message: 'Notification sent',
      notificationId: result.insertId,
      totalTokens: tokens.length,
      successCount,
      failCount,
    });
  } catch (err) {
    console.error('Error sending notification:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ==========================================
// USER MANAGEMENT (superadmin only)
// ==========================================

// Get all users with subscription info
router.get('/users', requireSuperadmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        u.id,
        u.email,
        u.name,
        u.subscription_type,
        u.subscription_expires_at,
        u.auto_renew,
        u.created_at,
        u.last_login_at
       FROM users u
       ORDER BY u.name ASC, u.email ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users for admin:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
