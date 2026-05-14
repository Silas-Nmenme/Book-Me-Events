const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
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


// Protected routes
router.get('/', protect, getMessages);
router.get('/unread/count', protect, getUnreadCount);
router.get('/conversation/:userId', protect, getConversation);
router.get('/:id', protect, getMessage);

// Send message
router.post('/', protect, sendMessage);

// Request-based conversation messaging
router.get('/request/:requestId', protect, getConversationByRequestId);
router.post('/request/:requestId', protect, sendMessageByRequestId);

// Mark as read
router.put('/:id/read', protect, markAsRead);


// Delete message
router.delete('/:id', protect, deleteMessage);

module.exports = router;
