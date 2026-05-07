const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
} = require('../controllers/serviceController');

// Public routes
router.get('/', getServices);
router.get('/:id', getService);

// Protected routes (Vendor only)
router.post('/', protect, authorize('VENDOR'), createService);
router.put('/:id', protect, authorize('VENDOR'), updateService);
router.delete('/:id', protect, authorize('VENDOR'), deleteService);

module.exports = router;
