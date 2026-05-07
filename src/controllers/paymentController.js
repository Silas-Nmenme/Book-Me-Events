const asyncHandler = require('express-async-handler');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

// @desc    Get all payments
// @route   GET /api/v1/payments
// @access  Private
exports.getPayments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  let filter = {};

  if (status) {
    filter.paymentStatus = status;
  }

  // Users see their payments, Vendors see payments for their services
  if (req.user.role === 'USER') {
    filter.user = req.user.id;
  } else if (req.user.role === 'VENDOR') {
    filter.vendor = req.user._id;
  }

  const skip = (page - 1) * limit;

  const payments = await Payment.find(filter)
    .populate('booking')
    .populate('user', 'firstName lastName email')
    .populate('vendor', 'businessName')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Payment.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: payments.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: payments,
  });
});

// @desc    Get single payment by ID
// @route   GET /api/v1/payments/:id
// @access  Private
exports.getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('booking')
    .populate('user')
    .populate('vendor');

  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  res.status(200).json({
    success: true,
    data: payment,
  });
});

// @desc    Create payment
// @route   POST /api/v1/payments
// @access  Private (User)
exports.createPayment = asyncHandler(async (req, res) => {
  const {
    booking,
    paymentMethod,
    transactionReference,
    paymentGateway,
  } = req.body;

  const bookingData = await Booking.findById(booking)
    .populate('user')
    .populate('vendor');

  if (!bookingData) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Check if user owns the booking
  if (bookingData.user._id.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to make payment for this booking');
  }

  const payment = await Payment.create({
    booking,
    user: req.user.id,
    vendor: bookingData.vendor._id,
    amount: bookingData.totalAmount,
    paymentMethod,
    transactionReference,
    paymentGateway,
    paymentStatus: 'COMPLETED',
  });

  // Update booking payment status
  await Booking.findByIdAndUpdate(booking, { paymentStatus: 'COMPLETED' });

  res.status(201).json({
    success: true,
    message: 'Payment processed successfully',
    data: payment,
  });
});

// @desc    Get payment by transaction reference
// @route   GET /api/v1/payments/ref/:ref
// @access  Private
exports.getPaymentByRef = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ transactionReference: req.params.ref })
    .populate('booking')
    .populate('user')
    .populate('vendor');

  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  res.status(200).json({
    success: true,
    data: payment,
  });
});

// @desc    Refund payment
// @route   POST /api/v1/payments/:id/refund
// @access  Private/Admin
exports.refundPayment = asyncHandler(async (req, res) => {
  const { refundReason } = req.body;

  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  // Check authorization
  if (payment.user.toString() !== req.user.id && payment.vendor.toString() !== req.user._id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to refund this payment');
  }

  payment.paymentStatus = 'REFUNDED';
  payment.refundAmount = payment.amount;
  payment.refundReason = refundReason;
  payment.refundDate = new Date();

  await payment.save();

  // Update booking payment status
  await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: 'REFUNDED' });

  res.status(200).json({
    success: true,
    message: 'Payment refunded successfully',
    data: payment,
  });
});

// @desc    Get payment statistics
// @route   GET /api/v1/payments/stats/overview
// @access  Private/Admin
exports.getPaymentStats = asyncHandler(async (req, res) => {
  const totalRevenue = await Payment.aggregate([
    { $match: { paymentStatus: 'COMPLETED' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const paymentsByMethod = await Payment.aggregate([
    { $match: { paymentStatus: 'COMPLETED' } },
    { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
  ]);

  const pendingAmount = await Payment.aggregate([
    { $match: { paymentStatus: 'PENDING' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalRevenue: totalRevenue[0]?.total || 0,
      paymentsByMethod,
      pendingAmount: pendingAmount[0]?.total || 0,
    },
  });
});
