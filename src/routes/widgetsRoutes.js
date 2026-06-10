const express = require('express');
const router = express.Router();

const { protect } = require('../middlewares/authMiddleware');

const { getPlatformStats } = require('../controllers/platformStatsController');
const { getUpcomingBookings } = require('../controllers/upcomingBookingsController');
const { getPaymentsSummary } = require('../controllers/paymentsSummaryController');
const { getActivityFeed } = require('../controllers/activityFeedController');
const { getMessagesPreview } = require('../controllers/messagesPreviewController');
const { getVendorsForMap } = require('../controllers/vendorsForMapController');
const { getCompletedUnreviewedBookings } = require('../controllers/reviewNudgeBookingController');

// Public endpoints
router.get('/stats/platform', getPlatformStats);

// Authenticated widget endpoints
router.get('/bookings/upcoming', protect, getUpcomingBookings);
router.get('/payments/summary', protect, getPaymentsSummary);


// Review nudge endpoint support
router.get('/bookings', protect, (req, res, next) => {
  const { status, reviewed } = req.query;
  if (status === 'completed' && reviewed === 'false') {
    return getCompletedUnreviewedBookings(req, res, next);
  }
  return res.status(400).json({ success: false, message: 'Unsupported booking query for this endpoint' });
});

// Spec requires auth except activity-feed?public=true
router.get('/activity-feed', protect, getActivityFeed);
router.get('/messages/preview', protect, getMessagesPreview);
router.get('/preview', protect, getMessagesPreview);


// Vendors for map: spec is /api/v1/vendors?city=&category=&limit=
router.get('/vendors', protect, getVendorsForMap);



module.exports = router;


