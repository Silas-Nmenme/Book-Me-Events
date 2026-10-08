const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Request = require('../models/Request');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { cloudinary } = require('../config/cloudinary');
const { uploadEvidenceFiles, deleteEvidenceAssets } = require('../utils/evidenceUploader');
const { createNotification } = require('../utils/notificationService');

const CATEGORIES = ['GENERAL', 'ACCOUNT', 'BOOKING', 'PAYMENT', 'SERVICE', 'TECHNICAL', 'OTHER'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

async function getVendorProfile(userId) {
  return Vendor.findOne({ user: userId }).select('_id user');
}

async function canAccessTicket(ticket, user) {
  if (user.role === 'ADMIN' || String(ticket.user) === String(user.id)) return true;
  if (user.role !== 'VENDOR') return false;
  const vendor = await getVendorProfile(user.id);
  if (!vendor) return false;
  if (ticket.vendor && String(ticket.vendor) === String(vendor._id)) return true;
  if (ticket.request && await Request.exists({ _id: ticket.request, vendor: vendor._id })) return true;
  return !!(ticket.booking && await Booking.exists({ _id: ticket.booking, vendor: vendor._id }));
}

function signedAssets(assets = []) {
  return assets.map((asset) => ({
    ...asset.toObject?.() || asset,
    url: cloudinary.url(asset.publicId, {
      resource_type: asset.resourceType,
      type: 'authenticated',
      sign_url: true,
      secure: true,
    }),
  }));
}

function serializeTicket(ticket, viewerRole) {
  const data = ticket.toObject ? ticket.toObject() : ticket;
  data.attachments = signedAssets(data.attachments);
  data.updates = (data.updates || []).map((update) => ({
    ...update,
    attachments: signedAssets(update.attachments),
  }));
  if (viewerRole !== 'ADMIN') delete data.adminNotes;
  return data;
}

async function notifyTicketParticipants(ticket, req, message) {
  const actorId = String(req.user.id);
  const recipients = new Set();
  if (String(ticket.user) !== actorId) recipients.add(String(ticket.user));
  if (ticket.vendor) {
    const vendor = await Vendor.findById(ticket.vendor).select('user');
    if (vendor?.user && String(vendor.user) !== actorId) recipients.add(String(vendor.user));
  }
  if (String(ticket.user) === actorId && req.user.role !== 'ADMIN') {
    const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id');
    admins.forEach((admin) => recipients.add(String(admin._id)));
  }
  await Promise.all([...recipients].map((recipientId) => createNotification({
    recipientId,
    type: 'TICKET_UPDATE',
    title: `Support ticket ${ticket.status.toLowerCase().replaceAll('_', ' ')}`,
    message,
    link: req.user.role === 'VENDOR' ? `vendor-ticket-details.html?id=${ticket._id}` : `user-ticket-details.html?id=${ticket._id}`,
    entityType: 'SupportTicket',
    entityId: ticket._id,
    io: req.app?.get?.('io'),
  })));
}

exports.createTicket = asyncHandler(async (req, res) => {
  const {
    request: requestId,
    booking: bookingId,
    payment: paymentId,
    subject: rawSubject,
    description: rawDescription,
    category = 'GENERAL',
    priority = 'MEDIUM',
  } = req.body || {};
  const subject = typeof rawSubject === 'string' ? rawSubject.trim() : '';
  const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
  if (subject.length < 3 || subject.length > 140 || description.length < 10 || description.length > 5000) {
    return res.status(400).json({ success: false, message: 'Subject must be 3-140 characters and description 10-5000 characters' });
  }
  if (!CATEGORIES.includes(category) || !PRIORITIES.includes(priority)) {
    return res.status(400).json({ success: false, message: 'Select a valid category and priority' });
  }
  for (const id of [requestId, bookingId, paymentId].filter(Boolean)) {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Related record ID is invalid' });
  }

  const vendorProfile = req.user.role === 'VENDOR' ? await getVendorProfile(req.user.id) : null;
  if (req.user.role === 'VENDOR' && !vendorProfile) {
    return res.status(403).json({ success: false, message: 'Vendor profile not found' });
  }
  const requestFilter = req.user.role === 'VENDOR'
    ? { _id: requestId, vendor: vendorProfile?._id }
    : { _id: requestId, user: req.user.id };
  const bookingFilter = req.user.role === 'VENDOR'
    ? { _id: bookingId, vendor: vendorProfile?._id }
    : { _id: bookingId, user: req.user.id };
  const paymentFilter = req.user.role === 'VENDOR'
    ? { _id: paymentId, vendor: vendorProfile?._id }
    : { _id: paymentId, user: req.user.id };
  const [request, booking, payment] = await Promise.all([
    requestId ? Request.findOne(requestFilter).select('_id vendor booking user') : null,
    bookingId ? Booking.findOne(bookingFilter).select('_id vendor request user') : null,
    paymentId ? Payment.findOne(paymentFilter).select('_id vendor booking user') : null,
  ]);
  if (requestId && !request) return res.status(400).json({ success: false, message: 'Request is not related to your account' });
  if (bookingId && !booking) return res.status(400).json({ success: false, message: 'Booking is not related to your account' });
  if (paymentId && !payment) return res.status(400).json({ success: false, message: 'Payment is not related to your account' });
  const vendorIds = [request?.vendor, booking?.vendor, payment?.vendor].filter(Boolean).map(String);
  if (new Set(vendorIds).size > 1) return res.status(400).json({ success: false, message: 'Related records must belong to the same vendor' });
  if (request && booking && String(request._id) !== String(booking.request)) {
    return res.status(400).json({ success: false, message: 'Request and booking are not related' });
  }
  if (payment && booking && String(payment.booking) !== String(booking._id)) {
    return res.status(400).json({ success: false, message: 'Payment and booking are not related' });
  }
  if (payment && request && !await Booking.exists({ _id: payment.booking, request: request._id, vendor: request.vendor })) {
    return res.status(400).json({ success: false, message: 'Payment and request are not related' });
  }

  const ticketVendor = vendorProfile?._id || request?.vendor || booking?.vendor || payment?.vendor;
  const ticket = new SupportTicket({
    user: req.user.id,
    vendor: ticketVendor,
    creatorRole: req.user.role,
    request: request?._id,
    booking: booking?._id,
    payment: payment?._id,
    subject,
    category,
    description,
    priority,
    lastUpdatedBy: req.user.id,
  });
  let uploadedAssets = [];
  try {
    uploadedAssets = await uploadEvidenceFiles(Array.isArray(req.files) ? req.files : [], `support_tickets/${ticket._id}`);
    ticket.attachments = uploadedAssets;
    ticket.updates.push({ author: req.user.id, authorRole: req.user.role, message: description, attachments: uploadedAssets, status: 'OPEN' });
    await ticket.save();
  } catch (error) {
    await deleteEvidenceAssets(uploadedAssets);
    throw error;
  }

  await notifyTicketParticipants(ticket, req, `Support ticket "${ticket.subject}" has been submitted.`);
  return res.status(201).json({ success: true, data: serializeTicket(ticket, req.user.role) });
});

exports.getMyTickets = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  if (status && !STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid ticket status' });
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
      .populate('booking')
      .populate('payment'),
    SupportTicket.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items.map((item) => serializeTicket(item, req.user.role)),
  });
});

