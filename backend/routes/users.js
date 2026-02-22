const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool, retryQuery } = require('../db');
const { StatTemplates } = require('../config/statTemplates');

const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_HOURS = 1; // Token válido por 1 hora

// ============================================
// EMAIL via Gmail SMTP (Nodemailer)
// No requiere dominio propio ni verificación de dominio.
// Solo necesitas una cuenta de Gmail con "Contraseña de aplicación".
//
// Variables de entorno necesarias:
//   GMAIL_USER=tucuenta@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16 chars, con o sin espacios)
//   EMAIL_FROM=VBStats <tucuenta@gmail.com>   (opcional, usa GMAIL_USER si no se define)
// ============================================
const GMAIL_USER = (process.env.GMAIL_USER || '').trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').trim();
const EMAIL_FROM = process.env.EMAIL_FROM
  ? process.env.EMAIL_FROM.trim()
  : (GMAIL_USER ? `VBStats <${GMAIL_USER}>` : '');

let transporter = null;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
  console.log('✅ Email transporter configured (Gmail SMTP)');
} else {
  console.warn('⚠️  GMAIL_USER / GMAIL_APP_PASSWORD not configured – password recovery emails will not be sent');
}

// Función para enviar email usando Nodemailer + Gmail
async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    throw new Error(
      'Email no configurado. Define GMAIL_USER y GMAIL_APP_PASSWORD en las variables de entorno.'
    );
  }

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    console.log('📧 Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ Nodemailer error:', err);
    throw new Error(err.message || 'Error al enviar el email');
  }
}

