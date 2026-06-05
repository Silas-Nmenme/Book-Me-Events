const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { generateAdminTotpSecret, verifyTotp, buildIssuer, buildOtpAuthUrl } = require('../utils/totpUtil');


/**
 * @desc    Setup admin TOTP (generate secret + return otpauth URL)
 * @route   GET /api/v1/admin/2fa/setup
 * @access  Private/Admin
 */
exports.setupAdmin2fa = asyncHandler(async (req, res) => {
  const adminId = req.user.id;

  const user = await User.findById(adminId);
  if (!user) {
    res.status(404);
    throw new Error('Admin not found');
  }

  // If already enabled, re-return current otpauth URL (useful for re-scanning).
  if (user.totpEnabled && user.totpSecret) {
    const issuer = buildIssuer();
    const accountName = user.email;
    const otpauth_url = buildOtpAuthUrl({
      secret: user.totpSecret,
      issuer,
      accountName,
    });

    return res.status(200).json({
      success: true,
      message: '2FA already enabled',
      data: { otpauth_url, totpEnabled: true },
    });
  }

  // Create a new secret and store it (not enabled yet).
  const issuer = buildIssuer();
  const accountName = user.email;
  const secretObj = generateAdminTotpSecret({ issuer, accountName });

  // Store base32 secret in plaintext (matches current repo approach).
  user.totpSecret = secretObj.base32;
  user.totpEnabled = false;
  user.totpVerifiedAt = undefined;
  await user.save();

  return res.status(201).json({
    success: true,
    message: '2FA setup secret created',
    data: {
      otpauth_url: secretObj.otpauth_url,
      totpEnabled: false,
    },
  });
});

/**
 * @desc    Verify first TOTP code and enable 2FA
 * @route   POST /api/v1/admin/2fa/verify
 * @access  Private/Admin
 */
exports.verifyAdmin2faSetup = asyncHandler(async (req, res) => {
  const adminId = req.user.id;
  let { totpCode } = req.body;

  if (totpCode === undefined || totpCode === null) {
    res.status(400);
    throw new Error('totpCode is required');
  }

  // Normalize/validate: frontend should send a 6-digit numeric string.
  totpCode = String(totpCode).trim();
  if (!/^\d{6}$/.test(totpCode)) {
    res.status(400);
    throw new Error(`totpCode must be a 6-digit number (received ${totpCode.length} chars)`);
  }


  const user = await User.findById(adminId);
  if (!user) {
    res.status(404);
    throw new Error('Admin not found');
  }

  if (!user.totpSecret) {
    res.status(400);
    throw new Error('2FA is not setup yet');
  }

  const verified = verifyTotp({
    secret: user.totpSecret,
    token: totpCode,
    window: 1,
  });

  if (!verified) {
    res.status(401);
    throw new Error('Invalid TOTP code');
  }

  user.totpEnabled = true;
  user.totpVerifiedAt = new Date();
  await user.save();

  return res.status(200).json({
    success: true,
    message: '2FA enabled successfully',
    data: { totpEnabled: true },
  });
});

