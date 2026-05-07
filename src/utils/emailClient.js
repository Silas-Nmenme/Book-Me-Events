const nodemailer = require('nodemailer');

/**
 * Email Client
 * - Lazily initializes a shared nodemailer transporter
 * - Disables email sending when SMTP env vars are missing
 * - Never throws due to SMTP misconfiguration (best-effort)
 */

const REQUIRED_SMTP_VARS = ['EMAIL_HOST', 'EMAIL_PORT', 'MAIL_USER', 'EMAIL_PASS'];

let transporter = null;
let transporterInitAttemptedAt = 0;
let lastInitResult = 'unset';

const getMissingEnv = () => {
  return REQUIRED_SMTP_VARS.filter((key) => {
    const v = process.env[key];
    return v === undefined || v === null || v === '';
  });
};

const shouldRetryInit = () => {
  // If env is missing, keep logging sparingly but allow re-check.
  // Retry every 10 seconds in case env is injected later.
  const now = Date.now();
  return now - transporterInitAttemptedAt > 10_000;
};

const initTransporterIfNeeded = () => {
  if (transporter) return transporter;
  if (!shouldRetryInit()) return null;

  transporterInitAttemptedAt = Date.now();

  const missing = getMissingEnv();
  if (missing.length) {
    // Avoid log spam; log only when previous state was OK or unset.
    if (lastInitResult !== 'missing_env') {
      console.warn('Email service disabled - missing ENV:', missing);
      lastInitResult = 'missing_env';
    }
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number.parseInt(process.env.EMAIL_PORT, 10),
      secure: String(process.env.EMAIL_PORT) === '465',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    // Best-effort verify; do not fail the process.
    transporter.verify((err) => {
      if (err) {
        console.error('Email transporter failed:', err.message);
        lastInitResult = 'verify_failed';
      } else {
        console.log('Email service ready');
        lastInitResult = 'ok';
      }
    });

    return transporter;
  } catch (err) {
    console.error('Email transporter init failed:', err.message);
    transporter = null;
    lastInitResult = 'init_failed';
    return null;
  }
};

/**
 * Compatibility wrapper used by controllers.
 * Expected: sendEmail({ to, subject, text, html })
 */
const sendEmail = async ({ to, subject, text, html } = {}) => {
  const t = initTransporterIfNeeded();
  if (!t) {
    return { success: false, message: 'Email service unavailable' };
  }

  if (!to) {
    throw new Error('Missing email recipient (to)');
  }
  if (!subject) {
    throw new Error('Missing email subject');
  }

  const from = process.env.SMTP_FROM || process.env.MAIL_USER || process.env.EMAIL_FROM;

  try {
    await t.sendMail({
      from: from || undefined,
      to,
      subject,
      text,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error(`Email send failed: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };



