const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { createUserReport } = require('../controllers/userReportController');

router.post('/', protect, authorize('USER', 'VENDOR'), createUserReport);

module.exports = router;
