const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/uploadMiddleware');
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
router.post('/', protect, authorize('VENDOR'), upload.array('images', 6), createService);
router.put('/:id', protect, authorize('VENDOR'), upload.array('images', 6), updateService);
router.delete('/:id', protect, authorize('VENDOR'), deleteService);

module.exports = router;
