const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Request = require('../models/Request');
const Payment = require('../models/Payment');
const { sendEmail } = require('../utils/emailClient');
const { bookingCreatedEmail } = require('../utils/emailTemplates');


// @desc    Get all bookings
// @route   GET /api/v1/bookings
// @access  Private
exports.getBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  let filter = {};

  if (status) {
    filter.bookingStatus = status;
  }

  // Users see their bookings, Vendors see bookings for their services
  if (req.user.role === 'USER') {
    filter.user = req.user.id;
  } else if (req.user.role === 'VENDOR') {
    filter.vendor = req.user._id;
  }

  const skip = (page - 1) * limit;

  const bookings = await Booking.find(filter)
    .populate('user', 'firstName lastName email phone')
    .populate('vendor', 'businessName')
    .populate('service')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Booking.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: bookings.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
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

  // Get request details
  const serviceRequest = await Request.findById(request)
    .populate('vendor')
    .populate('service');

  if (!serviceRequest) {
    res.status(404);
    throw new Error('Request not found');
  }

  if (serviceRequest.status !== 'ACCEPTED') {
    res.status(400);
    throw new Error('Request must be accepted first');
  }

  // Ensure vendor and service exist on the request to prevent server errors
  if (!serviceRequest.vendor) {
    res.status(400);
    throw new Error('Request is missing a vendor; cannot create booking');
  }
  if (!serviceRequest.service) {
    res.status(400);
    throw new Error('Request is missing a service; cannot create booking');
  }

  const booking = await Booking.create({
    request,
    user: req.user.id,
    vendor: serviceRequest.vendor._id || serviceRequest.vendor,
    service,
    eventDate,
    eventLocation,
    totalAmount,
    specialRequests,
  });

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
      bookingTime: booking?.eventTime || booking?.eventTimeSlot || '',
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
  if (booking.user.toString() !== req.user.id && booking.vendor.toString() !== req.user._id && req.user.role !== 'ADMIN') {
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
  if (booking.user.toString() !== req.user.id && booking.vendor.toString() !== req.user._id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to cancel this booking');
  }

  booking.bookingStatus = 'CANCELLED';
  booking.cancellationReason = cancellationReason;
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
  if (booking.vendor.toString() !== req.user._id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to complete this booking');
  }

  booking.bookingStatus = 'COMPLETED';
  await booking.save();

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
  if (booking.user.toString() !== req.user.id && booking.vendor.toString() !== req.user._id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to delete this booking');
  }

  await Booking.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Booking deleted successfully',
  });
});
