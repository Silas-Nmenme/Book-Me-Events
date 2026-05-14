const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getAnnouncementsForMe } = require('../controllers/announcementController');

// Protected: returns announcements for current user role
router.get('/', protect, getAnnouncementsForMe);

module.exports = router;

