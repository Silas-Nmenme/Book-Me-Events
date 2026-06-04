const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Announcement = require('../models/Announcement');
const { sendEmail } = require('../utils/emailClient');
const {
  vendorVerificationSuccessEmail,
  vendorVerificationRejectedEmail,
} = require('../utils/emailTemplates');



// @desc    Get dashboard statistics
// @route   GET /api/v1/admin/dashboard
// @access  Private/Admin
exports.getDashboard = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments({ role: 'USER' });
  const totalVendors = await User.countDocuments({ role: 'VENDOR' });
  const totalBookings = await Booking.countDocuments();
  const totalRevenue = await Payment.aggregate([
    { $match: { paymentStatus: 'COMPLETED' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const completedBookings = await Booking.countDocuments({ bookingStatus: 'COMPLETED' });
  const averageRating = await Review.aggregate([
    { $group: { _id: null, avg: { $avg: '$rating' } } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalVendors,
      totalBookings,
      completedBookings,
      totalRevenue: totalRevenue[0]?.total || 0,
      averageRating: averageRating[0]?.avg.toFixed(1) || 0,
    },
  });
});

// @desc    Get all users (Admin)
// @route   GET /api/v1/admin/users
// @access  Private/Admin
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 10 } = req.query;

  let filter = {};
  if (role) {
    filter.role = role;
  }

  const skip = (page - 1) * limit;

  const users = await User.find(filter)
    .select('-password -refreshToken')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: users,
  });
});

// @desc    Get all vendors pending verification
// @route   GET /api/v1/admin/vendors/pending
// @access  Private/Admin
exports.getPendingVendors = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const skip = (page - 1) * limit;

  const vendors = await Vendor.find({ isVerified: false })
    .populate('user', 'firstName lastName email phone')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });


  const total = await Vendor.countDocuments({ isVerified: false });

  res.status(200).json({
    success: true,
    count: vendors.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: vendors,
  });
});

