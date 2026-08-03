/**
 * Authentication & authorization middleware.
 *
 * The app authenticates with the opaque `session_token` stored in `users.session_token`
 * (created on login / register / Google sign-in). Clients send it as:
 *
 *     Authorization: Bearer <session_token>
 *
 * ------------------------------------------------------------------
 * TRANSITION MODE (important while old app builds are still installed)
 * ------------------------------------------------------------------
 * Older releases of the app never sent the token — they just put `user_id` in the
 * query string or body and the server trusted it. Turning that off in one go would
 * lock out every user who has not updated yet.
 *
 * So `resolveIdentity` accepts a *claimed* identity from those legacy params, but marks
 * it `req.auth.verified = false`. Middleware then behaves like this:
 *
 *   - `requireAuth`  : always demands a verified token. Used on everything that can
 *                      take over an account, move money, or touch another user's row.
 *                      Legacy clients get a 401 here — by design.
 *   - `requireOwner` : demands verified when STRICT_AUTH=true; otherwise falls back to
 *                      the claimed id so old clients keep working on their own data.
 *
 * Rollout: deploy with STRICT_AUTH unset, raise MIN_APP_VERSION so the app forces an
 * update, then set STRICT_AUTH=true once telemetry shows legacy traffic has stopped.
 */

const { pool } = require('../db');

const STRICT_AUTH = String(process.env.STRICT_AUTH || '').toLowerCase() === 'true';

/** Pull the bearer token out of the Authorization header. */
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim() || null;
  }
  return null;
}

/**
 * Read the user id the client *claims* to be, from the legacy places the old app used.
 * Never trusted on its own.
 */
function extractClaimedUserId(req) {
  const raw =
    req.headers['x-user-id'] ||
    (req.body && (req.body.userId ?? req.body.user_id)) ||
    req.query.userId ||
    req.query.user_id;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Resolves who the caller is. Always runs; never rejects.
 * Populates `req.auth = { userId, verified, isSuperadmin, subscriptionType }`.
 */
async function resolveIdentity(req, res, next) {
  req.auth = { userId: null, verified: false, isSuperadmin: false, subscriptionType: 'free' };

  const token = extractToken(req);
  if (token) {
    try {
      const [rows] = await pool.query(
        'SELECT id, is_superadmin, subscription_type FROM users WHERE session_token = ? LIMIT 1',
        [token]
      );
      if (rows.length > 0) {
        req.auth = {
          userId: rows[0].id,
          verified: true,
          isSuperadmin: !!rows[0].is_superadmin,
          subscriptionType: rows[0].subscription_type || 'free',
        };
        return next();
      }
      // Token present but unknown: stale session (logged in elsewhere / logged out).
      // Fall through to the legacy path so STRICT_AUTH governs the outcome.
    } catch (err) {
      console.error('Auth lookup failed:', err);
      return res.status(500).json({ error: 'Authentication error' });
    }
  }

  const claimed = extractClaimedUserId(req);
  if (claimed) {
    req.auth.userId = claimed;
    req.auth.verified = false;
  }
  next();
}

/** Hard requirement: a valid session token. No legacy fallback, ever. */
function requireAuth(req, res, next) {
  if (!req.auth || !req.auth.verified) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  next();
}

/**
 * Requires the caller to be the user identified by `:<param>` (default `id`),
 * or a superadmin. Honours the transition mode described at the top of the file.
 */
function requireOwner(param = 'id') {
  return (req, res, next) => {
    const target = Number(req.params[param]);
    if (!Number.isInteger(target) || target <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (!req.auth.userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (STRICT_AUTH && !req.auth.verified) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (req.auth.userId !== target && !req.auth.isSuperadmin) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
    req.targetUserId = target;
    next();
  };
}

/**
 * Establishes the effective user id for collection endpoints that are scoped by
 * user (teams, matches, settings...). Overwrites whatever user id the client sent
 * so a request can never read or write another account's rows.
 */
function scopeToUser(req, res, next) {
  if (!req.auth.userId) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (STRICT_AUTH && !req.auth.verified) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  req.effectiveUserId = req.auth.userId;
  next();
}

/** Superadmin only. Always requires a verified token — no legacy fallback. */
function requireSuperadmin(req, res, next) {
  if (!req.auth || !req.auth.verified) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (!req.auth.isSuperadmin) {
    return res.status(403).json({ error: 'Forbidden: superadmin access required' });
  }
  req.adminUserId = req.auth.userId;
  next();
}

/**
 * Verifies the caller owns the match in `:<param>` before letting the handler run.
 * Attaches the match row as `req.match` so handlers don't re-query it.
 */
function requireMatchOwner(param = 'id') {
  return async (req, res, next) => {
    const matchId = Number(req.params[param]);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return res.status(400).json({ error: 'Invalid match id' });
    }
    if (!req.auth.userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (STRICT_AUTH && !req.auth.verified) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    try {
      const [rows] = await pool.query('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchId]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Match not found' });
      }
      if (rows[0].user_id !== req.auth.userId && !req.auth.isSuperadmin) {
        // Same status as "missing" so the endpoint can't be used to probe which ids exist.
        return res.status(404).json({ error: 'Match not found' });
      }
      req.match = rows[0];
      next();
    } catch (err) {
      console.error('Match ownership check failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/** Verifies the caller owns the team in `:<param>`. Attaches `req.team`. */
function requireTeamOwner(param = 'id') {
  return async (req, res, next) => {
    const teamId = Number(req.params[param]);
    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Invalid team id' });
    }
    if (!req.auth.userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (STRICT_AUTH && !req.auth.verified) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    try {
      const [rows] = await pool.query('SELECT * FROM teams WHERE id = ? LIMIT 1', [teamId]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }
      if (rows[0].user_id !== req.auth.userId && !req.auth.isSuperadmin) {
        return res.status(404).json({ error: 'Team not found' });
      }
      req.team = rows[0];
      next();
    } catch (err) {
      console.error('Team ownership check failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/** Verifies the caller owns the team the player in `:<param>` belongs to. */
function requirePlayerOwner(param = 'id') {
  return async (req, res, next) => {
    const playerId = Number(req.params[param]);
    if (!Number.isInteger(playerId) || playerId <= 0) {
      return res.status(400).json({ error: 'Invalid player id' });
    }
    if (!req.auth.userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (STRICT_AUTH && !req.auth.verified) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    try {
      const [rows] = await pool.query(
        `SELECT p.*, t.user_id AS team_user_id
         FROM players p LEFT JOIN teams t ON p.team_id = t.id
         WHERE p.id = ? LIMIT 1`,
        [playerId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }
      if (rows[0].team_user_id !== req.auth.userId && !req.auth.isSuperadmin) {
        return res.status(404).json({ error: 'Player not found' });
      }
      req.player = rows[0];
      next();
    } catch (err) {
      console.error('Player ownership check failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = {
  STRICT_AUTH,
  resolveIdentity,
  requireAuth,
  requireOwner,
  requireSuperadmin,
  requireMatchOwner,
  requireTeamOwner,
  requirePlayerOwner,
  scopeToUser,
};
