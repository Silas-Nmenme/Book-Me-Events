const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const crypto = require('crypto');

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Server misconfiguration: ${name} is missing`);
  }
  return process.env[name];
}

// ─── STEP 1: Validate email + password ───────────────────────────────────────
exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  const normalizedEmail = normalizeEmail(email);
  const rawPassword = password.toString();

  const admin = await User.findOne({ email: normalizedEmail });

  if (!admin || admin.role !== 'ADMIN') {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  const isMatch = await bcrypt.compare(rawPassword, admin.password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Generate short-lived temp token (valid 5 minutes)
  const tempToken = crypto.randomBytes(32).toString('hex');
  admin.tempToken = tempToken;
  admin.tempTokenExpiry = new Date(Date.now() + 5 * 60 * 1000);
  await admin.save();

  return res.status(200).json({
    success: true,
    requiresTOTP: true,
    adminToken: tempToken,
    email: admin.email,
  });
});

// ─── STEP 2: Validate TOTP code ───────────────────────────────────────────────
exports.verifyAdminTotp = asyncHandler(async (req, res) => {
  const { tempToken, totp } = req.body || {};

  if (!tempToken || !totp) {
    return res.status(400).json({
      success: false,
      message: 'Temp token and TOTP code are required',
    });
  }

  const admin = await User.findOne({
    role: 'ADMIN',
    tempToken,
    tempTokenExpiry: { $gt: new Date() },
  });

  if (!admin) {
    return res.status(401).json({
      success: false,
      message: 'Session expired. Please login again.',
    });
  }

  const isValidTotp = speakeasy.totp.verify({
    secret: admin.totpSecret,
    encoding: 'base32',
    token: totp.toString().trim(),
    window: 1,
  });

  if (!isValidTotp) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired TOTP code',
    });
  }

  // Clear temp token
  admin.tempToken = null;
  admin.tempTokenExpiry = null;
  await admin.save();

  const JWT_SECRET = requireEnv('JWT_SECRET');
  const token = jwt.sign(
    { id: admin._id, role: admin.role, email: admin.email },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.status(200).json({
    success: true,
    token,
    admin: {
      id: admin._id,
      email: admin.email,
      role: admin.role,
    },
  });
});

