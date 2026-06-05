const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');

const { getUserDashboard } = require('../controllers/userDashboardController');
const { getVendorAnalytics } = require('../controllers/vendorAnalyticsController');

// User dashboard stats (USER only)
router.get('/user', protect, authorize('USER'), getUserDashboard);

// Vendor dashboard stats (VENDOR only)
router.get('/vendor', protect, authorize('VENDOR'), getVendorAnalytics);


module.exports = router;

