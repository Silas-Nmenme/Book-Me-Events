const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getMyActivity,
  getMyBookingTracking,
} = require('../controllers/userActivityController');

// USER activity only
router.get('/activity', protect, authorize('USER'), getMyActivity);
router.get('/bookings/tracking', protect, authorize('USER'), getMyBookingTracking);

module.exports = router;

