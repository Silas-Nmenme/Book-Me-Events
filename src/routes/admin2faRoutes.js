const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  setupAdmin2fa,
  verifyAdmin2faSetup,
} = require('../controllers/admin2faController.js');

// Setup routes require an authenticated ADMIN (so only admins can setup their own 2FA).
router.use(protect, authorize('ADMIN'));

// Generate an otpauth:// URI (used to render QR on frontend) and create secret on server.
router.get('/2fa/setup', setupAdmin2fa);

// Verify first TOTP code for activation.
router.post('/2fa/verify', verifyAdmin2faSetup);

module.exports = router;

