const nodemailer = require('nodemailer');
const emailTemplates = require('./emailTemplates');

/**
 * Email Client
 * - Uses a single shared nodemailer transporter
 * - Validates env on init
 * - If env missing, disables email sending (best-effort) and never throws
 */
let transporter = null;
let initAttempted = false;

const initTransporter = () => {
  if (initAttempted) return transporter;
  initAttempted = true;

  const required = ['EMAIL_HOST', 'EMAIL_PORT', 'MAIL_USER', 'EMAIL_PASS'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    console.warn('Email service disabled - missing ENV:', missing);
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: String(process.env.EMAIL_PORT) === '465',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  transporter.verify((err) => {
    if (err) console.error('Email transporter failed:', err.message);
    else console.log('Email service ready');
  });

  return transporter;
};

const getTransporter = () => {
  if (!transporter) initTransporter();
  return transporter;
};

/**
 * Compatibility wrapper for existing code.
 * authController expects sendEmail({ to, subject, text, html }).
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const t = getTransporter();
  if (!t) return { success: false, message: 'Email service unavailable' };

  if (!to) throw new Error('Missing email recipient (to)');
  if (!subject) throw new Error('Missing email subject');

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

/**
 * Production-style helpers (optional)
 * Kept here in case other controllers use these exported names later.
 */
const sendOTPEmail = async (email, name, otp) => {
  const t = getTransporter();
  if (!t) return { success: false, message: 'Email service unavailable' };

  const html = emailTemplates.otpVerification
    ? emailTemplates.otpVerification(name, otp)
    : htmlTemplate(otp);

  return sendEmail({
    to: email,
    subject: 'Your Verification Code',
    html,
  });
};

const sendWelcomeEmail = async (email, name, htmlTemplate) => {
  if (!htmlTemplate) {
    const { html } = emailTemplates.welcomeEmail
      ? emailTemplates.welcomeEmail({ firstName: name })
      : { html: '' };
    return sendEmail({
      to: email,
      subject: `Welcome to Book Me Events, ${name}!`,
      html,
    });
  }

  return sendEmail({
    to: email,
    subject: `Welcome to Book Me Events, ${name}!`,
    html: htmlTemplate,
  });
};

const htmlTemplate = (otp) => `
  <div style="font-family: Arial, sans-serif;">
    <h2>Your verification code</h2>
    <p>Use the following OTP:</p>
    <div style="font-size: 24px; font-weight: 700;">${otp}</div>
  </div>
`;

const sendLoginSuccessEmail = async (email, name) => {
  const t = getTransporter();
  if (!t) return { success: false, message: 'Email service unavailable' };

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
  const html = emailTemplates.loginSuccess
    ? emailTemplates.loginSuccess(name, timestamp)
    : emailTemplates.loginSuccessEmail
      ? emailTemplates.loginSuccessEmail({ firstName: name, email })
      : htmlTemplate(`Logged in at ${timestamp}`);

  // html could be {subject,text,html} depending on templates; normalize
  const normalizedHtml = typeof html === 'string' ? html : html?.html;

  return sendEmail({
    to: email,
    subject: 'Login Successful - Welcome Back',
    html: normalizedHtml || html,
  });
};

const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const t = getTransporter();
  if (!t) return { success: false, message: 'Email service unavailable' };

  const tpl = emailTemplates.passwordResetRequestedEmail
    ? emailTemplates.passwordResetRequestedEmail({ firstName: name, resetLink: resetUrl })
    : null;

  if (!tpl) return { success: false, message: 'Missing password reset template' };

  return sendEmail({
    to: email,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });
};

// Initialize transporter on module load (best-effort)
initTransporter();

module.exports = {
  sendEmail,

  // optional exports
  sendOTPEmail,
  sendWelcomeEmail,
  sendLoginSuccessEmail,
  sendPasswordResetEmail,
};

