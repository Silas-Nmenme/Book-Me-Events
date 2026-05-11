const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { sendVerificationEmail } = require('../controllers/verifyEmailController');


// Public routes
router.post('/register', register);
router.post('/login', express.json(), login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);


// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.post('/verify-email', protect, verifyEmail);
router.post('/send-verification-email', protect, sendVerificationEmail);


module.exports = router;

