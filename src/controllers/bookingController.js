const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Request = require('../models/Request');
const Service = require('../models/Service');
const Vendor = require('../models/Vendor');
const Payment = require('../models/Payment');
const { sendEmail } = require('../utils/emailClient');
const { bookingCreatedEmail } = require('../utils/emailTemplates');
const { validatePositiveNumber, validatePagination } = require('../utils/inputValidator');
const { isResourceOwner } = require('../utils/authorizationHelper');


// @desc    Get all bookings
// @route   GET /api/v1/bookings
// @access  Private
exports.getBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  // Validate pagination
  const { page: p, limit: l } = validatePagination(page, limit, 50);

  let filter = {};

  if (status) {
    // Validate status is a valid booking status
    const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
    if (validStatuses.includes(String(status).toUpperCase())) {
      filter.bookingStatus = status;
    }
  }

  // Users see their bookings, Vendors see bookings for their services
  if (req.user.role === 'USER') {
    filter.user = req.user.id;
  } else if (req.user.role === 'VENDOR') {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (vendor) filter.vendor = vendor._id;
  }
  // ADMIN can see all bookings

  const skip = (p - 1) * l;

  const bookings = await Booking.find(filter)
    .populate('user', 'firstName lastName email phone')
    .populate('vendor', 'businessName')
    .populate('service')
    .skip(skip)
    .limit(l)
    .sort({ createdAt: -1 });

  const total = await Booking.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: bookings.length,
    total,
    pages: Math.ceil(total / l),
    currentPage: p,
    data: bookings,
  });
});

// @desc    Get single booking by ID
// @route   GET /api/v1/bookings/:id
// @access  Private
exports.getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('user', 'firstName lastName email phone profilePicture')
    .populate('vendor', 'businessName email phone')
    .populate('service')
    .populate('request');

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Check authorization
  // NOTE: booking.user/booking.vendor are populated documents above, so compare
  // against their ._id — comparing the whole object always fails (IDOR false-positive).
  if (req.user.role === 'USER' && !isResourceOwner(req.user.id, booking.user?._id)) {
    res.status(403);
    throw new Error('You cannot access this booking');
  }

  if (req.user.role === 'VENDOR') {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor || !vendor._id.equals(booking.vendor?._id)) {
      res.status(403);
      throw new Error('You cannot access this booking');
    }
  }
  // ADMIN can access any booking

  res.status(200).json({
    success: true,
    data: booking,
  });
});

// @desc    Create booking (from accepted request)
// @route   POST /api/v1/bookings
// @access  Private (User)
exports.createBooking = asyncHandler(async (req, res) => {
  const {
    request,
    service,
    eventDate,
    eventLocation,
    totalAmount,
    specialRequests,
  } = req.body;

  // Validate required fields
  if (!request || !eventDate || !eventLocation) {
    res.status(400);
    throw new Error('request, eventDate, and eventLocation are required');
  }

  // Validate totalAmount is provided and is a positive number
  if (!totalAmount) {
    res.status(400);
    throw new Error('totalAmount is required');
  }

  const amountVal = validatePositiveNumber(totalAmount, 'Total amount', 1000000);
  if (!amountVal.valid) {
    res.status(400);
    throw new Error(amountVal.error);
  }

  // Get request details
  const serviceRequest = await Request.findById(request)
    .populate('vendor', 'businessName user')
    .populate('service', 'serviceName name price');

  if (!serviceRequest) {
    res.status(404);
    throw new Error('Request not found');
  }

  // Verify request belongs to authenticated user
  if (!isResourceOwner(req.user.id, serviceRequest.user)) {
    res.status(403);
    throw new Error('You cannot create a booking for this request');
  }

  if (serviceRequest.status !== 'ACCEPTED') {
    res.status(400);
    throw new Error('Request must be accepted first');
  }

  // Ensure vendor exists
  if (!serviceRequest.vendor) {
    res.status(400);
    throw new Error('Request is missing a vendor; cannot create booking');
  }

  // Use service from request if available; otherwise use service from payload
  const finalService = serviceRequest.service?._id || serviceRequest.service || service;
  if (!finalService) {
    res.status(400);
    throw new Error('Request must have a service linked, or service must be provided in payload');
  }

  // Server-side price validation: ensure amount matches service price
  // (prevent client from setting arbitrary prices)
  if (serviceRequest.service?.price && amountVal.value < serviceRequest.service.price) {
    res.status(400);
    throw new Error(`Total amount must be at least ${serviceRequest.service.price}`);
  }

  const booking = await Booking.create({
    request,
    user: req.user.id,
    vendor: serviceRequest.vendor._id || serviceRequest.vendor,
    service: finalService,
    eventDate,
    eventLocation,
    totalAmount: amountVal.value,
    specialRequests: specialRequests ? String(specialRequests).substring(0, 1000) : undefined,
  });

  const { logActivity } = require('../utils/activityLog');
  await logActivity({
    userId: req.user.id,
    actorId: req.user.id,
    actionType: 'BOOKING_CREATED',
    entityType: 'BOOKING',
    entityId: booking._id,
    metadata: { request: request?.toString?.() || request },
    severity: 'SUCCESS',
  });

  // Link booking back to request and mark as BOOKED
  try {
    serviceRequest.status = 'BOOKED';
    serviceRequest.booking = booking._id;
    await serviceRequest.save();
  } catch (err) {
    // Non-fatal: log and continue
    // eslint-disable-next-line no-console
    console.error('Failed to update request with booking:', err.message);
  }

  // Send booking created email (best-effort)
  try {
    const bookingUser = await require('../models/User').findById(req.user.id);
    const vendorName = serviceRequest.vendor?.businessName || serviceRequest.vendor?.vendorBusinessName || 'your vendor';
    const serviceName = serviceRequest.service?.name || serviceRequest.service?.serviceName || 'your service';

    const { subject, text, html } = bookingCreatedEmail({
      firstName: bookingUser?.firstName,
      vendorName,
      serviceName,
      bookingDate: eventDate,
      bookingTime: booking?.eventTime || booking?.eventTimeSlot || 'TBD',
      bookingUrl: `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${booking._id}`,
    });

    if (bookingUser?.email) {
      await sendEmail({
        to: bookingUser.email,
        subject,
        text,
        html,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Booking created email failed:', err.message);
  }

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: booking,
  });

});

// @desc    Update booking
// @route   PUT /api/v1/bookings/:id
// @access  Private
exports.updateBooking = asyncHandler(async (req, res) => {
  let booking = await Booking.findById(req.params.id);

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Check authorization
  const vendor = req.user.role === 'VENDOR' ? await Vendor.findOne({ user: req.user.id }) : null;
  const vendorId = vendor?._id?.toString?.() || '';
  if (booking.user.toString() !== req.user.id && booking.vendor.toString() !== vendorId && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to update this booking');
  }

  booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: 'Booking updated successfully',
    data: booking,
  });
});

