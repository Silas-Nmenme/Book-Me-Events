const asyncHandler = require('express-async-handler');

const Message = require('../models/Message');

exports.getMessagesPreview = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // last message per conversationId-like pairing: sender/recipient pair.
  // Simplify: derive key by unordered pair.
  const messages = await Message.find({
    $or: [
      { sender: userId },
      { recipient: userId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('sender', 'firstName lastName profilePicture')
    .populate('recipient', 'firstName lastName profilePicture');

  const seen = new Set();
  const threads = [];

  for (const m of messages) {
    const senderId = String(m.sender._id);
    const recipientId = String(m.recipient._id);
    const otherUserId = senderId === String(userId) ? recipientId : senderId;
    const key = [senderId, recipientId].sort().join(':');
    if (seen.has(key)) continue;
    seen.add(key);

    const other = senderId === String(userId) ? m.recipient : m.sender;
    const lastMessage = {
      content: m.messageContent,
      createdAt: m.createdAt,
    };

    const unreadCount = await Message.countDocuments({
      recipient: userId,
      sender: otherUserId,
      isRead: false,
    });

    threads.push({
      vendor: {
        _id: other._id,
        name: `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'Vendor',
        profilePicture: other.profilePicture,
      },
      vendorId: other._id,
      otherUserId,
      conversationId: m.conversationId,
      lastMessage,
      unreadCount,
    });

    if (threads.length >= 3) break;
  }

  return res.status(200).json({ success: true, data: { threads }, message: 'Message preview fetched' });
});

