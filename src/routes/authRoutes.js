const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  register,
  verifyOtp,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  adminLoginOtp,
} = require('../controllers/authController');

// Public routes
router.post('/register', register);
// Rate limiting is applied globally in app.js (for these endpoints).
router.post('/verify-otp', express.json(), verifyOtp);
router.post('/login', express.json(), login);
router.post('/admin-login-otp', express.json(), adminLoginOtp);



router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);


// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;