exports.getTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ticket = await SupportTicket.findById(id)
    .populate('request')
    .populate('booking')
    .populate('payment')
    .populate('updates.author', 'firstName lastName role');

  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  if (!(await canAccessTicket(ticket, req.user))) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.status(200).json({ success: true, data: serializeTicket(ticket, req.user.role) });
});

exports.replyToTicket = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
  }
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 2 || message.length > 5000) {
    return res.status(400).json({ success: false, message: 'Reply must be 2-5000 characters' });
  }
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  if (!(await canAccessTicket(ticket, req.user))) {
    return res.status(403).json({ success: false, message: 'Not authorized to reply to this ticket' });
  }
  if (ticket.status === 'CLOSED') {
    return res.status(409).json({ success: false, message: 'Closed tickets cannot receive replies' });
  }

  let attachments = [];
  try {
    attachments = await uploadEvidenceFiles(Array.isArray(req.files) ? req.files : [], `support_tickets/${ticket._id}/replies`);
    const isOwner = String(ticket.user) === String(req.user.id);
    ticket.status = isOwner ? 'OPEN' : 'WAITING_RESPONSE';
    ticket.lastUpdatedBy = req.user.id;
    ticket.updates.push({
      author: req.user.id,
      authorRole: req.user.role,
      message,
      attachments,
      status: ticket.status,
    });
    await ticket.save();
  } catch (error) {
    await deleteEvidenceAssets(attachments);
    throw error;
  }

  await notifyTicketParticipants(ticket, req, `A reply was added to support ticket "${ticket.subject}".`);
  res.status(201).json({ success: true, data: serializeTicket(ticket, req.user.role) });
});

exports.closeTicket = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
  }
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  if (req.user.role !== 'ADMIN' && String(ticket.user) !== String(req.user.id)) {
    return res.status(403).json({ success: false, message: 'Only the ticket owner can close this ticket' });
  }
  if (ticket.status === 'CLOSED') return res.status(200).json({ success: true, data: serializeTicket(ticket, req.user.role) });

  ticket.status = 'CLOSED';
  ticket.lastUpdatedBy = req.user.id;
  ticket.updates.push({
    author: req.user.id,
    authorRole: req.user.role,
    message: 'Ticket closed.',
    status: 'CLOSED',
  });
  await ticket.save();
  await notifyTicketParticipants(ticket, req, `Support ticket "${ticket.subject}" was closed.`);
  res.status(200).json({ success: true, data: serializeTicket(ticket, req.user.role) });
});

exports.getAllTickets = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  if (req.query.status && !STATUSES.includes(req.query.status)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket status' });
  }
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('vendor', 'businessName')
      .populate('request', 'eventDate eventLocation status')
      .populate('booking', 'eventDate bookingStatus paymentStatus')
      .populate('payment', 'paymentStatus amount currency')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: items.map(serializeTicket), total, page, pages: Math.ceil(total / limit) });
});

exports.updateTicket = asyncHandler(async (req, res) => {
  const { status, adminNotes, priority } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket status' });
  }
  if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid ticket priority' });
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  const previousStatus = ticket.status;
  ticket.status = status;
  if (priority) ticket.priority = priority;
  ticket.lastUpdatedBy = req.user.id;
  if (typeof adminNotes === 'string' && adminNotes.trim()) ticket.adminNotes = adminNotes.trim().slice(0, 2000);
  ticket.updates.push({
    author: req.user.id,
    authorRole: req.user.role,
    message: `Ticket status changed from ${previousStatus} to ${status}.`,
    status,
  });
  await ticket.save();
  await notifyTicketParticipants(ticket, req, `Support ticket "${ticket.subject}" was updated to ${status.toLowerCase().replaceAll('_', ' ')}.`);
  res.status(200).json({ success: true, data: serializeTicket(ticket) });
});

