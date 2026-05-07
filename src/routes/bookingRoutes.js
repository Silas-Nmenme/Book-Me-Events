const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  cancelBooking,
  completeBooking,
  deleteBooking,
} = require('../controllers/bookingController');

// Protected routes
router.get('/', protect, getBookings);
router.get('/:id', protect, getBooking);

// Create booking
router.post('/', protect, authorize('USER'), createBooking);

// Update booking
router.put('/:id', protect, updateBooking);

// Cancel booking
router.put('/:id/cancel', protect, cancelBooking);

// Complete booking (Vendor only)
router.put('/:id/complete', protect, authorize('VENDOR'), completeBooking);

// Delete booking
router.delete('/:id', protect, deleteBooking);

module.exports = router;
