const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { messageLimiter } = require('../middlewares/rateLimiters');
const {
  getMessages,
  getConversation,
  getConversationByRequestId,
  sendMessage,
  sendMessageByRequestId,
  getMessage,
  deleteMessage,
  getUnreadCount,
  markAsRead,
} = require('../controllers/messageController');

const { getMessagesPreview } = require('../controllers/messagesPreviewController');



// Protected routes
router.get('/', protect, getMessages);
router.get('/unread/count', protect, getUnreadCount);
router.get('/conversation/:userId', protect, getConversation);
router.get('/preview', protect, getMessagesPreview);


// NOTE: keep ':id' after fixed string routes to avoid treating reserved path segments
router.get('/:id', protect, getMessage);



// Send message with rate limiting
router.post('/', protect, messageLimiter, sendMessage);

// Request-based conversation messaging with rate limiting
router.get('/request/:requestId', protect, getConversationByRequestId);
router.post('/request/:requestId', protect, messageLimiter, sendMessageByRequestId);

// Mark as read
router.put('/:id/read', protect, markAsRead);


// Delete message
router.delete('/:id', protect, deleteMessage);

module.exports = router;
