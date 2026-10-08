const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadEvidence } = require('../middlewares/uploadMiddleware');
const { uploadLimiter } = require('../middlewares/rateLimiters');
const { getReportVendors, createUserReport } = require('../controllers/userReportController');

router.get('/vendors', protect, authorize('USER'), getReportVendors);
router.post('/', protect, authorize('USER', 'VENDOR'), uploadLimiter, uploadEvidence('evidence'), createUserReport);

module.exports = router;
