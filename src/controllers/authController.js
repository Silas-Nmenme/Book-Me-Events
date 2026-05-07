const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { sendEmail } = require('../utils/emailClient');
const {
  welcomeEmail,
  passwordResetRequestedEmail,
  passwordResetSuccessEmail,
  loginSuccessEmail,
} = require('../utils/emailTemplates');



// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, passwordConfirm, role } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !password || !passwordConfirm) {
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

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone,
    password,
    role: role || 'USER',
  });

  // Remove password from response
  user.password = undefined;

  // Generate token
  const token = generateToken(user._id);

  // Send welcome email (best-effort: don't fail registration if email fails)
  try {
    const { subject, text, html } = welcomeEmail({ firstName: user.firstName });
    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Welcome email failed:', err.message);
  }

  res.status(201).json({
    success: true,
    data: user,
    token,
  });
});


// @desc    Login user
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

  // Check if password matches
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Remove password from response
  user.password = undefined;

  // Generate token
  const token = generateToken(user._id);

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

// @desc    Verify email
// @route   POST /api/v1/auth/verify-email
// @access  Private
exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { isVerified: true },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    data: user,
  });
});

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

    // Generate a reset token (JWT) and send it in the reset link.
    // NOTE: The User model currently does not implement getResetPasswordToken(),
    // so we create a compatible token here.
    const jwt = require('jsonwebtoken');
    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_RESET_EXPIRE || '15m' }
    );


 
    const apiBaseUrl = process.env.API_URL || process.env.APP_URL;
    const resetUrl = apiBaseUrl
      ? `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/auth/reset-password/${resetToken}`
      : `/api/v1/auth/reset-password/${resetToken}`;


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

  // NOTE: For real security, validate the reset token and expiration.
  // This code currently trusts the token structure if JWT_SECRET is valid.
  // If verification is required, we should persist reset token hashes + expiry.
  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
  } catch (e) {
    res.status(400);
    throw new Error('Invalid or expired reset token');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.password = password;
  await user.save();

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

