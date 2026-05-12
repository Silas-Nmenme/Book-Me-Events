const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorServices,
  getVendorBookings,
  getVendorReviews,
} = require('../controllers/vendorController');

// Public routes
router.get('/', getVendors);
router.get('/:id', getVendor);
router.get('/:id/services', getVendorServices);
router.get('/:id/reviews', getVendorReviews);

// Protected routes (Vendor only)
router.post('/', protect, authorize('VENDOR'), createVendor);
router.put('/:id', protect, updateVendor);
router.delete('/:id', protect, deleteVendor);
router.get('/:id/bookings', protect, getVendorBookings);

module.exports = router;
