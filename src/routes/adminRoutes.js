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
} = require('../controllers/adminController');


// All admin routes require authentication and ADMIN role
router.use(protect, authorize('ADMIN'));

// Dashboard
router.get('/dashboard', getDashboard);

// Users management
router.get('/users', getAllUsers);

// Vendor management
router.get('/vendors', getAllVendors);
router.get('/vendors/pending', getPendingVendors);
router.put('/vendors/:id/verify', verifyVendor);
router.put('/vendors/:id/reject', rejectVendor);

// User status management
router.put('/users/:id/toggle-status', toggleUserStatus);

// Bookings
router.get('/bookings', getAllBookings);

// Payments
router.get('/payments', getAllPayments);

// Statistics
router.get('/stats', getPlatformStats);

// Announcements
router.post('/announcements', sendAnnouncement);

module.exports = router;
