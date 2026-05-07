const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');

// @desc    Get all messages for user
// @route   GET /api/v1/messages
// @access  Private
exports.getMessages = asyncHandler(async (req, res) => {
  const { conversation, page = 1, limit = 20 } = req.query;

  let filter = {
    $or: [{ sender: req.user.id }, { recipient: req.user.id }],
  };

  if (conversation) {
    filter.conversationId = conversation;
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find(filter)
    .populate('sender', 'firstName lastName profilePicture')
    .populate('recipient', 'firstName lastName profilePicture')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Message.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: messages,
  });
});

// @desc    Get conversation with a user
// @route   GET /api/v1/messages/conversation/:userId
// @access  Private
exports.getConversation = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (page - 1) * limit;

  const messages = await Message.find({
    $or: [
      { sender: req.user.id, recipient: req.params.userId },
      { sender: req.params.userId, recipient: req.user.id },
    ],
  })
    .populate('sender', 'firstName lastName profilePicture')
    .populate('recipient', 'firstName lastName profilePicture')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: 1 });

  // Mark messages as read
  await Message.updateMany(
    {
      recipient: req.user.id,
      sender: req.params.userId,
      isRead: false,
    },
    { isRead: true, readAt: new Date() }
  );

  res.status(200).json({
    success: true,
    count: messages.length,
    data: messages,
  });
});

// @desc    Send message
// @route   POST /api/v1/messages
// @access  Private
exports.sendMessage = asyncHandler(async (req, res) => {
  const {
    recipient,
    booking,
    subject,
    messageContent,
    attachments,
    conversationId,
  } = req.body;

  if (!messageContent) {
    res.status(400);
    throw new Error('Message content is required');
  }

  if (!recipient) {
    res.status(400);
    throw new Error('Recipient is required');
  }

  const message = await Message.create({
    sender: req.user.id,
    recipient,
    booking,
    subject,
    messageContent,
    attachments,
    conversationId: conversationId || `${req.user.id}-${recipient}`,
  });

  const populatedMessage = await message.populate([
    { path: 'sender', select: 'firstName lastName profilePicture' },
    { path: 'recipient', select: 'firstName lastName profilePicture' },
  ]);

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: populatedMessage,
  });
});

// @desc    Get single message
// @route   GET /api/v1/messages/:id
// @access  Private
exports.getMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id)
    .populate('sender', 'firstName lastName profilePicture')
    .populate('recipient', 'firstName lastName profilePicture')
    .populate('booking');

  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  // Mark as read if recipient
  if (message.recipient._id.toString() === req.user.id) {
    message.isRead = true;
    message.readAt = new Date();
    await message.save();
  }

  res.status(200).json({
    success: true,
    data: message,
  });
});

// @desc    Delete message
// @route   DELETE /api/v1/messages/:id
// @access  Private
exports.deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  // Check if user is sender or recipient
  if (message.sender.toString() !== req.user.id && message.recipient.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to delete this message');
  }

  await Message.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Message deleted successfully',
  });
});

// @desc    Get unread messages count
// @route   GET /api/v1/messages/unread/count
// @access  Private
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Message.countDocuments({
    recipient: req.user.id,
    isRead: false,
  });

  res.status(200).json({
    success: true,
    unreadCount,
  });
});

// @desc    Mark message as read
// @route   PUT /api/v1/messages/:id/read
// @access  Private
exports.markAsRead = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  if (message.recipient.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to mark this message as read');
  }

  message.isRead = true;
  message.readAt = new Date();
  await message.save();

  res.status(200).json({
    success: true,
    message: 'Message marked as read',
    data: message,
  });
});