// Función para generar token seguro
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

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

    // Choose initial template based on current subscription type
    const [userRows] = await conn.query(
      'SELECT subscription_type FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const subscriptionType = userRows.length > 0
      ? userRows[0].subscription_type
      : 'free';

    const initialSettings = subscriptionType === 'pro'
      ? StatTemplates.getAdvancedSettings()
      : StatTemplates.getBasicSettings();

    for (const setting of initialSettings) {
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
    const [rows] = await retryQuery(() => 
      pool.query(
        'SELECT session_token FROM users WHERE id = ?',
        [userId]
      )
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

// Delete user account and all associated data
router.delete('/:id', async (req, res) => {
  const userId = req.params.id;
  const { password } = req.body || {};

  try {
    // Verify user exists and check password for security
    const [users] = await pool.query('SELECT id, password FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Require password confirmation for account deletion
    if (!password) {
      return res.status(400).json({ error: 'Se requiere la contraseña para eliminar la cuenta' });
    }

    const isPasswordValid = await bcrypt.compare(password, users[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Delete stat_settings (no FK constraint, would be orphaned)
      await conn.query('DELETE FROM stat_settings WHERE user_id = ?', [userId]);

      // 2. Delete players belonging to user's teams (FK is SET NULL, not CASCADE)
      await conn.query(
        'DELETE FROM players WHERE team_id IN (SELECT id FROM teams WHERE user_id = ?)',
        [userId]
      );

      // 3. Delete the user - cascades handle: matches, match_stats, stats, 
      //    match_states, password_reset_tokens, device_trials, teams
      await conn.query('DELETE FROM users WHERE id = ?', [userId]);

      await conn.commit();
      console.log(`User ${userId} and all associated data deleted successfully`);
      res.json({ message: 'Cuenta eliminada correctamente' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Error al eliminar la cuenta. Inténtalo de nuevo.' });
  }
});

// ==========================================
// PASSWORD RECOVERY ENDPOINTS
// ==========================================

// Request password reset - sends email with reset link
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Buscar usuario por email
    const [users] = await pool.query(
      'SELECT id, email, name FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    // IMPORTANTE: Siempre responder con éxito para evitar enumeration attack
    // No revelar si el email existe o no en la base de datos
    if (users.length === 0) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      // Responder igual que si existiera para no revelar información
      return res.json({ 
        message: 'Si el correo existe, recibirás un enlace de recuperación.' 
      });
    }

    const user = users[0];

    // Invalidar tokens anteriores del usuario (seguridad adicional)
    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE',
      [user.id]
    );

    // Generar nuevo token seguro
    const resetToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Guardar token en la base de datos
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, expiresAt]
    );

    // Construir URL de reset (la app móvil manejará deep links)
    const appResetUrl = `vbstats://reset-password?token=${resetToken}`;
    const webResetUrl = `${process.env.FRONTEND_URL || 'https://vbstats.app'}/reset-password?token=${resetToken}`;

    // Contenido del email
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; }
            .logo { font-size: 32px; font-weight: bold; color: #e21d66; }
            .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin: 20px 0; }
            .token-box { background: #fff; border: 2px dashed #e21d66; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .token { font-size: 24px; font-weight: bold; color: #e21d66; letter-spacing: 2px; word-break: break-all; }
            .btn { display: inline-block; background: #e21d66; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 5px; }
            .btn:hover { background: #b31551; }
            .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
            .code-label { font-size: 14px; color: #6b7280; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🏐 VBStats</div>
            </div>
            
            <div class="content">
              <h2>Hola${user.name ? ` ${user.name}` : ''},</h2>
              
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de VBStats.</p>
              
              <div class="token-box">
                <div class="code-label">Tu código de recuperación es:</div>
                <div class="token">${resetToken.substring(0, 8).toUpperCase()}</div>
                <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
                  Ingresa este código en la app para verificar tu identidad
                </p>
              </div>
              
              <p style="text-align: center;">
                <a href="${appResetUrl}" class="btn">Abrir en la App</a>
              </p>
              
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Este código expira en <strong>1 hora</strong></li>
                  <li>Si no solicitaste este cambio, ignora este correo</li>
                  <li>Nunca compartas este código con nadie</li>
                </ul>
              </div>
            </div>
            
            <div class="footer">
              <p>Este correo fue enviado automáticamente por VBStats.</p>
              <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este mensaje de forma segura.</p>
              <p>© ${new Date().getFullYear()} VBStats - Estadísticas de Voleibol</p>
            </div>
          </div>
        </body>
        </html>
      `;

    const emailText = `
Hola${user.name ? ` ${user.name}` : ''},

Recibimos una solicitud para restablecer la contraseña de tu cuenta de VBStats.

Tu código de recuperación es: ${resetToken.substring(0, 8).toUpperCase()}

Ingresa este código en la app para verificar tu identidad y establecer una nueva contraseña.

IMPORTANTE:
- Este código expira en 1 hora
- Si no solicitaste este cambio, ignora este correo
- Nunca compartas este código con nadie

© ${new Date().getFullYear()} VBStats - Estadísticas de Voleibol
      `;

    // Enviar email con Nodemailer (Gmail SMTP)
    await sendEmail({
      to: user.email,
      subject: 'Recuperar contraseña - VBStats',
      html: emailHtml,
      text: emailText,
    });
    console.log(`Password reset email sent to: ${user.email}`);

    res.json({ 
      message: 'Si el correo existe, recibirás un enlace de recuperación.',
      // En desarrollo, incluir el token para testing (quitar en producción)
      ...(process.env.NODE_ENV === 'development' && { debug_token: resetToken })
    });

  } catch (err) {
    console.error('Error in forgot-password:', err);
    // No revelar detalles del error al cliente
    res.status(500).json({ error: 'Error al procesar la solicitud. Inténtalo de nuevo.' });
  }
});

// Verify reset token - check if token is valid
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Buscar token en la base de datos (usamos los primeros 8 caracteres en mayúscula)
    // El usuario ingresa solo los primeros 8 caracteres
    const tokenPrefix = token.toLowerCase();
    
    const [tokens] = await pool.query(
      `SELECT prt.*, u.email 
       FROM password_reset_tokens prt 
       JOIN users u ON prt.user_id = u.id 
       WHERE LOWER(LEFT(prt.token, ?)) = ? 
         AND prt.used = FALSE 
         AND prt.expires_at > NOW()
       ORDER BY prt.created_at DESC 
       LIMIT 1`,
      [tokenPrefix.length, tokenPrefix]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ 
        error: 'Código inválido o expirado. Solicita uno nuevo.',
        valid: false 
      });
    }

    const resetToken = tokens[0];
    
    // Obtener email parcialmente oculto para confirmación
    const email = resetToken.email;
    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    res.json({ 
      valid: true,
      email: maskedEmail,
      fullToken: resetToken.token // Necesario para el siguiente paso
    });

  } catch (err) {
    console.error('Error verifying reset token:', err);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
});

// Reset password with valid token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar token válido
    const [tokens] = await pool.query(
      `SELECT prt.*, u.id as user_id, u.email 
       FROM password_reset_tokens prt 
       JOIN users u ON prt.user_id = u.id 
       WHERE prt.token = ? 
         AND prt.used = FALSE 
         AND prt.expires_at > NOW()`,
      [token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ 
        error: 'Código inválido o expirado. Solicita uno nuevo.' 
      });
    }

    const resetToken = tokens[0];
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();

      // Hash nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Actualizar contraseña del usuario
      await conn.query(
        'UPDATE users SET password = ?, session_token = NULL WHERE id = ?',
        [hashedPassword, resetToken.user_id]
      );

      // Marcar token como usado
      await conn.query(
        'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?',
        [resetToken.id]
      );

      // Invalidar cualquier otro token pendiente del usuario
      await conn.query(
        'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND id != ?',
        [resetToken.user_id, resetToken.id]
      );

      await conn.commit();
      
      console.log(`Password reset successful for user: ${resetToken.email}`);
      
      res.json({ 
        message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' 
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

module.exports = router;
