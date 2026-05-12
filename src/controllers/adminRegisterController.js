const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailClient');
const { generateToken } = require('../utils/generateToken');

function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpExpiryMs() {
  const minutes = Number(process.env.JWT_OTP_EXPIRE_MINUTES || 10);
  return minutes * 60 * 1000;
}

async function sendAdminOtpEmail({ user }) {
  const otp = user.otpCode;
  const subject = `Your ${process.env.APP_NAME || 'Book Me Events'} OTP verification code`;
  const text = `Hi ${user.firstName},\n\nYour OTP code is: ${otp}\nThis code expires in ${Number(process.env.JWT_OTP_EXPIRE_MINUTES || 10)} minutes.\n`;

  await sendEmail({
    to: user.email,
    subject,
    text,
    html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
  });
}

// @desc    Admin Register - Page 1 (create admin user + send OTP)
// @route   POST /api/v1/admin/register/page1
// @access  Public
exports.adminRegisterPage1 = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, passwordConfirm } = req.body;

  if (!firstName || !lastName || !email || !phone || !password || !passwordConfirm) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  if (password !== passwordConfirm) {
    res.status(400);
    throw new Error('Passwords do not match');
  }

  const normalizedEmail = email.toLowerCase();
  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const user = await User.create({
    firstName,
    lastName,
    email: normalizedEmail,
    phone,
    password,
    role: 'ADMIN',
    isVerified: false,
  });

  const otp = generateSixDigitOtp();
  user.otpCode = otp;
  user.otpExpiresAt = new Date(Date.now() + otpExpiryMs());
  user.otpPurpose = 'admin_verify_email';
  user.otpVerifiedAt = undefined;
  await user.save();

  await sendAdminOtpEmail({ user });

  return res.status(201).json({
    success: true,
    message: 'OTP sent to your email',
    data: { email: user.email },
  });
});

// @desc    Admin Register - Page 2 verify OTP (issue JWT)
// @route   POST /api/v1/admin/register/page2/verify-otp
// @access  Public
exports.adminVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and OTP are required');
  }

  const user = await User.findOne({ email: email.toLowerCase(), role: 'ADMIN' });
  if (!user) {
    res.status(404);
    throw new Error('Admin account not found');
  }

  if (user.otpPurpose !== 'admin_verify_email') {
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

  const token = generateToken(user._id);
  user.password = undefined;

  return res.status(200).json({
    success: true,
    message: 'Admin email verified successfully',
    token,
    data: user,
  });
});

