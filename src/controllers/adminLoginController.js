const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailClient');
const { loginSuccessEmail } = require('../utils/emailTemplates');
const { generateToken } = require('../utils/generateToken');

function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpExpiryMs() {
  const minutes = Number(process.env.JWT_OTP_EXPIRE_MINUTES || 10);
  return minutes * 60 * 1000;
}

function otpPurposeForAdminLogin() {
  return 'admin_login_2fa_email';
}

// @desc    Start admin login OTP (email/password -> send OTP)
// @route   POST /api/v1/admin/login/start-otp
// @access  Public
exports.startAdminLoginOtp = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const loginEmail = email.toLowerCase().trim();

  const admin = await User.findOne({
    $or: [{ email: loginEmail }, { username: email }],
    role: 'ADMIN',
  });

  if (!admin) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!admin.isVerified) {
    res.status(403);
    throw new Error('Account not verified. Please verify your email OTP.');
  }

  // Validate password
  const isMatch = await admin.matchPassword(password.toString());
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const otp = generateSixDigitOtp();
  admin.otpCode = otp;
  admin.otpExpiresAt = new Date(Date.now() + otpExpiryMs());
  admin.otpPurpose = otpPurposeForAdminLogin();
  admin.otpVerifiedAt = undefined;
  await admin.save();

  // Send OTP email (best-effort)
  try {
    const subject = `Your ${process.env.APP_NAME || 'Book Me Events'} admin login code`;
    const text = `Hi ${admin.firstName || 'Admin'},\n\nYour admin login OTP code is: ${otp}\nThis code expires in ${Number(
      process.env.JWT_OTP_EXPIRE_MINUTES || 10,
    )} minutes.\n`;

    await sendEmail({
      to: admin.email,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
    });
  } catch (err) {
    // Don't fail login start if email fails.
    console.error('Admin login OTP email failed:', err?.message || err);
  }

  // Don’t issue JWT here.
  res.status(200).json({
    success: true,
    message: '2FA required',
  });
});

// @desc    Verify admin login OTP and issue JWT
// @route   POST /api/v1/admin/login/verify-otp
// @access  Public
exports.verifyAdminLoginOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and OTP are required');
  }

  const loginEmail = email.toLowerCase().trim();

  const admin = await User.findOne({
    $or: [{ email: loginEmail }, { username: email }],
    role: 'ADMIN',
  });

  if (!admin) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!admin.otpCode || !admin.otpExpiresAt || !admin.otpPurpose) {
    res.status(400);
    throw new Error('No OTP request found');
  }

  if (admin.otpPurpose !== otpPurposeForAdminLogin()) {
    res.status(400);
    throw new Error('Invalid OTP purpose');
  }

  if (new Date() > admin.otpExpiresAt) {
    res.status(400);
    throw new Error('OTP expired');
  }

  if (admin.otpCode !== otp.toString().trim()) {
    res.status(401);
    throw new Error('Invalid OTP');
  }

  // Consume OTP
  admin.otpVerifiedAt = new Date();
  admin.otpCode = undefined;
  admin.otpExpiresAt = undefined;
  admin.otpPurpose = undefined;
  await admin.save();

  // Issue JWT
  if (!process.env.JWT_SECRET) {
    res.status(500);
    throw new Error('Server misconfiguration: JWT_SECRET is missing');
  }

  const token = generateToken(admin._id);

  // Best-effort login email
  try {
    const { subject, text, html } = loginSuccessEmail({
      firstName: admin.firstName,
      email: admin.email,
    });

    await sendEmail({
      to: admin.email,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('Admin login email failed:', err?.message || err);
  }

  admin.password = undefined;

  res.status(200).json({
    success: true,
    data: admin,
    token,
  });
});

