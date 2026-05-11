const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailClient');
const { createEmailVerificationToken } = require('../utils/emailVerification');
const { verificationEmail } = require('../utils/emailTemplates');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bookmeevent.netlify.app';

// POST /api/v1/auth/send-verification-email
// Protected: requires logged-in user
exports.sendVerificationEmail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const token = createEmailVerificationToken({ userId: user._id, type: 'email_verify' });
  const verifyUrl = `${FRONTEND_URL.replace(/\/+$/, '')}/verify-email.html?token=${encodeURIComponent(token)}`;

  const { subject, text, html } = verificationEmail({
    firstName: user.firstName,
    verificationLink: verifyUrl,
  });

  // Best-effort: don't fail the request if email sending can't be configured.
  try {
    await sendEmail({ to: user.email, subject, text, html });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Verification email failed:', e.message);
  }

  res.status(200).json({
    success: true,
    message: 'Verification email sent',
  });
});

