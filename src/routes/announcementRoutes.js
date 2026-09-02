const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
	markAnnouncementRead,
	getMyAnnouncements,
} = require('../controllers/announcementReadController');

// Protected: returns announcements for current user role
router.get('/', protect, authorize('USER', 'VENDOR'), getMyAnnouncements);
router.post('/:id/read', protect, authorize('USER', 'VENDOR'), markAnnouncementRead);

module.exports = router;

