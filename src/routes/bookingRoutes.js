const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { body } = require('express-validator');
const validateRequest = require('../middlewares/validateRequest');
const { bookingCreationLimiter } = require('../middlewares/rateLimiters');
const {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  cancelBooking,
  completeBooking,
  deleteBooking,
} = require('../controllers/bookingController');
const { getUpcomingBookings } = require('../controllers/upcomingBookingsController');

// Protected routes
router.get('/', protect, getBookings);
// Explicit /upcoming endpoint to avoid "upcoming" being treated as :id.
router.get('/upcoming', protect, getUpcomingBookings);
router.get('/:id', protect, getBooking);


// Create booking with input validation and rate limiting
router.post(
  '/',
  protect,
  authorize('USER'),
  bookingCreationLimiter,
  [
    body('request').exists().withMessage('request is required').isMongoId().withMessage('request must be a valid id'),
    body('service').optional().isMongoId().withMessage('service must be a valid id'),
    body('eventDate').optional().isISO8601().withMessage('eventDate must be a valid date'),
    body('eventLocation').exists().withMessage('eventLocation is required').isString(),
    body('totalAmount').exists().withMessage('totalAmount is required').isNumeric().withMessage('totalAmount must be a number'),
    body('specialRequests').optional().isString(),
  ],
  validateRequest,
  createBooking
);

// Update booking
router.put('/:id', protect, updateBooking);

// Cancel booking
router.put('/:id/cancel', protect, cancelBooking);

// Complete booking (Vendor only)
router.put('/:id/complete', protect, authorize('VENDOR'), completeBooking);

// Delete booking
router.delete('/:id', protect, deleteBooking);

module.exports = router;
