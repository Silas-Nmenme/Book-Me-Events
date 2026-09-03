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
const { validatePagination } = require('../utils/inputValidator');
const { toCsv, sendCsv } = require('../utils/csvExport');
const { buildIssuer, generateAdminTotpSecret, verifyTotp } = require('../utils/totpUtil');

function escapeRegex(str) {
  return str.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// @desc    Generate a TOTP provisioning URI for the authenticated admin
// @route   GET /api/v1/admin/2fa/setup
// @access  Private/Admin
exports.setupAdminTwoFactor = asyncHandler(async (req, res) => {
  if (req.user.totpEnabled) {
    return res.status(409).json({
      success: false,
      message: 'Two-factor authentication is already enabled',
    });
  }

  const issuer = buildIssuer();
  const accountName = req.user.email;
  const { base32, otpauth_url: otpauthUrl } = generateAdminTotpSecret({ issuer, accountName });

  req.user.totpSecret = base32;
  req.user.totpVerifiedAt = undefined;
  await req.user.save();

  return res.status(200).json({
    success: true,
    data: { otpauth_url: otpauthUrl },
  });
});

// @desc    Verify a TOTP code and enable two-factor authentication for the admin
// @route   POST /api/v1/admin/2fa/verify
// @access  Private/Admin
exports.verifyAdminTwoFactor = asyncHandler(async (req, res) => {
  const totpCode = (req.body?.totpCode || '').toString().trim();

  if (!/^\d{6}$/.test(totpCode)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid 6-digit authenticator code',
    });
  }

  if (!req.user.totpSecret) {
    return res.status(400).json({
      success: false,
      message: 'Start two-factor setup before verifying a code',
    });
  }

  if (!verifyTotp({ secret: req.user.totpSecret, token: totpCode })) {
    return res.status(400).json({
      success: false,
      message: 'Invalid authenticator code',
    });
  }

  req.user.totpEnabled = true;
  req.user.totpVerifiedAt = new Date();
  await req.user.save();

  return res.status(200).json({
    success: true,
    message: 'Two-factor authentication enabled',
  });
});



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

  const pendingVendors = await Vendor.countDocuments({ kycStatus: 'PENDING' });
  const activeUsers = await User.countDocuments({ isActive: true });
  const disabledUsers = await User.countDocuments({ isActive: false });

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalVendors,
      totalBookings,
      completedBookings,
      totalRevenue: totalRevenue[0]?.total || 0,
      averageRating: averageRating[0]?.avg.toFixed(1) || 0,
      pendingVendors,
      activeUsers,
      disabledUsers,
    },
  });
});

// @desc    Get all users (Admin)
// @route   GET /api/v1/admin/users
// @access  Private/Admin
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 10 } = req.query;

  const { page: pageNum, limit: limitNum } = validatePagination(page, limit, 50);

  let filter = {};
  if (role && role.toString().toUpperCase() !== 'ALL') {
    filter.role = role.toString().toUpperCase();
  }

  if (search) {
    // Escape regex metacharacters to avoid ReDoS/injection via search input.
    const safeSearch = search.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { firstName: { $regex: safeSearch, $options: 'i' } },
      { lastName: { $regex: safeSearch, $options: 'i' } },
      { email: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const skip = (pageNum - 1) * limitNum;

  const users = await User.find(filter)
    .select('-password -refreshToken')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: users,
  });
});

// @desc    Get all vendors pending verification
// @route   GET /api/v1/admin/vendors/pending
// @access  Private/Admin
exports.getPendingVendors = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const { page: pageNum, limit: limitNum } = validatePagination(page, limit, 50);

  const skip = (pageNum - 1) * limitNum;

  const vendors = await Vendor.find({ isVerified: false })
    .populate('user', 'firstName lastName email phone')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });


  const total = await Vendor.countDocuments({ isVerified: false });

  res.status(200).json({
    success: true,
    count: vendors.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: vendors,
  });
});

