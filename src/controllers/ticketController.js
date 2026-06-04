const asyncHandler = require('express-async-handler');
const SupportTicket = require('../models/SupportTicket');

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

