const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getDashboard,
  getAllUsers,
  getPendingVendors,
  getAllVendors,
  verifyVendor,
  rejectVendor,
  toggleUserStatus,
  getAllBookings,
  getAllPayments,
  getPlatformStats,
  sendAnnouncement,
  exportUsersCsv,
  exportVendorsCsv,
  exportBookingsCsv,
  exportPaymentsCsv,
  bulkToggleUserStatus,
  bulkVendorAction,
  globalSearch,
  setupAdminTwoFactor,
  verifyAdminTwoFactor,
} = require('../controllers/adminController');


// All admin routes require authentication and ADMIN role
router.use(protect, authorize('ADMIN'));

// Dashboard
router.get('/dashboard', getDashboard);

// Two-factor authentication
router.get('/2fa/setup', setupAdminTwoFactor);
router.post('/2fa/verify', verifyAdminTwoFactor);

// Global search
router.get('/search', globalSearch);

// Users management
router.get('/users', getAllUsers);
router.get('/users/export', exportUsersCsv);
router.put('/users/bulk-toggle-status', bulkToggleUserStatus);

// Vendor management
router.get('/vendors', getAllVendors);
router.get('/vendors/export', exportVendorsCsv);
router.get('/vendors/pending', getPendingVendors);
router.put('/vendors/bulk-action', bulkVendorAction);
router.put('/vendors/:id/verify', verifyVendor);
router.put('/vendors/:id/reject', rejectVendor);

// User status management
router.put('/users/:id/toggle-status', toggleUserStatus);

// Bookings
router.get('/bookings', getAllBookings);
router.get('/bookings/export', exportBookingsCsv);

// Payments
router.get('/payments', getAllPayments);
router.get('/payments/export', exportPaymentsCsv);

// Statistics
router.get('/stats', getPlatformStats);

// Announcements
router.post('/announcements', sendAnnouncement);

module.exports = router;
