/**
 * Transactional email.
 *
 * Primary provider is Resend; Gmail SMTP is kept as a fallback so the service keeps
 * working while a domain is still being verified, and so a Resend outage doesn't
 * silently break password recovery.
 *
 * Why move off Gmail as the primary:
 *   - Gmail app passwords are meant for a personal mailbox, not for sending on
 *     behalf of a product. Messages come from a @gmail.com address, which hurts
 *     deliverability and looks unprofessional.
 *   - Gmail imposes a low daily send cap and gives no delivery feedback: a bounced
 *     or spam-filtered recovery email is invisible to us.
 *   - Resend sends from your own domain with DKIM/SPF, and its dashboard shows
 *     whether each message was delivered, bounced or complained.
 *
 * Configuration:
 *   RESEND_API_KEY   API key from https://resend.com/api-keys
 *   EMAIL_FROM       Sender, e.g. "VBStats <no-reply@tudominio.com>".
 *                    The domain MUST be verified in Resend or every send fails.
 *
 * Fallback (optional, used only when RESEND_API_KEY is absent):
 *   GMAIL_USER, GMAIL_APP_PASSWORD
 */

const nodemailer = require('nodemailer');

const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const GMAIL_USER = (process.env.GMAIL_USER || '').trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').trim();

const EMAIL_FROM = process.env.EMAIL_FROM
  ? process.env.EMAIL_FROM.trim()
  : (GMAIL_USER ? `VBStats <${GMAIL_USER}>` : '');

let resendClient = null;
let gmailTransporter = null;

if (RESEND_API_KEY) {
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(RESEND_API_KEY);
    console.log('✅ Email provider: Resend');
  } catch (err) {
    console.error('❌ Could not initialise Resend:', err.message);
  }
}

if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  console.log(resendClient
    ? 'ℹ️  Gmail SMTP available as fallback'
    : '✅ Email provider: Gmail SMTP');
}

if (!resendClient && !gmailTransporter) {
  console.warn('⚠️  No email provider configured — password recovery and email verification will not work. Set RESEND_API_KEY.');
}

/** True when at least one provider can send. */
function isEmailConfigured() {
  return !!(resendClient || gmailTransporter);
}

/** Which provider will be used, for diagnostics. */
function getEmailProvider() {
  if (resendClient) return 'resend';
  if (gmailTransporter) return 'gmail';
  return 'none';
}

async function sendWithResend({ to, subject, html, text }) {
  const { data, error } = await resendClient.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject,
    html,
    text,
  });

  // The SDK reports failures in `error` rather than throwing, so an unchecked
  // call looks successful even when nothing was sent.
  if (error) {
    const message = error.message || JSON.stringify(error);
    throw new Error(`Resend: ${message}`);
  }

  return { id: data && data.id, provider: 'resend' };
}

async function sendWithGmail({ to, subject, html, text }) {
  const info = await gmailTransporter.sendMail({ from: EMAIL_FROM, to, subject, html, text });
  return { id: info.messageId, provider: 'gmail' };
}

/**
 * Sends an email through the configured provider.
 * Falls back to Gmail if Resend fails and Gmail is configured.
 *
 * @throws when no provider is configured, or every configured provider failed.
 */
async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    throw new Error('El servicio de correo no está configurado. Define RESEND_API_KEY en el servidor.');
  }
  if (!EMAIL_FROM) {
    throw new Error('Falta EMAIL_FROM. Debe ser una dirección de un dominio verificado en Resend.');
  }

  if (resendClient) {
    try {
      const result = await sendWithResend({ to, subject, html, text });
      console.log(`📧 Email sent via Resend: ${result.id}`);
      return result;
    } catch (err) {
      console.error('❌ Resend send failed:', err.message);
      if (!gmailTransporter) throw err;
      console.warn('↩️  Falling back to Gmail SMTP');
    }
  }

  const result = await sendWithGmail({ to, subject, html, text });
  console.log(`📧 Email sent via Gmail: ${result.id}`);
  return result;
}

module.exports = { sendEmail, isEmailConfigured, getEmailProvider, EMAIL_FROM };