// @desc    Get all vendors (any KYC status), with optional search & status filter
// @route   GET /api/v1/admin/vendors
// @access  Private/Admin
exports.getAllVendors = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 10 } = req.query;

  const { page: pageNum, limit: limitNum } = validatePagination(page, limit, 50);

  let filter = {};
  const normalizedStatus = status?.toString().toUpperCase();
  if (normalizedStatus && ['PENDING', 'APPROVED', 'REJECTED'].includes(normalizedStatus)) {
    filter.kycStatus = normalizedStatus;
  }

  if (search) {
    // Escape regex metacharacters to avoid ReDoS/injection via search input.
    const safeSearch = search.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.businessName = { $regex: safeSearch, $options: 'i' };
  }

  const skip = (pageNum - 1) * limitNum;

  const vendors = await Vendor.find(filter)
    .populate('user', 'firstName lastName email phone isActive')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Vendor.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: vendors.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
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

  const { page: pageNum, limit: limitNum } = validatePagination(page, limit, 100);

  let filter = {};
  if (status) {
    filter.bookingStatus = status;
  }

  const skip = (pageNum - 1) * limitNum;

  const bookings = await Booking.find(filter)
    .populate('user', 'firstName lastName email')
    .populate('vendor', 'businessName')
    .populate('service')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Booking.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: bookings.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: bookings,
  });
});

// @desc    Get all payments (Admin)
// @route   GET /api/v1/admin/payments
// @access  Private/Admin
exports.getAllPayments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const { page: pageNum, limit: limitNum } = validatePagination(page, limit, 100);

  let filter = {};
  if (status) {
    filter.paymentStatus = status;
  }

  const skip = (pageNum - 1) * limitNum;

  const payments = await Payment.find(filter)
    .populate('user', 'firstName lastName email')
    .populate('vendor', 'businessName')
    .populate('booking')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Payment.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: payments.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
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

  const monthlySignups = await User.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const monthlyBookings = await Booking.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
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
      monthlySignups,
      monthlyBookings,
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

// Export cap: prevents unbounded CSV generation from taking down the process.
const MAX_EXPORT_ROWS = 5000;

// @desc    Export users as CSV (respects same filters as getAllUsers)
// @route   GET /api/v1/admin/users/export
// @access  Private/Admin
exports.exportUsersCsv = asyncHandler(async (req, res) => {
  const { role, search } = req.query;

  let filter = {};
  if (role && role.toString().toUpperCase() !== 'ALL') {
    filter.role = role.toString().toUpperCase();
  }
  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { firstName: { $regex: safeSearch, $options: 'i' } },
      { lastName: { $regex: safeSearch, $options: 'i' } },
      { email: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .select('firstName lastName email phone role isActive isVerified createdAt')
    .sort({ createdAt: -1 })
    .limit(MAX_EXPORT_ROWS);

  const csv = toCsv(
    [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'role', label: 'Role' },
      { label: 'Status', value: (u) => (u.isActive ? 'Active' : 'Disabled') },
      { label: 'Verified', value: (u) => (u.isVerified ? 'Yes' : 'No') },
      { label: 'Joined', value: (u) => new Date(u.createdAt).toISOString() },
    ],
    users
  );

  sendCsv(res, `users-export-${Date.now()}.csv`, csv);
});

// @desc    Export vendors as CSV (respects same filters as getAllVendors)
// @route   GET /api/v1/admin/vendors/export
// @access  Private/Admin
exports.exportVendorsCsv = asyncHandler(async (req, res) => {
  const { status, search } = req.query;

  let filter = {};
  const normalizedStatus = status?.toString().toUpperCase();
  if (normalizedStatus && ['PENDING', 'APPROVED', 'REJECTED'].includes(normalizedStatus)) {
    filter.kycStatus = normalizedStatus;
  }
  if (search) {
    filter.businessName = { $regex: escapeRegex(search), $options: 'i' };
  }

  const vendors = await Vendor.find(filter)
    .populate('user', 'firstName lastName email phone')
    .sort({ createdAt: -1 })
    .limit(MAX_EXPORT_ROWS);

  const csv = toCsv(
    [
      { label: 'Business Name', value: (v) => v.businessName },
      { label: 'Owner', value: (v) => `${v.user?.firstName || ''} ${v.user?.lastName || ''}`.trim() },
      { label: 'Email', value: (v) => v.user?.email || '' },
      { label: 'Phone', value: (v) => v.user?.phone || '' },
      { label: 'KYC Status', value: (v) => v.kycStatus },
      { label: 'Rating', value: (v) => v.rating },
      { label: 'Total Bookings', value: (v) => v.totalBookings },
      { label: 'Joined', value: (v) => new Date(v.createdAt).toISOString() },
    ],
    vendors
  );

  sendCsv(res, `vendors-export-${Date.now()}.csv`, csv);
});

