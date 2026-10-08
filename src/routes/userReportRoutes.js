const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadEvidence } = require('../middlewares/uploadMiddleware');
const { uploadLimiter } = require('../middlewares/rateLimiters');
const { getReportVendors, getReportUsers, createUserReport } = require('../controllers/userReportController');

router.get('/vendors', protect, authorize('USER'), getReportVendors);
router.get('/users', protect, authorize('VENDOR'), getReportUsers);
router.post('/', protect, authorize('USER', 'VENDOR'), uploadLimiter, uploadEvidence('evidence'), createUserReport);

module.exports = router;
