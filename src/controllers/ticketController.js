const asyncHandler = require('express-async-handler');
const SupportTicket = require('../models/SupportTicket');
const { createNotification } = require('../utils/notificationService');

exports.createTicket = asyncHandler(async (req, res) => {
  const { request, booking, subject, description, priority } = req.body;

  if (!subject || !description) {
    return res.status(400).json({ success: false, message: 'subject and description are required' });
  }

  // Recommended MVP: allow linking to either/both request and booking when provided.
  const ticket = await SupportTicket.create({
    user: req.user.id,
    request: request || undefined,
    booking: booking || undefined,
    subject,
    description,
    priority: priority || undefined,
    lastUpdatedBy: req.user.id,
  });

  await createNotification({
    recipientId: req.user.id,
    type: 'TICKET_UPDATE',
    title: 'Support request received',
    message: `Your ticket "${ticket.subject}" has been submitted.`,
    link: `user-tickets.html?ticketId=${ticket._id}`,
    entityType: 'SupportTicket',
    entityId: ticket._id,
    io: req.app?.get?.('io'),
  });

  return res.status(201).json({ success: true, data: ticket });
});

exports.getMyTickets = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
  const skip = (safePage - 1) * safeLimit;

  const filter = { user: req.user.id };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('request')
      .populate('booking'),
    SupportTicket.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items,
  });
});

exports.getTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ticket = await SupportTicket.findById(id)
    .populate('request')
    .populate('booking');

  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  if (ticket.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.status(200).json({ success: true, data: ticket });
});

exports.getAllTickets = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: items, total, page, pages: Math.ceil(total / limit) });
});

exports.updateTicket = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body || {};
  const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket status' });
  }

  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        status,
        lastUpdatedBy: req.user.id,
        ...(typeof adminNotes === 'string' ? { adminNotes: adminNotes.trim().slice(0, 2000) } : {}),
      },
    },
    { new: true, runValidators: true }
  );
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

  await createNotification({
    recipientId: ticket.user,
    type: 'TICKET_UPDATE',
    title: 'Support ticket updated',
    message: `Your ticket "${ticket.subject}" is now ${status.replace('_', ' ').toLowerCase()}.`,
    link: `user-ticket-details.html?id=${ticket._id}`,
    entityType: 'SupportTicket',
    entityId: ticket._id,
    io: req.app?.get?.('io'),
    email: true,
  });
  res.status(200).json({ success: true, data: ticket });
});

