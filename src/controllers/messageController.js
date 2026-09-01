const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const { validatePagination, sanitizeString } = require('../utils/inputValidator');

// @desc    Get all messages for user
// @route   GET /api/v1/messages
// @access  Private
exports.getMessages = asyncHandler(async (req, res) => {
  const { conversation, page = 1, limit = 20 } = req.query;

  // Validate pagination
  const paginationVal = validatePagination(page, limit, 50);
  if (!paginationVal.valid) {
    res.status(400);
    throw new Error(paginationVal.error);
  }
  const { page: pageNum, limit: limitNum } = paginationVal.value;

  let filter = {
    $or: [{ sender: req.user.id }, { recipient: req.user.id }],
  };

  if (conversation) {
    filter.conversationId = conversation;
  }

  const skip = (pageNum - 1) * limitNum;

  const messages = await Message.find(filter)
    .populate('sender', 'firstName lastName profilePicture')
    .populate('recipient', 'firstName lastName profilePicture')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Message.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: messages,
  });
});

// @desc    Get conversation with a user
// @route   GET /api/v1/messages/conversation/:userId
// @access  Private
exports.getConversation = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  // Validate pagination
  const paginationVal = validatePagination(page, limit, 50);
  if (!paginationVal.valid) {
    res.status(400);
    throw new Error(paginationVal.error);
  }
  const { page: pageNum, limit: limitNum } = paginationVal.value;

  const skip = (pageNum - 1) * limitNum;

  const messages = await Message.find({
    $or: [
      { sender: req.user.id, recipient: req.params.userId },
      { sender: req.params.userId, recipient: req.user.id },
    ],
  })
    .populate('sender', 'firstName lastName profilePicture')
    .populate('recipient', 'firstName lastName profilePicture')
    .skip(skip)
    .limit(limitNum)
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

  const total = await Message.countDocuments({
    $or: [
      { sender: req.user.id, recipient: req.params.userId },
      { sender: req.params.userId, recipient: req.user.id },
    ],
  });

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: messages,
  });
});

// @desc    Get messages for a request conversation (user/vendor)
// @route   GET /api/v1/messages/request/:requestId
// @access  Private
exports.getConversationByRequestId = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const { requestId } = req.params;

  // Validate pagination
  const paginationVal = validatePagination(page, limit, 50);
  if (!paginationVal.valid) {
    res.status(400);
    throw new Error(paginationVal.error);
  }
  const { page: pageNum, limit: limitNum } = paginationVal.value;

  const skip = (pageNum - 1) * limitNum;

  // Only allow members of the request to access its messages.
  // Request belongs to a USER (req.user.id) and a VENDOR (request.vendor). Vendor's owner is resolved below.
  const Request = require('../models/Request');
  const Vendor = require('../models/Vendor');

  const request = await Request.findById(requestId).populate('user', '_id');
  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  const userId = request.user._id.toString();

  // Resolve vendor owner user id if needed.
  let vendorUserId = '';
  if (request.vendor) {
    const vendor = await Vendor.findById(request.vendor).populate('user', '_id');
    vendorUserId = vendor?.user?._id?.toString?.() || vendor?.user?.toString?.() || '';
  }

  const myId = req.user.id.toString();
  const isParticipant = myId === userId || (vendorUserId && myId === vendorUserId);
  if (!isParticipant) {
    res.status(403);
    throw new Error('Not authorized to view this request conversation');
  }

  const otherUserId = myId === userId ? vendorUserId : userId;

  const messages = await Message.find({
    $or: [
      { sender: req.user.id, recipient: otherUserId },
      { sender: otherUserId, recipient: req.user.id },
    ],
    request: requestId,
  })
    .populate('sender', 'firstName lastName profilePicture')
    .populate('recipient', 'firstName lastName profilePicture')
    .populate('booking')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: 1 });

  // Mark as read for the current recipient.
  await Message.updateMany(
    {
      recipient: req.user.id,
      sender: otherUserId,
      isRead: false,
      request: requestId,
    },
    { isRead: true, readAt: new Date() }
  );

  const total = await Message.countDocuments({
    $or: [
      { sender: req.user.id, recipient: otherUserId },
      { sender: otherUserId, recipient: req.user.id },
    ],
    request: requestId,
  });

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: messages,
  });
});

// @desc    Send message tied to a request conversation
// @route   POST /api/v1/messages/request/:requestId
// @access  Private
exports.sendMessageByRequestId = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { messageContent, attachments, subject, booking } = req.body;

  const mongoose = require('mongoose');

  if (!messageContent) {
    res.status(400);
    throw new Error('Message content is required');
  }

  const Request = require('../models/Request');
  const Vendor = require('../models/Vendor');

  const request = await Request.findById(requestId).populate('user', '_id');
  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  const myId = req.user.id.toString();
  const userId = request.user._id.toString();

  let vendorUserId = '';
  if (request.vendor) {
    const vendor = await Vendor.findById(request.vendor).populate('user', '_id');
    vendorUserId = vendor?.user?._id?.toString?.() || vendor?.user?.toString?.() || '';
  }

  const isParticipant = myId === userId || (vendorUserId && myId === vendorUserId);
  if (!isParticipant) {
    res.status(403);
    throw new Error('Not authorized to send messages on this request');
  }

  const recipient = myId === userId ? vendorUserId : userId;

  const message = await Message.create({
    sender: req.user.id,
    recipient,
    request: requestId,
    booking,
    subject,
    messageContent,
    attachments,
    conversationId: `${myId}-${recipient}`,
  });

  const io = req.app?.get?.('io');
  if (io) {
    const payload = {
      _id: message._id,
      sender: req.user.id,
      recipient,
      booking,
      subject,
      messageContent,
      attachments,
      createdAt: message.createdAt,
      // Used by request-based chat UIs to filter real-time updates.
      request: requestId,
    };

    io.to(`user:${req.user.id}`).emit('message:new', payload);
    io.to(`user:${recipient}`).emit('message:new', payload);
  }


  const populatedMessage = await message.populate([
    { path: 'sender', select: 'firstName lastName profilePicture' },
    { path: 'recipient', select: 'firstName lastName profilePicture' },
    { path: 'booking' },
  ]);

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: populatedMessage,
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

  const mongoose = require('mongoose');

  if (!messageContent) {
    res.status(400);
    throw new Error('Message content is required');
  }

  if (!recipient) {
    res.status(400);
    throw new Error('Recipient is required');
  }

  if (!mongoose.Types.ObjectId.isValid(recipient)) {
    res.status(400);
    throw new Error('Recipient must be a valid userId');
  }

  if (attachments && !Array.isArray(attachments)) {
    res.status(400);
    throw new Error('attachments must be an array');
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

  // Emit real-time event to both participants (if socket.io is attached)
  const io = req.app?.get?.('io');
  if (io) {
    const payload = {
      _id: message._id,
      sender: req.user.id,
      recipient,
      booking,
      subject,
      messageContent,
      attachments,
      createdAt: message.createdAt,
    };

    io.to(`user:${req.user.id}`).emit('message:new', payload);
    io.to(`user:${recipient}`).emit('message:new', payload);
  }

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