// @desc    Export bookings as CSV (respects same status filter as getAllBookings)
// @route   GET /api/v1/admin/bookings/export
// @access  Private/Admin
exports.exportBookingsCsv = asyncHandler(async (req, res) => {
  const { status } = req.query;

  let filter = {};
  if (status) filter.bookingStatus = status;

  const bookings = await Booking.find(filter)
    .populate('user', 'firstName lastName email')
    .populate('vendor', 'businessName')
    .populate('service', 'serviceName name')
    .sort({ createdAt: -1 })
    .limit(MAX_EXPORT_ROWS);

  const csv = toCsv(
    [
      { label: 'Booking ID', value: (b) => b._id.toString() },
      { label: 'Customer', value: (b) => `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim() },
      { label: 'Customer Email', value: (b) => b.user?.email || '' },
      { label: 'Vendor', value: (b) => b.vendor?.businessName || '' },
      { label: 'Service', value: (b) => b.service?.serviceName || b.service?.name || '' },
      { label: 'Status', value: (b) => b.bookingStatus },
      { label: 'Amount', value: (b) => b.totalAmount },
      { label: 'Created', value: (b) => new Date(b.createdAt).toISOString() },
    ],
    bookings
  );

  sendCsv(res, `bookings-export-${Date.now()}.csv`, csv);
});

// @desc    Export payments as CSV (respects same status filter as getAllPayments)
// @route   GET /api/v1/admin/payments/export
// @access  Private/Admin
exports.exportPaymentsCsv = asyncHandler(async (req, res) => {
  const { status } = req.query;

  let filter = {};
  if (status) filter.paymentStatus = status;

  const payments = await Payment.find(filter)
    .populate('user', 'firstName lastName email')
    .populate('vendor', 'businessName')
    .sort({ createdAt: -1 })
    .limit(MAX_EXPORT_ROWS);

  const csv = toCsv(
    [
      { label: 'Payment ID', value: (p) => p._id.toString() },
      { label: 'Customer', value: (p) => `${p.user?.firstName || ''} ${p.user?.lastName || ''}`.trim() },
      { label: 'Customer Email', value: (p) => p.user?.email || '' },
      { label: 'Vendor', value: (p) => p.vendor?.businessName || '' },
      { label: 'Amount', value: (p) => p.amount },
      { label: 'Status', value: (p) => p.paymentStatus },
      { label: 'Transaction Reference', value: (p) => p.transactionReference },
      { label: 'Created', value: (p) => new Date(p.createdAt).toISOString() },
    ],
    payments
  );

  sendCsv(res, `payments-export-${Date.now()}.csv`, csv);
});

// Bulk action cap: keeps a single request from mutating an unbounded number of records.
const MAX_BULK_IDS = 200;

// @desc    Bulk enable/disable users
// @route   PUT /api/v1/admin/users/bulk-toggle-status
// @access  Private/Admin
exports.bulkToggleUserStatus = asyncHandler(async (req, res) => {
  const { userIds, isActive } = req.body || {};

  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400);
    throw new Error('userIds must be a non-empty array');
  }
  if (typeof isActive !== 'boolean') {
    res.status(400);
    throw new Error('isActive must be a boolean');
  }

  const safeIds = userIds.slice(0, MAX_BULK_IDS).filter((id) => /^[a-f0-9]{24}$/i.test(id));

  const result = await User.updateMany({ _id: { $in: safeIds } }, { $set: { isActive } });

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} user(s) ${isActive ? 'enabled' : 'disabled'} successfully`,
    modifiedCount: result.modifiedCount,
  });
});

// @desc    Bulk verify or reject vendors
// @route   PUT /api/v1/admin/vendors/bulk-action
// @access  Private/Admin
exports.bulkVendorAction = asyncHandler(async (req, res) => {
  const { vendorIds, action, reason } = req.body || {};

  if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
    res.status(400);
    throw new Error('vendorIds must be a non-empty array');
  }
  if (action !== 'verify' && action !== 'reject') {
    res.status(400);
    throw new Error('action must be "verify" or "reject"');
  }

  const safeIds = vendorIds.slice(0, MAX_BULK_IDS).filter((id) => /^[a-f0-9]{24}$/i.test(id));
  const vendors = await Vendor.find({ _id: { $in: safeIds } }).populate('user', 'firstName lastName email');

  let processed = 0;
  for (const vendor of vendors) {
    if (action === 'verify') {
      vendor.isVerified = true;
      vendor.verificationDate = new Date();
      vendor.kycStatus = 'APPROVED';
      vendor.kycReviewedAt = new Date();
      vendor.kycReviewedBy = req.user?.id || undefined;
    } else {
      vendor.isVerified = false;
      vendor.kycStatus = 'REJECTED';
      vendor.kycReviewReason = reason || 'Not provided';
      vendor.kycReviewedAt = new Date();
    }

    // eslint-disable-next-line no-await-in-loop
    await vendor.save();
    processed += 1;

    // Best-effort email; failures don't block the bulk operation.
    if (vendor.user?.email) {
      try {
        const templateFn = action === 'verify' ? vendorVerificationSuccessEmail : vendorVerificationRejectedEmail;
        const { subject, text, html } = templateFn({
          recipientName: vendor.user?.firstName || vendor.user?.lastName || 'there',
          vendorBusinessName: vendor.businessName,
          businessName: vendor.businessName,
          reason: reason || 'Please review your submission and try again.',
        });
        // eslint-disable-next-line no-await-in-loop
        await sendEmail({ to: vendor.user.email, subject, text, html });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Bulk vendor ${action} email failed:`, err.message);
      }
    }
  }

  res.status(200).json({
    success: true,
    message: `${processed} vendor(s) ${action === 'verify' ? 'verified' : 'rejected'} successfully`,
    processedCount: processed,
  });
});

// @desc    Global search across users, vendors, and bookings
// @route   GET /api/v1/admin/search?q=
// @access  Private/Admin
exports.globalSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();

  if (!q) {
    return res.status(200).json({ success: true, data: { users: [], vendors: [], bookings: [] } });
  }

  const regex = { $regex: escapeRegex(q), $options: 'i' };

  const matchingUsers = await User.find({
    $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
  })
    .select('firstName lastName email role isActive')
    .limit(10);

  const vendorsByName = await Vendor.find({ businessName: regex })
    .populate('user', 'firstName lastName email')
    .limit(10);

  const matchingUserIds = matchingUsers.map((u) => u._id);
  const vendorsByOwner = await Vendor.find({ user: { $in: matchingUserIds } })
    .populate('user', 'firstName lastName email')
    .limit(10);

  const seenVendorIds = new Set();
  const vendors = [...vendorsByName, ...vendorsByOwner]
    .filter((v) => {
      const id = v._id.toString();
      if (seenVendorIds.has(id)) return false;
      seenVendorIds.add(id);
      return true;
    })
    .slice(0, 10);

  const relatedUserIds = [...matchingUserIds, ...vendors.map((v) => v.user?._id).filter(Boolean)];

  const bookings = await Booking.find({ user: { $in: relatedUserIds } })
    .populate('user', 'firstName lastName email')
    .populate('vendor', 'businessName')
    .populate('service', 'serviceName name')
    .sort({ createdAt: -1 })
    .limit(10);

  res.status(200).json({
    success: true,
    data: { users: matchingUsers, vendors, bookings },
  });
});



