const express = require('express');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { getAuditEvents } = require('../controllers/adminAuditController');

const router = express.Router();

// Admin-only audit read
router.get('/audit', protect, authorize('ADMIN'), getAuditEvents);

module.exports = router;

