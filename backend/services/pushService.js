/**
 * Push notification delivery via Firebase Cloud Messaging.
 *
 * FCM handles both platforms: Android natively, iOS by forwarding to APNs (upload the
 * APNs auth key in Firebase Console > Project settings > Cloud Messaging).
 *
 * Configuration — one of:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64  base64 of the service-account JSON (recommended
 *                                    on Render: no newline escaping headaches)
 *   FIREBASE_SERVICE_ACCOUNT         the raw service-account JSON
 *   GOOGLE_APPLICATION_CREDENTIALS   path to the JSON file (standard Google variable)
 *
 * Get the file from: Firebase Console > Project settings > Service accounts >
 * "Generate new private key". Treat it as a secret; it is equivalent to send rights
 * on your whole Firebase project.
 */

let admin = null;
let initError = null;

function loadCredentials() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    return JSON.parse(raw);
  }
  return null;
}

function getAdmin() {
  if (admin || initError) return admin;

  try {
    // eslint-disable-next-line global-require
    const firebaseAdmin = require('firebase-admin');

    if (firebaseAdmin.apps.length > 0) {
      admin = firebaseAdmin;
      return admin;
    }

    const credentials = loadCredentials();
    if (credentials) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(credentials),
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.applicationDefault(),
      });
    } else {
      initError = 'Firebase credentials not configured';
      console.warn('⚠️  Push notifications disabled: set FIREBASE_SERVICE_ACCOUNT_BASE64');
      return null;
    }

    admin = firebaseAdmin;
    console.log('✅ Firebase Admin initialised (push notifications enabled)');
    return admin;
  } catch (err) {
    initError = err.message;
    console.error('❌ Failed to initialise Firebase Admin:', err.message);
    return null;
  }
}

/** True when the server can actually deliver notifications. */
function isPushConfigured() {
  return getAdmin() !== null;
}

/**
 * Sends one notification to many device tokens.
 *
 * @param {string[]} tokens   FCM registration tokens
 * @param {object}   message  { title, body, data }
 * @returns {Promise<{ successCount:number, failureCount:number, invalidTokens:string[] }>}
 *          `invalidTokens` are tokens FCM reported as unregistered — the caller should
 *          delete them so the table doesn't fill with dead devices.
 */
async function sendToTokens(tokens, { title, body, data = {} }) {
  const firebase = getAdmin();
  if (!firebase) {
    throw new Error('Push notifications are not configured on this server');
  }

  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  // sendEachForMulticast caps at 500 tokens per call.
  const BATCH_SIZE = 500;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);

    const response = await firebase.messaging().sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      // Data values must be strings for FCM.
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: {
        priority: 'high',
        notification: {
          channelId: 'vbstats-default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1 },
        },
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = result.error && result.error.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        invalidTokens.push(batch[index]);
      }
    });
  }

  return { successCount, failureCount, invalidTokens };
}

module.exports = { sendToTokens, isPushConfigured };
