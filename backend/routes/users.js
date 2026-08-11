const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendEmail, isEmailConfigured } = require('../services/emailService');
const { pool, retryQuery } = require('../db');
const { StatTemplates } = require('../config/statTemplates');
const { requireAuth, requireOwner, requireSuperadmin } = require('../middleware/auth');

const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_HOURS = 1; // Token válido por 1 hora
const VERIFICATION_CODE_EXPIRY_MINUTES = 30; // Código de registro válido por 30 min
// The user types the first 8 hex chars of the token from the email. Fixed length:
// it must never be derived from client input, or a 1-char "code" would match
// every pending token and hand over someone else's account.
const RESET_CODE_LENGTH = 8;

// ============================================
// GOOGLE SIGN-IN
// El cliente verifica el idToken de Google contra el Web Client ID.
// Requiere la variable de entorno GOOGLE_WEB_CLIENT_ID (OAuth 2.0 Web client).
// Si no está configurada, el endpoint /google responde 503.
// ============================================
const GOOGLE_WEB_CLIENT_ID = (process.env.GOOGLE_WEB_CLIENT_ID || '').trim();
let googleClient = null;
function getGoogleClient() {
  if (!GOOGLE_WEB_CLIENT_ID) return null;
  if (!googleClient) {
    // require diferido para no romper el arranque si la dependencia no está instalada
    const { OAuth2Client } = require('google-auth-library');
    googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);
  }
  return googleClient;
}

// ============================================
// EMAIL
// Envío a través de Resend (con Gmail SMTP como respaldo).
// Ver backend/services/emailService.js para la configuración.
// ============================================

// Función para generar token seguro
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Código de verificación de 8 caracteres alfanuméricos en mayúscula (misma UX que el reset)
function generateVerificationCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Determina el tipo de suscripción para una cuenta nueva según el periodo demo.
// Periodo de demo: PRO gratuito hasta el 30 de septiembre 2026; después FREE.
function getSubscriptionForNewUser() {
  const DEMO_END_DATE = new Date('2026-10-01T00:00:00');
  const isDemoPeriod = new Date() < DEMO_END_DATE;
  return {
    subscriptionType: isDemoPeriod ? 'pro' : 'free',
    subscriptionExpires: isDemoPeriod ? '2026-09-30 23:59:59' : null,
  };
}

