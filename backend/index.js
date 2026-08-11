const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { init } = require('./db');
const { startSubscriptionScheduler } = require('./scripts/subscriptionScheduler');
const { resolveIdentity, STRICT_AUTH } = require('./middleware/auth');

dotenv.config();

const teams = require('./routes/teams');
const players = require('./routes/players');
const matches = require('./routes/matches');
const stats = require('./routes/stats');
const settings = require('./routes/settings');
const users = require('./routes/users');
const subscriptions = require('./routes/subscriptions');
const admin = require('./routes/admin');

const app = express();

// Behind Render's proxy: needed so express-rate-limit sees real client IPs.
app.set('trust proxy', 1);

// The API is consumed by a mobile app, not a browser, so CORS is only relevant
// for local tooling. Allow an explicit allow-list via env; deny everything else.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (the app, curl) send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
  })
);

// Minimal hardening headers (avoids pulling in helmet for an API-only service).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.removeHeader('X-Powered-By');
  next();
});

// Stripe webhook needs the raw body for signature verification - must precede express.json
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo en un momento.' },
});

// Credential and token endpoints get the strict limiter. Without this, the
// password-reset code (and login) can be brute forced.
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/google', authLimiter);
app.use('/api/users/forgot-password', authLimiter);
app.use('/api/users/verify-reset-token', authLimiter);
app.use('/api/users/reset-password', authLimiter);
app.use('/api/users/register/request-code', authLimiter);
app.use('/api/users/register/verify-code', authLimiter);

app.use('/api', generalLimiter);

// ---------------------------------------------------------------------------
// Logging - never log request bodies: they carry passwords, reset codes and
// Apple receipts, and Render retains logs.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Resolve the caller's identity once, for every route.
app.use('/api', resolveIdentity);

app.use('/api/teams', teams);
app.use('/api/players', players);
app.use('/api/matches', matches);
app.use('/api/stats', stats);
app.use('/api/settings', settings);
app.use('/api/users', users);
app.use('/api/subscriptions', subscriptions);
app.use('/api/admin', admin);

// Health check. Reports whether the optional integrations are wired up, so a
// misconfigured deploy can be spotted from outside without reading the logs.
// Only booleans and provider names — never keys or addresses.
app.get('/api/health', (req, res) => {
  const { isEmailConfigured, getEmailProvider } = require('./services/emailService');
  const { isPushConfigured } = require('./services/pushService');

  res.json({
    ok: true,
    email: { configured: isEmailConfigured(), provider: getEmailProvider() },
    push: { configured: isPushConfigured() },
    auth: { strict: STRICT_AUTH },
  });
});

// Version check endpoint
app.get('/api/version', (req, res) => {
  const minVersion = process.env.MIN_APP_VERSION || '1.0';
  const storeUrls = {
    android: process.env.PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.vbstats',
    ios: process.env.APP_STORE_URL || 'https://apps.apple.com/app/vbstats/id123456789'
  };
  res.json({
    minVersion,
    storeUrls,
    message: process.env.UPDATE_MESSAGE || 'Hay una nueva versión disponible. Por favor, actualiza la aplicación para continuar.'
  });
});

// Catch-all error handler: never leak stack traces or SQL messages to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`VBStats backend listening on port ${PORT}`);
      console.log(`Auth mode: ${STRICT_AUTH ? 'STRICT (token required)' : 'TRANSITION (legacy clients tolerated)'}`);
      if (!STRICT_AUTH) {
        console.warn('⚠️  STRICT_AUTH is off. Set STRICT_AUTH=true once all clients are updated.');
      }
      // Start the subscription expiry checker
      startSubscriptionScheduler();
    });
  })
  .catch((err) => {
    console.error('Failed to initialize DB', err);
    process.exit(1);
  });