// @desc    Verify vendor
// @route   PUT /api/v1/admin/vendors/:id/verify
// @access  Private/Admin
exports.verifyVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id).populate('user', 'firstName lastName email');

  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  vendor.isVerified = true;
  vendor.verificationDate = new Date();

  // Stage 3 — KYC workflow state
  vendor.kycStatus = 'APPROVED';
  vendor.kycReviewedAt = new Date();
  vendor.kycReviewedBy = req.user?.id || undefined;

  // Keep legacy boolean consistent with KYC state.
  vendor.isVerified = true;

  await vendor.save();



  // Best-effort: do not fail verification if email fails
  try {
    const { subject, text, html } = vendorVerificationSuccessEmail({
      recipientName: vendor.user?.firstName || vendor.user?.lastName || 'there',
      vendorBusinessName: vendor.businessName,
    });

    if (vendor.user?.email) {
      await sendEmail({
        to: vendor.user.email,
        subject,
        text,
        html,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Vendor verification success email failed:', err.message);
  }

  res.status(200).json({
    success: true,
    message: 'Vendor verified successfully',
    data: vendor,
  });
});


// @desc    KYC review reject vendor (no delete)
// @route   PUT /api/v1/admin/vendors/:id/reject
// @access  Private/Admin
exports.rejectVendor = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const vendor = await Vendor.findById(req.params.id).populate('user', 'firstName lastName email');

  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  // Best-effort: email first, then update KYC status
  try {
    const { subject, text, html } = vendorVerificationRejectedEmail({
      recipientName: vendor.user?.firstName || vendor.user?.lastName || 'there',
      businessName: vendor.businessName,
      reason: reason || 'Please review your submission and try again.',
    });

    if (vendor.user?.email) {
      await sendEmail({
        to: vendor.user.email,
        subject,
        text,
        html,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Vendor verification rejected email failed:', err.message);
  }

  // KYC workflow (MVP-compatible): keep vendor, mark rejected with reason.
  // NOTE: We store KYC-related fields directly on Vendor schema; fields are added in Stage 3.
  vendor.kycStatus = 'REJECTED';
  vendor.kycReviewReason = reason || 'Not provided';
  vendor.kycReviewedAt = new Date();

  // Keep legacy boolean consistent (a rejected vendor is not verified).
  vendor.isVerified = false;

  await vendor.save();

  // Audit (append-only): moderation action recorded.

  try {
    const { logActivity } = require('../utils/activityLog');
    await logActivity({
      userId: vendor.user?.toString?.() || vendor.user,
      actorId: req.user?.id,
actionType: 'VENDOR_KYC_APPROVED',
      entityType: 'VENDOR',
      entityId: vendor._id,
      metadata: { reason: null },
      severity: 'ACTION',
    });
  } catch (e) {}

  res.status(200).json({

    success: true,
    message: 'Vendor KYC rejected',
    data: {
      vendorId: vendor._id,
      kycStatus: vendor.kycStatus,
      kycReviewReason: vendor.kycReviewReason,
    },
  });
});



// @desc    Disable/Enable user
// @route   PUT /api/v1/admin/users/:id/toggle-status
// @access  Private/Admin
exports.toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.isActive = !user.isActive;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${user.isActive ? 'enabled' : 'disabled'} successfully`,
    data: user,
  });
});

// @desc    Get all bookings (Admin)
// @route   GET /api/v1/admin/bookings
// @access  Private/Admin
exports.getAllBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  let filter = {};
  if (status) {
    filter.bookingStatus = status;
  }

  const skip = (page - 1) * limit;

  const bookings = await Booking.find(filter)
    .populate('user', 'firstName lastName email')
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

// @desc    Get all payments (Admin)
// @route   GET /api/v1/admin/payments
// @access  Private/Admin
exports.getAllPayments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  let filter = {};
  if (status) {
    filter.paymentStatus = status;
  }

  const skip = (page - 1) * limit;

  const payments = await Payment.find(filter)
    .populate('user', 'firstName lastName email')
    .populate('vendor', 'businessName')
    .populate('booking')
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

// @desc    Get platform statistics
// @route   GET /api/v1/admin/stats
// @access  Private/Admin
exports.getPlatformStats = asyncHandler(async (req, res) => {
  const bookingsByStatus = await Booking.aggregate([
    { $group: { _id: '$bookingStatus', count: { $sum: 1 } } },
  ]);

  const paymentsByStatus = await Payment.aggregate([
    { $group: { _id: '$paymentStatus', count: { $sum: 1 }, total: { $sum: '$amount' } } },
  ]);

  const topVendors = await Booking.aggregate([
    { $group: { _id: '$vendor', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'vendorInfo' } },
  ]);

  const monthlyRevenue = await Payment.aggregate([
    { $match: { paymentStatus: 'COMPLETED' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      bookingsByStatus,
      paymentsByStatus,
      topVendors,
      monthlyRevenue,
    },
  });
});

// @desc    Send notification/announcement
// @route   POST /api/v1/admin/announcements
// @access  Private/Admin
exports.sendAnnouncement = asyncHandler(async (req, res) => {
  const { title, message, recipientType } = req.body;

  // Allow the admin UI to send recipientType=ALL.
  // Backend schema only supports USER/VENDOR, so we expand ALL into two announcements.
  const normalizedTitle = title?.toString().trim();
  const normalizedMessage = message?.toString().trim();
  const normalizedRecipientType = recipientType?.toString().toUpperCase();

  if (!normalizedTitle || !normalizedMessage || !normalizedRecipientType) {
    res.status(400);
    throw new Error('title, message, and recipientType are required');
  }

  const recipientTargets =
    normalizedRecipientType === 'ALL'
      ? ['USER', 'VENDOR']
      : [normalizedRecipientType];

  // Validate against schema enum so we fail fast with a clear message.
  const invalid = recipientTargets.find((t) => t !== 'USER' && t !== 'VENDOR');
  if (invalid) {
    res.status(400);
    throw new Error('recipientType must be USER, VENDOR, or ALL');
  }

  const announcements = await Promise.all(
    recipientTargets.map((target) =>
      Announcement.create({
        title: normalizedTitle,
        message: normalizedMessage,
        recipientType: target,
      })
    )
  );

  res.status(201).json({
    success: true,
    message: 'Announcement sent successfully',
    data: announcements.length === 1 ? announcements[0] : announcements,
  });
});



