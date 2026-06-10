const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { body } = require('express-validator');
const validateRequest = require('../middlewares/validateRequest');
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
router.get('/upcoming', protect, (req, res, next) => next());

router.get('/:id', protect, getBooking);


// Create booking with input validation
router.post(
  '/',
  protect,
  authorize('USER'),
  [
    body('request').exists().withMessage('request is required').isMongoId().withMessage('request must be a valid id'),
    body('service').optional().isMongoId().withMessage('service must be a valid id'),
    body('eventDate').optional().isISO8601().withMessage('eventDate must be a valid date'),
    body('eventLocation').exists().withMessage('eventLocation is required').isString(),
    body('totalAmount').optional().isNumeric().withMessage('totalAmount must be a number'),
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
