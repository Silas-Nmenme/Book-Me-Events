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


  // Admin + user can share the same login endpoint.
  // Some admin login UIs may send admin-specific fields; normalize them.
  const {
    email,
    password,
    adminEmail,
    adminPassword,
    username,
  } = req.body;

  // Defensive validation: prevent model-level “password is required” errors / Vercel 500s
  // when the client request arrives without a parsed JSON body.
  // NOTE: admin 2FA step may send only adminPassword/password fields.
  if (!req.body) {
    res.status(400);
    throw new Error('Invalid login request body');
  }

  // Determine effective password.
  // For admin 2FA flows, clients may send `password` with the admin password.
  const effectivePassword = password ?? adminPassword;

  // IMPORTANT: Some model methods expect a string. Force to string if present.
  const normalizedEffectivePassword =
    effectivePassword === undefined || effectivePassword === null
      ? undefined
      : effectivePassword.toString();

  const loginEmail = (email || adminEmail || '').toString().trim();

  // Validation
  // For admin accounts with 2FA enabled, the first (password) step should include a password.
  // However, the second (TOTP) step might only send totpCode + email.
  // To keep the flow working, we allow missing password here for ADMIN when totpCode is present.
  // The login will still fail with a clear 401/403 if password is truly missing when required.
  const hasTotpInBody = !!(
    (req.body &&
      (req.body.totpCode ?? req.body.otp ?? req.body.code ?? req.body.totp ?? req.body.adminTotpCode))
  );

  if (normalizedEffectivePassword === undefined) {
    // If this looks like an admin TOTP-only continuation request, skip password matching.
    // We will still generate the token after 2FA verification below.
    // (But we must not call user.matchPassword with undefined.)
    if (hasTotpInBody) {
      // loginPassword stays undefined; handled later.
    } else {
      if (process.env.NODE_ENV === 'production') {
        console.log('Login request missing password fields:', {
          keys: Object.keys(req.body || {}),
        });
      }

      res.status(400);
      throw new Error('Password is required');
    }
  }

  // Ensure we always use the validated password string for matching when provided.
  const loginPassword = normalizedEffectivePassword;

  


  // Validation
  if (!loginEmail) {
    res.status(400);
    throw new Error('Please provide email');
  }


  // Check for user
  const user = await User.findOne({
    $or: [
      { email: loginEmail.toLowerCase() },
      { username: loginEmail },
    ],
  });


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


  // Check if password matches (unless this is an ADMIN 2FA continuation request)
  if (loginPassword !== undefined) {
    // Guard against empty-string passwords triggering model-level Mongoose validation errors.
    // For ADMIN 2FA continuation requests, frontend should still send a real password.
    if (typeof loginPassword !== 'string' || loginPassword.trim() === '') {
      res.status(400);
      throw new Error('Password is required');
    }

    const isMatch = await user.matchPassword(loginPassword);


    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid credentials');
    }
  } else {
    // No password provided. This is allowed only when ADMIN has 2FA enabled,
    // and the client is continuing with a TOTP code.
    if (!(user.role === 'ADMIN' && user.totpEnabled && user.totpSecret && req.body)) {
      res.status(400);
      throw new Error('Password is required');
    }
  }


  // Remove password from response
  user.password = undefined;

  // Admin 2FA flow (EMAIL OTP instead of TOTP)
  // Requirement:
  // 1) If admin DOES NOT have 2FA enabled: allow login to proceed normally.
  // 2) If admin HAS 2FA enabled: do NOT verify TOTP here.
  //    Instead, require a second step where we send + verify an OTP via email.
  if (user.role === 'ADMIN') {
    const has2fa = !!(user.totpEnabled && user.totpSecret);

    if (has2fa) {
      // Generate + email OTP, then force frontend to a dedicated step.
      // We reuse the existing DB fields (otpCode/otpExpiresAt/otpPurpose) already used elsewhere.
      const otp = generateSixDigitOtp();
      user.otpCode = otp;
      user.otpExpiresAt = new Date(Date.now() + otpExpiryMs());
      user.otpPurpose = 'admin_login_otp';
      user.otpVerifiedAt = undefined;
      await user.save();

      try {
        const subject = `Your ${process.env.APP_NAME || 'Book Me Events'} admin login OTP`;
        const text = `Hi ${user.firstName},\n\nYour admin login OTP code is: ${otp}\nExpires in ${Number(process.env.JWT_OTP_EXPIRE_MINUTES || 10)} minutes.\n`;
        await sendEmail({
          to: user.email,
          subject,
          text,
          html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Admin OTP email failed:', err.message);
      }

      res.status(403);
      throw new Error('ADMIN_OTP_REQUIRED');
    }
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



// @desc    Admin login OTP verification
// @route   POST /api/v1/auth/admin-login-otp
// @access  Public
exports.adminLoginOtp = asyncHandler(async (req, res) => {
  const { email, password, otpCode } = req.body || {};

  if (!email || !password || !otpCode) {
    res.status(400);
    throw new Error('Email, password, and otpCode are required');
  }

  const loginEmail = email.toString().trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: loginEmail }, { username: email }],
  });

  if (!user || user.role !== 'ADMIN') {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!user.isVerified) {
    res.status(403);
    throw new Error('Account not verified. Please verify your email OTP.');
  }

  // Verify password
  if (typeof password !== 'string' || password.trim() === '') {
    res.status(400);
    throw new Error('Password is required');
  }

  const isMatch = await user.matchPassword(password.toString());
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Verify OTP
  const normalizedOtp = otpCode.toString().replace(/\D/g, '');
  if (!/^\d{6}$/.test(normalizedOtp)) {
    res.status(400);
    throw new Error('Invalid otpCode format');
  }

  if (!user.otpCode || !user.otpExpiresAt || user.otpPurpose !== 'admin_login_otp') {
    res.status(403);
    throw new Error('No admin OTP request found');
  }

  if (new Date() > user.otpExpiresAt) {
    res.status(403);
    throw new Error('OTP expired');
  }

  if (user.otpCode !== normalizedOtp) {
    res.status(401);
    throw new Error('Invalid OTP code');
  }

  user.otpVerifiedAt = new Date();
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  user.otpPurpose = undefined;
  await user.save();

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

  user.password = undefined;

  res.status(200).json({
    success: true,
    data: user,
    token,
  });
});

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

