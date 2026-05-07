const nodemailer = require('nodemailer');

/**
 * Creates a Nodemailer transport using SMTP credentials from env.
 *
 * Supported env vars:
 * - EMAIL_HOST, EMAIL_PORT, MAIL_USER, MAIL_PASS
 *
 * Also supports common alternates:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
function createTransport() {
  // Supports both SMTP_* and EMAIL_/MAIL_* env var naming.
  // This prevents "Missing SMTP credentials" issues when .env uses EMAIL_HOST/MAIL_USER.
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    EMAIL_HOST,
    EMAIL_PORT,
    MAIL_USER,
    MAIL_PASS,
  } = process.env;

  const host = SMTP_HOST || EMAIL_HOST;
  const portRaw = SMTP_PORT || EMAIL_PORT;
  const port = portRaw ? Number(portRaw) : undefined;
  const user = SMTP_USER || MAIL_USER;
  const pass = SMTP_PASS || MAIL_PASS;

  if (!host || !port || !user || !pass) {
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  const secure = String(port) === '465';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}



async function sendEmail({ to, subject, text, html }) {
  const transporter = createTransport();

  if (!to) throw new Error('Missing email recipient (to)');
  if (!subject) throw new Error('Missing email subject');

  // .env in your project defines MAIL_USER, not SMTP_FROM.
  const from = process.env.SMTP_FROM || process.env.MAIL_USER || process.env.EMAIL_FROM;

  // If config is missing, transporter will be jsonTransport:true (no SMTP call).
  // This avoids the “Missing SMTP credentials” hard stop.
  return transporter.sendMail({
    from: from || undefined,
    to,
    subject,
    text,
    html,
  });
}


module.exports = { sendEmail };

