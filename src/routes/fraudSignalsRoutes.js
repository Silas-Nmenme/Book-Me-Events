const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { getFraudSignals } = require('../controllers/fraudSignalsController');

// Admin-only fraud signals
router.get('/signals', protect, authorize('ADMIN'), getFraudSignals);

module.exports = router;