// Plantilla de email para el código de verificación de registro
function buildVerificationEmail({ name, code }) {
  const html = `
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
            .token { font-size: 28px; font-weight: bold; color: #e21d66; letter-spacing: 4px; }
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
              <h2>Hola${name ? ` ${name}` : ''},</h2>
              <p>Gracias por registrarte en VBStats. Para crear tu cuenta, confirma que este correo es tuyo introduciendo el siguiente código en la app:</p>
              <div class="token-box">
                <div class="code-label">Tu código de verificación es:</div>
                <div class="token">${code}</div>
                <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
                  Introduce este código en la app para completar el registro
                </p>
              </div>
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Este código expira en <strong>${VERIFICATION_CODE_EXPIRY_MINUTES} minutos</strong></li>
                  <li>Si no intentaste crear una cuenta, ignora este correo</li>
                  <li>Nunca compartas este código con nadie</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>Este correo fue enviado automáticamente por VBStats.</p>
              <p>© ${new Date().getFullYear()} VBStats - Estadísticas de Voleibol</p>
            </div>
          </div>
        </body>
        </html>
      `;

  const text = `
Hola${name ? ` ${name}` : ''},

Gracias por registrarte en VBStats. Para crear tu cuenta, introduce el siguiente código en la app:

Tu código de verificación es: ${code}

IMPORTANTE:
- Este código expira en ${VERIFICATION_CODE_EXPIRY_MINUTES} minutos
- Si no intentaste crear una cuenta, ignora este correo
- Nunca compartas este código con nadie

© ${new Date().getFullYear()} VBStats - Estadísticas de Voleibol
      `;

  return { html, text };
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

// Get all users — superadmin only. This used to be public and leaked every
// registered address.
router.get('/', requireSuperadmin, async (req, res) => {
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

// Get user by ID (own account only)
router.get('/:id', requireOwner('id'), async (req, res) => {
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
    await pool.query('UPDATE users SET session_token = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionToken, user.id]);

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

// Register (legacy, no email verification).
// Kept only for app builds older than the verified-registration flow. It lets an
// account be created with an address the caller doesn't own, so it is disabled by
// default; set ALLOW_LEGACY_REGISTER=true if you need it during a rollout.
router.post('/register', async (req, res) => {
  if (String(process.env.ALLOW_LEGACY_REGISTER || '').toLowerCase() !== 'true') {
    return res.status(410).json({
      error: 'Actualiza la aplicación para crear una cuenta.',
      code: 'LEGACY_REGISTER_DISABLED',
    });
  }
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
    // Periodo de demo: PRO gratuito hasta el 30 de septiembre 2026
    // Después del demo: cuenta FREE (el usuario elige plan en la app)
    const DEMO_END_DATE = new Date('2026-10-01T00:00:00');
    const isDemoPeriod = new Date() < DEMO_END_DATE;
    
    const subscriptionType = isDemoPeriod ? 'pro' : 'free';
    const subscriptionExpires = isDemoPeriod ? '2026-09-30 23:59:59' : null;
    
    const [result] = await pool.query(
      'INSERT INTO users (email, password, name, session_token, subscription_type, subscription_expires_at, auto_renew) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, name || null, sessionToken, subscriptionType, subscriptionExpires, false]
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

// ==========================================
// REGISTRO CON VERIFICACIÓN DE EMAIL
// ==========================================

// Paso 1: solicitar código de verificación.
// Guarda el registro como pendiente y envía un código al correo indicado.
// La cuenta NO se crea hasta verificar el código (paso 2).
router.post('/register/request-code', async (req, res) => {
  try {
    const { email: rawEmail, password, name } = req.body;

    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const email = rawEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Correo electrónico no válido' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // El correo no puede estar ya registrado
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (!isEmailConfigured()) {
      // Sin email configurado no se puede verificar la propiedad del correo
      return res.status(503).json({ error: 'El servicio de correo no está disponible. Inténtalo más tarde.' });
    }

    // Hashear la contraseña ya en este paso (no se guarda en texto plano)
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Invalidar códigos anteriores para este correo
    await pool.query(
      'UPDATE email_verification_codes SET used = TRUE WHERE email = ? AND used = FALSE',
      [email]
    );

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      'INSERT INTO email_verification_codes (email, code, password_hash, name, expires_at) VALUES (?, ?, ?, ?, ?)',
      [email, code, hashedPassword, name || null, expiresAt]
    );

    const { html, text } = buildVerificationEmail({ name, code });
    await sendEmail({
      to: email,
      subject: 'Verifica tu correo - VBStats',
      html,
      text,
    });
    console.log(`Verification code sent to: ${email}`);

    res.json({
      message: 'Te hemos enviado un código de verificación. Revisa tu bandeja de entrada.',
      ...(process.env.NODE_ENV === 'development' && { debug_code: code }),
    });
  } catch (err) {
    console.error('Error in register/request-code:', err);
    res.status(500).json({ error: 'Error al enviar el código. Inténtalo de nuevo.' });
  }
});

// Paso 2: verificar el código y crear la cuenta definitivamente.
router.post('/register/verify-code', async (req, res) => {
  try {
    const { email: rawEmail, code } = req.body;

    if (!rawEmail || !code) {
      return res.status(400).json({ error: 'Email y código son obligatorios' });
    }

    const email = rawEmail.toLowerCase().trim();
    const normalizedCode = String(code).toUpperCase().trim();

    // Buscar el código pendiente más reciente, válido y sin usar
    const [codes] = await pool.query(
      `SELECT * FROM email_verification_codes
       WHERE email = ? AND code = ? AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, normalizedCode]
    );

    if (codes.length === 0) {
      return res.status(400).json({ error: 'Código inválido o expirado. Solicita uno nuevo.' });
    }

    const pending = codes[0];

    // Comprobar de nuevo que el correo no se haya registrado mientras tanto
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await pool.query('UPDATE email_verification_codes SET used = TRUE WHERE email = ?', [email]);
      return res.status(409).json({ error: 'Email already registered' });
    }

    const sessionToken = crypto.randomUUID();
    const { subscriptionType, subscriptionExpires } = getSubscriptionForNewUser();

    const [result] = await pool.query(
      'INSERT INTO users (email, password, auth_provider, name, session_token, subscription_type, subscription_expires_at, auto_renew) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, pending.password_hash, 'local', pending.name || null, sessionToken, subscriptionType, subscriptionExpires, false]
    );

    // Marcar como usado el código (y cualquier otro pendiente del correo)
    await pool.query('UPDATE email_verification_codes SET used = TRUE WHERE email = ?', [email]);

    const [rows] = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = rows[0];
    await ensureUserSettings(user.id);

    console.log(`Account created after email verification: ${email}`);
    res.status(201).json({
      ...user,
      session_token: sessionToken,
    });
  } catch (err) {
    console.error('Error in register/verify-code:', err);
    res.status(500).json({ error: 'Error al verificar el código. Inténtalo de nuevo.' });
  }
});

// ==========================================
// GOOGLE SIGN-IN
// ==========================================
// Recibe el idToken de Google, lo verifica y crea/inicia sesión del usuario.
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const client = getGoogleClient();
    if (!client) {
      return res.status(503).json({ error: 'El inicio de sesión con Google no está configurado en el servidor.' });
    }

    // Verificar el idToken contra el Web Client ID
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_WEB_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.warn('Google idToken verification failed:', verifyErr.message);
      return res.status(401).json({ error: 'Token de Google no válido.' });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'No se pudo obtener el correo de Google.' });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'El correo de Google no está verificado.' });
    }

    const email = payload.email.toLowerCase().trim();
    const displayName = payload.name || payload.given_name || null;
    const sessionToken = crypto.randomUUID();

    // Buscar usuario existente
    const [existing] = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE email = ?',
      [email]
    );

    let user;
    if (existing.length > 0) {
      // Usuario existente: actualizar sesión
      user = existing[0];
      await pool.query(
        'UPDATE users SET session_token = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
        [sessionToken, user.id]
      );
    } else {
      // Crear cuenta nueva vinculada a Google (sin contraseña utilizable)
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
      const { subscriptionType, subscriptionExpires } = getSubscriptionForNewUser();

      const [result] = await pool.query(
        'INSERT INTO users (email, password, auth_provider, name, session_token, last_login_at, subscription_type, subscription_expires_at, auto_renew) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)',
        [email, randomPassword, 'google', displayName, sessionToken, subscriptionType, subscriptionExpires, false]
      );
      const [rows] = await pool.query(
        'SELECT id, email, name, created_at FROM users WHERE id = ?',
        [result.insertId]
      );
      user = rows[0];
    }

    await ensureUserSettings(user.id);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
      session_token: sessionToken,
    });
  } catch (err) {
    console.error('Error during Google sign-in:', err);
    res.status(500).json({ error: 'Error al iniciar sesión con Google' });
  }
});

// Check whether this device still holds the active session.
// It never returns another account's token: the caller is already authenticated with
// that token, so we simply echo it back. Previously this endpoint handed the session
// token of any user id to anyone who asked, which was a full account takeover.
router.get('/:id/session', requireAuth, requireOwner('id'), async (req, res) => {
  try {
    const [rows] = await retryQuery(() =>
      pool.query('SELECT session_token FROM users WHERE id = ?', [req.targetUserId])
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Valid only when the stored token is exactly the one this request authenticated with.
    const stored = rows[0].session_token || null;
    const isCurrent = !!stored && stored === (req.headers.authorization || '').slice(7).trim();

    res.json({
      valid: isCurrent,
      session_token: isCurrent ? stored : null,
    });
  } catch (err) {
    console.error('Error checking session:', err);
    res.status(500).json({ error: 'Failed to check session' });
  }
});

// Logout (clear session token)
router.post('/:id/logout', requireAuth, requireOwner('id'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET session_token = NULL WHERE id = ?', [req.targetUserId]);
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Update profile (name / email) for your own account.
// Password changes are NOT accepted here — they must go through /change-password,
// which verifies the current password. Accepting `password` on this route meant
// anyone could reset another user's credentials by id.
router.put('/:id', requireAuth, requireOwner('id'), async (req, res) => {
  try {
    const { email, name } = req.body;
    const userId = req.targetUserId;

    const params = [];
    const updates = [];

    if (email !== undefined) {
      const normalized = String(email).toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalized)) {
        return res.status(400).json({ error: 'Correo electrónico no válido' });
      }
      const [taken] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [normalized, userId]);
      if (taken.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      updates.push('email = ?');
      params.push(normalized);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

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
router.post('/:id/change-password', requireAuth, requireOwner('id'), async (req, res) => {
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
    
    // Actualizar contraseña e invalidar la sesión, para que un atacante que hubiera
    // capturado el token anterior quede fuera.
    await pool.query(
      'UPDATE users SET password = ?, session_token = NULL WHERE id = ?',
      [hashedNewPassword, userId]
    );

    console.log(`Password cambiada exitosamente para usuario ${userId}`);
    res.json({ message: 'Password changed successfully', sessionInvalidated: true });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Delete user account and all associated data
router.delete('/:id', requireAuth, requireOwner('id'), async (req, res) => {
  const userId = req.targetUserId;
  const { password } = req.body || {};

  try {
    // Verify user exists and check password for security
    const [users] = await pool.query('SELECT id, password, auth_provider FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Google accounts have a random unusable password, so asking for it would make
    // the account impossible to delete. The bearer token is the proof of identity there.
    const isGoogleAccount = users[0].auth_provider === 'google';

    if (!isGoogleAccount) {
      // Require password confirmation for account deletion
      if (!password) {
        return res.status(400).json({ error: 'Se requiere la contraseña para eliminar la cuenta' });
      }

      const isPasswordValid = await bcrypt.compare(password, users[0].password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }
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

/**
 * Looks up a pending reset by the 8-character code from the email.
 *
 * Two things this deliberately does NOT do, because the previous version did and both
 * were exploitable:
 *   - it never takes the prefix length from the request (a 1-char "code" used to match
 *     every outstanding token);
 *   - it never returns the full token to the client.
 *
 * Matching is additionally scoped by email, so a valid code only ever unlocks the
 * account it was issued for.
 */
async function findPendingReset(email, code) {
  const normalizedCode = String(code).toLowerCase().trim();
  if (normalizedCode.length !== RESET_CODE_LENGTH) return null;
  if (!/^[0-9a-f]+$/.test(normalizedCode)) return null;

  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  const [tokens] = await pool.query(
    `SELECT prt.id, prt.token, prt.user_id, u.email
     FROM password_reset_tokens prt
     JOIN users u ON prt.user_id = u.id
     WHERE LOWER(LEFT(prt.token, ?)) = ?
       AND LOWER(u.email) = ?
       AND prt.used = FALSE
       AND prt.expires_at > NOW()
     ORDER BY prt.created_at DESC
     LIMIT 1`,
    [RESET_CODE_LENGTH, normalizedCode, normalizedEmail]
  );

  return tokens.length > 0 ? tokens[0] : null;
}

// Verify reset code - confirms the code is valid without handing out the token
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { token, code, email } = req.body;
    const providedCode = code || token;

    if (!providedCode || !email) {
      return res.status(400).json({ error: 'Email y código son obligatorios' });
    }

    const resetToken = await findPendingReset(email, providedCode);

    if (!resetToken) {
      return res.status(400).json({
        error: 'Código inválido o expirado. Solicita uno nuevo.',
        valid: false
      });
    }

    const maskedEmail = resetToken.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    res.json({
      valid: true,
      email: maskedEmail,
    });

  } catch (err) {
    console.error('Error verifying reset token:', err);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
});

// Reset password with a valid recovery code
router.post('/reset-password', async (req, res) => {
  try {
    const { token, code, email, newPassword } = req.body;
    const providedCode = code || token;

    if (!providedCode || !email || !newPassword) {
      return res.status(400).json({ error: 'Email, código y nueva contraseña son obligatorios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const resetToken = await findPendingReset(email, providedCode);

    if (!resetToken) {
      return res.status(400).json({
        error: 'Código inválido o expirado. Solicita uno nuevo.'
      });
    }

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
