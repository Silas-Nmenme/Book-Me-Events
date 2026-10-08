const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadEvidence } = require('../middlewares/uploadMiddleware');
const { uploadLimiter } = require('../middlewares/rateLimiters');
const {
  createTicket,
  getMyTickets,
  getTicket,
  replyToTicket,
  closeTicket,
} = require('../controllers/ticketController');

router.post('/', protect, authorize('USER', 'VENDOR'), uploadLimiter, uploadEvidence('attachments'), createTicket);
router.get('/me', protect, authorize('USER', 'VENDOR'), getMyTickets);
router.post('/:id/replies', protect, authorize('USER', 'VENDOR', 'ADMIN'), uploadLimiter, uploadEvidence('attachments'), replyToTicket);
router.put('/:id/close', protect, authorize('USER', 'VENDOR', 'ADMIN'), closeTicket);
router.get('/:id', protect, authorize('USER', 'VENDOR', 'ADMIN'), getTicket);

module.exports = router;

