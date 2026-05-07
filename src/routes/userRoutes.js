const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserBookings,
  getUserRequests,
} = require('../controllers/userController');

// Get current user
router.get('/:id', protect, getUser);

// Update user profile
router.put('/:id', protect, updateUser);

// Delete user account
router.delete('/:id', protect, deleteUser);

// Get user bookings
router.get('/:id/bookings', protect, getUserBookings);

// Get user requests
router.get('/:id/requests', protect, getUserRequests);

// Admin routes
router.get('/', protect, authorize('ADMIN'), getUsers);

module.exports = router;
