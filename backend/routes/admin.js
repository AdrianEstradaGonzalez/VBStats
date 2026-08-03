const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireSuperadmin } = require('../middleware/auth');
const { sendToTokens, isPushConfigured } = require('../services/pushService');

// NOTE: `requireSuperadmin` now comes from the shared auth middleware and checks the
// session token. The previous local version trusted an `x-user-id` header, so anyone
// who guessed an admin's numeric id had full admin rights.

// Check if the signed-in user is a superadmin
router.get('/is-superadmin', async (req, res) => {
  // Derived from the session; a client can no longer ask about an arbitrary id.
  res.json({ isSuperadmin: !!(req.auth && req.auth.verified && req.auth.isSuperadmin) });
});

// ==========================================
// PUSH TOKEN MANAGEMENT
// ==========================================

// Register (or refresh) this device's push token for the signed-in user
router.post('/push-token', requireAuth, async (req, res) => {
  const { token, platform } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }
  const validPlatforms = ['ios', 'android', 'unknown'];
  const devicePlatform = validPlatforms.includes(platform) ? platform : 'unknown';

  try {
    // A device that switches account must not keep delivering to the previous one.
    await pool.query('DELETE FROM push_tokens WHERE token = ? AND user_id != ?', [token, req.auth.userId]);

    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE platform = VALUES(platform), updated_at = CURRENT_TIMESTAMP`,
      [req.auth.userId, token, devicePlatform]
    );
    res.json({ message: 'Push token registered' });
  } catch (err) {
    console.error('Error registering push token:', err);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

// Remove this device's token (called on logout / when the user revokes permission)
router.delete('/push-token', requireAuth, async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }
  try {
    await pool.query('DELETE FROM push_tokens WHERE token = ? AND user_id = ?', [token, req.auth.userId]);
    res.json({ message: 'Push token removed' });
  } catch (err) {
    console.error('Error removing push token:', err);
    res.status(500).json({ error: 'Failed to remove push token' });
  }
});

// ==========================================
// NOTIFICATIONS (superadmin only)
// ==========================================

// Delivery stats so the admin screen can show how many devices are reachable
router.get('/notifications/audience', requireSuperadmin, async (req, res) => {
  try {
    const [[totals]] = await pool.query(
      `SELECT COUNT(*) AS devices, COUNT(DISTINCT user_id) AS users FROM push_tokens`
    );
    const [byPlatform] = await pool.query(
      `SELECT platform, COUNT(*) AS devices FROM push_tokens GROUP BY platform`
    );
    const [[byPlan]] = await pool.query(
      `SELECT
         SUM(u.subscription_type = 'free') AS free,
         SUM(u.subscription_type = 'basic') AS basic,
         SUM(u.subscription_type = 'pro') AS pro
       FROM push_tokens pt JOIN users u ON pt.user_id = u.id`
    );

    res.json({
      configured: isPushConfigured(),
      devices: totals.devices,
      users: totals.users,
      byPlatform,
      byPlan,
    });
  } catch (err) {
    console.error('Error fetching notification audience:', err);
    res.status(500).json({ error: 'Failed to fetch audience' });
  }
});

// History of sent notifications
router.get('/notifications', requireSuperadmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.body, n.sent_at, n.recipients_count, n.audience, u.email AS sent_by_email
       FROM admin_notifications n
       LEFT JOIN users u ON n.sent_by = u.id
       ORDER BY n.sent_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/** Resolves the target tokens for an audience selector. */
async function resolveTokens(audience) {
  if (audience === 'free' || audience === 'basic' || audience === 'pro') {
    const [rows] = await pool.query(
      `SELECT pt.token FROM push_tokens pt
       JOIN users u ON pt.user_id = u.id
       WHERE u.subscription_type = ?`,
      [audience]
    );
    return rows.map((r) => r.token);
  }
  if (audience === 'paid') {
    const [rows] = await pool.query(
      `SELECT pt.token FROM push_tokens pt
       JOIN users u ON pt.user_id = u.id
       WHERE u.subscription_type IN ('basic', 'pro')`
    );
    return rows.map((r) => r.token);
  }
  const [rows] = await pool.query('SELECT token FROM push_tokens');
  return rows.map((r) => r.token);
}

// Send a notification
router.post('/notifications/send', requireSuperadmin, async (req, res) => {
  const { title, body, audience = 'all' } = req.body;

  if (!title || !String(title).trim() || !body || !String(body).trim()) {
    return res.status(400).json({ error: 'title and body are required' });
  }
  if (String(title).length > 100 || String(body).length > 500) {
    return res.status(400).json({ error: 'El título admite 100 caracteres y el mensaje 500.' });
  }

  const validAudiences = ['all', 'free', 'basic', 'pro', 'paid'];
  if (!validAudiences.includes(audience)) {
    return res.status(400).json({ error: 'Audiencia no válida' });
  }

  if (!isPushConfigured()) {
    return res.status(503).json({
      error: 'El servidor no tiene configuradas las credenciales de Firebase. Define FIREBASE_SERVICE_ACCOUNT_BASE64.',
      code: 'PUSH_NOT_CONFIGURED',
    });
  }

  try {
    const tokens = await resolveTokens(audience);

    // Record the notification first so there is always an audit trail, even if
    // delivery fails halfway.
    const [result] = await pool.query(
      `INSERT INTO admin_notifications (title, body, sent_by, recipients_count, audience)
       VALUES (?, ?, ?, 0, ?)`,
      [String(title).trim(), String(body).trim(), req.adminUserId, audience]
    );

    if (tokens.length === 0) {
      return res.json({
        message: 'No hay dispositivos registrados para esta audiencia',
        notificationId: result.insertId,
        totalTokens: 0,
        successCount: 0,
        failCount: 0,
      });
    }

    const { successCount, failureCount, invalidTokens } = await sendToTokens(tokens, {
      title: String(title).trim(),
      body: String(body).trim(),
      data: { notificationId: result.insertId, type: 'admin' },
    });

    // Prune devices FCM told us are gone.
    if (invalidTokens.length > 0) {
      await pool.query('DELETE FROM push_tokens WHERE token IN (?)', [invalidTokens]);
      console.log(`🧹 Removed ${invalidTokens.length} stale push tokens`);
    }

    await pool.query(
      'UPDATE admin_notifications SET recipients_count = ? WHERE id = ?',
      [successCount, result.insertId]
    );

    res.json({
      message: 'Notification sent',
      notificationId: result.insertId,
      totalTokens: tokens.length,
      successCount,
      failCount: failureCount,
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
        u.last_login_at,
        u.is_superadmin,
        (SELECT COUNT(*) FROM push_tokens pt WHERE pt.user_id = u.id) AS device_count
       FROM users u
       ORDER BY u.last_login_at DESC, u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users for admin:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Delete a user and all associated data (superadmin only)
router.delete('/users/:id', requireSuperadmin, async (req, res) => {
  const targetId = Number(req.params.id);

  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  // Prevent superadmin from deleting themselves
  if (targetId === req.adminUserId) {
    return res.status(403).json({ error: 'Cannot delete your own account from admin panel' });
  }

  try {
    // Verify target user exists and is not a superadmin
    const [target] = await pool.query('SELECT id, is_superadmin FROM users WHERE id = ?', [targetId]);
    if (target.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target[0].is_superadmin) {
      return res.status(403).json({ error: 'Cannot delete another superadmin' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Delete stat_settings (no FK cascade)
      await conn.query('DELETE FROM stat_settings WHERE user_id = ?', [targetId]);

      // Delete players belonging to user's teams (FK is SET NULL, not CASCADE)
      await conn.query(
        'DELETE FROM players WHERE team_id IN (SELECT id FROM teams WHERE user_id = ?)',
        [targetId]
      );

      // Delete the user — FK cascades handle the rest
      await conn.query('DELETE FROM users WHERE id = ?', [targetId]);

      await conn.commit();
      console.log(`Admin ${req.adminUserId} deleted user ${targetId} and all associated data`);
      res.json({ message: 'User deleted successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error deleting user (admin):', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
