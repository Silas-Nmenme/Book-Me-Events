const asyncHandler = require('express-async-handler');


const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { sendEmail } = require('../utils/emailClient');
const {
  passwordResetRequestedEmail,
  passwordResetSuccessEmail,
  loginSuccessEmail,
} = require('../utils/emailTemplates');

// ===============================
// Helpers: 6-digit OTP (DB-backed)
// ===============================
function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpExpiryMs() {
  const minutes = Number(process.env.JWT_OTP_EXPIRE_MINUTES || 10);
  return minutes * 60 * 1000;
}

// @desc    Register USER (OTP verification required)
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, passwordConfirm } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !phone || !password || !passwordConfirm) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  if (password !== passwordConfirm) {
    res.status(400);
    throw new Error('Passwords do not match');
  }

  // Check if user already exists
  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  // Create user (role strictly USER)
  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone,
    password,
    role: 'USER',
    isVerified: false,
  });

  const otp = generateSixDigitOtp();
  user.otpCode = otp;
  user.otpExpiresAt = new Date(Date.now() + otpExpiryMs());
  user.otpPurpose = 'user_verify_email';
  user.otpVerifiedAt = undefined;
  await user.save();

  // Send OTP email (best-effort)
  try {
    const subject = `Your ${process.env.APP_NAME || 'Book Me Events'} OTP verification code`;
    const text = `Hi ${user.firstName},\n\nYour OTP code is: ${otp}\nThis code expires in ${Number(process.env.JWT_OTP_EXPIRE_MINUTES || 10)} minutes.\n`;
    await sendEmail({ to: user.email, subject, text, html: `<p>${text.replace(/\n/g, '<br/>')}</p>` });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('OTP email failed:', err.message);
  }

  // Do not issue JWT until OTP verification.
  user.password = undefined;
  res.status(201).json({
    success: true,
    message: 'OTP sent to your email',
    data: user,
  });
});

// @desc    Verify USER email by OTP
// @route   POST /api/v1/auth/verify-otp
// @access  Public
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and OTP are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.otpPurpose !== 'user_verify_email') {
    res.status(400);
    throw new Error('Invalid OTP purpose');
  }
  if (!user.otpCode || !user.otpExpiresAt) {
    res.status(400);
    throw new Error('No OTP request found');
  }
  if (new Date() > user.otpExpiresAt) {
    res.status(400);
    throw new Error('OTP expired');
  }
  if (user.otpCode !== otp.toString()) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  user.isVerified = true;
  user.otpVerifiedAt = new Date();
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  user.otpPurpose = undefined;
  await user.save();

  res.status(200).json({ success: true, message: 'Email verified successfully' });
});

// @desc    Login user (requires OTP verified)
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {

  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  // Check for user
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!user.isVerified) {
    res.status(403);
    throw new Error('Account not verified. Please verify your email OTP.');
  }


  // Debug: helps diagnose Vercel 500s during login
  // (No sensitive data: only config state)
  if (process.env.NODE_ENV === 'production') {
    console.log('Login env check:', {
      JWT_SECRET_present: !!process.env.JWT_SECRET,
      DB_ready: !!global.__BME_DB_READY,
    });
  }


  // Check if password matches
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Remove password from response
  user.password = undefined;

  // Admin-enforced TOTP 2FA
  // Requirement: Admin must enable TOTP before normal admin login proceeds.
  if (user.role === 'ADMIN') {
    if (!user.totpEnabled || !user.totpSecret) {
      res.status(403);
      throw new Error('2FA required for admin accounts');
    }

    // Expect totpCode in request body
    const { totpCode } = req.body;
    if (!totpCode) {
      res.status(403);
      throw new Error('2FA code required');
    }

    const speakeasy = require('speakeasy');

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'ascii',
      token: totpCode.toString(),
      window: 1,
    });

    if (!verified) {
      res.status(401);
      throw new Error('Invalid 2FA code');
    }

    user.totpVerifiedAt = new Date();
    await user.save();
  }


  // Generate token
  if (!process.env.JWT_SECRET) {
    res.status(500);
    throw new Error('Server misconfiguration: JWT_SECRET is missing');
  }

  let token;
  try {
    token = generateToken(user._id);
  } catch (err) {
    res.status(500);
    throw new Error(`Token generation failed: ${err.message}`);
  }


  // Send login email (best-effort: don't fail login if email fails)
  try {
    const { subject, text, html } = loginSuccessEmail({
      firstName: user.firstName,
      email: user.email,
    });

    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Login email failed:', err.message);
  }

  res.status(200).json({
    success: true,
    data: user,
    token,
  });
});


// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

// NOTE: old JWT-link email verification removed.
// Email verification is now OTP-based (see verifyOtp).



// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400);
      throw new Error('Please provide email');
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Security: don't reveal whether email exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
    }

    // DB-backed single-use reset token
    const crypto = require('crypto');
    const PasswordResetToken = require('../models/PasswordResetToken');

    // Revoke any outstanding reset tokens for this user (keeps it revocable)
    await PasswordResetToken.updateMany(
      { userId: user._id, purpose: 'password_reset', revokedAt: null, usedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    // Create a random token and store only its hash
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const resetMinutes = Number(process.env.JWT_RESET_EXPIRE_MINUTES || 15);
    const expiresAt = new Date(Date.now() + resetMinutes * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      purpose: 'password_reset',
      expiresAt,
    });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bookmeevent.netlify.app';
    const resetUrl = `${FRONTEND_URL.replace(/\/+$/, '')}/reset-password.html?token=${encodeURIComponent(resetToken)}`;




    const { subject, text, html } = passwordResetRequestedEmail({
      firstName: user.firstName,
      resetLink: resetUrl,
    });


    // Best-effort: don't fail the endpoint if email sending can't be configured.
    try {
      await sendEmail({
        to: user.email,
        subject,
        text,
        html,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Password reset email failed:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Reset email sent',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



// @desc    Reset password
// @route   POST /api/v1/auth/reset-password/:token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  const { password, passwordConfirm } = req.body;

  if (!password || !passwordConfirm) {
    res.status(400);
    throw new Error('Please provide new password');
  }

  if (password !== passwordConfirm) {
    res.status(400);
    throw new Error('Passwords do not match');
  }

// DB-backed single-use password reset tokens
  const crypto = require('crypto');
  const PasswordResetToken = require('../models/PasswordResetToken');


  if (!req.params.token) {
    res.status(400);
    throw new Error('Reset token is required');
  }

  // Hash the raw token using the same algorithm as in forgotPassword
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const resetToken = await PasswordResetToken.findOne({ tokenHash }).populate('userId');

  if (!resetToken || !resetToken.userId) {
    res.status(400);
    throw new Error('Invalid or expired reset token');
  }

  if (resetToken.revokedAt) {
    res.status(400);
    throw new Error('Reset token has been revoked');
  }

  if (resetToken.usedAt) {
    res.status(400);
    throw new Error('Reset token has already been used');
  }

  if (new Date() > resetToken.expiresAt) {
    res.status(400);
    throw new Error('Invalid or expired reset token');
  }

  // Update password
  const user = resetToken.userId;
  user.password = password;
  await user.save();

  // Mark token as used (single-use)
  resetToken.usedAt = new Date();
  await resetToken.save();


  const { subject, text, html } = passwordResetSuccessEmail({ firstName: user.firstName });

  await sendEmail({
    to: user.email,
    subject,
    text,
    html,
  });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
  });
});