// @desc    Cancel booking
// @route   PUT /api/v1/bookings/:id/cancel
// @access  Private
exports.cancelBooking = asyncHandler(async (req, res) => {
  const { cancellationReason } = req.body;

  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Check authorization
  const vendor = req.user.role === 'VENDOR' ? await Vendor.findOne({ user: req.user.id }) : null;
  const vendorId = vendor?._id?.toString?.() || '';
  if (booking.user.toString() !== req.user.id && booking.vendor.toString() !== vendorId && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to cancel this booking');
  }

  booking.bookingStatus = 'CANCELLED';
  booking.cancellationReason = cancellationReason;

  const { logActivity } = require('../utils/activityLog');
  await logActivity({
    userId: booking.user.toString(),
    actorId: req.user.id,
    actionType: 'BOOKING_CANCELLED',
    entityType: 'BOOKING',
    entityId: booking._id,
    metadata: { reason: cancellationReason },
    severity: 'WARN',
  });
  booking.cancellationDate = new Date();
  booking.paymentStatus = 'REFUNDED';

  await booking.save();

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully',
    data: booking,
  });
});

// @desc    Complete booking
// @route   PUT /api/v1/bookings/:id/complete
// @access  Private (Vendor)
exports.completeBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Check if vendor
  const vendor = req.user.role === 'VENDOR' ? await Vendor.findOne({ user: req.user.id }) : null;
  const vendorId = vendor?._id?.toString?.() || '';
  if (booking.vendor.toString() !== vendorId && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to complete this booking');
  }

  booking.bookingStatus = 'COMPLETED';
  await booking.save();

  const { logActivity } = require('../utils/activityLog');
  await logActivity({
    userId: booking.user.toString(),
    actorId: req.user.id,
    actionType: 'BOOKING_COMPLETED',
    entityType: 'BOOKING',
    entityId: booking._id,
    severity: 'SUCCESS',
  });

  res.status(200).json({
    success: true,
    message: 'Booking marked as completed',
    data: booking,
  });
});

// @desc    Delete booking
// @route   DELETE /api/v1/bookings/:id
// @access  Private
exports.deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Check authorization
  const vendor = req.user.role === 'VENDOR' ? await Vendor.findOne({ user: req.user.id }) : null;
  const vendorId = vendor?._id?.toString?.() || '';
  if (booking.user.toString() !== req.user.id && booking.vendor.toString() !== vendorId && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to delete this booking');
  }

  await Booking.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Booking deleted successfully',
  });
});
