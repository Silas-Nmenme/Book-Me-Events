const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserBookings,
  getUserRequests,
} = require('../controllers/userController');
const {
  getFavoriteVendors,
  addFavoriteVendor,
  removeFavoriteVendor,
} = require('../controllers/favoriteVendorController');

router.get('/me/favorites', protect, authorize('USER'), getFavoriteVendors);
router.post('/me/favorites/:vendorId', protect, authorize('USER'), addFavoriteVendor);
router.delete('/me/favorites/:vendorId', protect, authorize('USER'), removeFavoriteVendor);

// Get current user
router.get('/:id', protect, apiLimiter, getUser);

// Update user profile
router.put('/:id', protect, apiLimiter, updateUser);

// Delete user account
router.delete('/:id', protect, apiLimiter, deleteUser);

// Get user bookings
router.get('/:id/bookings', protect, apiLimiter, getUserBookings);

// Get user requests
router.get('/:id/requests', protect, apiLimiter, getUserRequests);

// Admin routes
router.get('/', protect, authorize('ADMIN'), apiLimiter, getUsers);

module.exports = router;
