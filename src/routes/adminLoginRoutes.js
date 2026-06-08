const express = require('express');
const router = express.Router();

const {
  startAdminLoginOtp,
  verifyAdminLoginOtp,
} = require('../controllers/adminLoginController');

// Start email OTP for admin login (email/password -> send OTP)
router.post('/login/start-otp', startAdminLoginOtp);

// Verify email OTP and issue JWT
router.post('/login/verify-otp', verifyAdminLoginOtp);

module.exports = router;

