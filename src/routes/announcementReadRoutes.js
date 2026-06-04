const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  markAnnouncementRead,
  getMyAnnouncements,
} = require('../controllers/announcementReadController');

router.post('/:id/read', protect, authorize('USER', 'VENDOR'), markAnnouncementRead);
router.get('/', protect, authorize('USER', 'VENDOR'), getMyAnnouncements);

module.exports = router;

