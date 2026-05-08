const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const Service = require('../models/Service');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailClient');
const {
  vendorVerificationRequestedEmail,
  adminNewVendorApprovalRequestEmail,
} = require('../utils/emailTemplates');


// @desc    Get all vendors
// @route   GET /api/v1/vendors
// @access  Public
exports.getVendors = asyncHandler(async (req, res) => {
  const { category, search, verified, page = 1, limit = 10 } = req.query;

  let filter = {};

  if (category) {
    filter.serviceCategories = { $in: [category] };
  }

  if (verified === 'true') {
    filter.isVerified = true;
  }

  if (search) {
    filter.$or = [
      { businessName: { $regex: search, $options: 'i' } },
      { businessDescription: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const vendors = await Vendor.find(filter)
    .populate('user', 'firstName lastName profilePicture email phone')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ rating: -1 });

  const total = await Vendor.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: vendors.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: vendors,
  });
});

// @desc    Get single vendor by ID
// @route   GET /api/v1/vendors/:id
// @access  Public
exports.getVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id)
    .populate('user', 'firstName lastName profilePicture email phone bio');

  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  res.status(200).json({
    success: true,
    data: vendor,
  });
});

// @desc    Create vendor profile
// @route   POST /api/v1/vendors
// @access  Private
exports.createVendor = asyncHandler(async (req, res) => {
  const {
    businessName,
    businessRegistrationNumber,
    taxId,
    bankAccountNumber,
    bankCode,
    businessDescription,
    serviceCategories,
    coverageAreas,
    responseTimeHours,
  } = req.body;

  // Check if vendor already exists for this user
  let vendor = await Vendor.findOne({ user: req.user.id });
  if (vendor) {
    res.status(400);
    throw new Error('Vendor profile already exists for this user');
  }

  vendor = await Vendor.create({
    user: req.user.id,
    businessName,
    businessRegistrationNumber,
    taxId,
    bankAccountNumber,
    bankCode,
    businessDescription,
    serviceCategories,
    coverageAreas,
    responseTimeHours,
  });

  // Update user role to VENDOR
  const updatedUser = await User.findByIdAndUpdate(req.user.id, { role: 'VENDOR' }, { new: true });

  // Send emails (best-effort: don't fail request creation if email fails)
  try {
    const { subject, text, html } = vendorVerificationRequestedEmail({
      recipientName: updatedUser?.firstName || updatedUser?.lastName || 'there',
      businessName: vendor.businessName,
    });

    await sendEmail({
      to: updatedUser.email,
      subject,
      text,
      html,
    });

    const adminEmail = process.env.ADMIN_EMAIL || 'silasonyekachi15@gmail.com';
    const adminName = process.env.ADMIN_NAME || 'Admin';

    const { subject: adminSubject, text: adminText, html: adminHtml } = adminNewVendorApprovalRequestEmail({
      adminName,
      vendorBusinessName: vendor.businessName,
      applicantName: updatedUser.firstName,
      applicantEmail: updatedUser.email,
    });

    await sendEmail({
      to: adminEmail,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Vendor verification request emails failed:', err.message);
  }

  res.status(201).json({
    success: true,
    message: 'Vendor profile created successfully',
    data: vendor,
  });
});


// @desc    Update vendor profile
// @route   PUT /api/v1/vendors/:id
// @access  Private
exports.updateVendor = asyncHandler(async (req, res) => {
  let vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  // Check if user owns this vendor profile
  if (vendor.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to update this vendor');
  }

  vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: 'Vendor profile updated successfully',
    data: vendor,
  });
});

// @desc    Delete vendor profile
// @route   DELETE /api/v1/vendors/:id
// @access  Private
exports.deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  // Check if user owns this vendor profile
  if (vendor.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to delete this vendor');
  }

  await Vendor.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Vendor profile deleted successfully',
  });
});

// @desc    Get vendor services
// @route   GET /api/v1/vendors/:id/services
// @access  Public
exports.getVendorServices = asyncHandler(async (req, res) => {
  const services = await Service.find({ vendor: req.params.id });

  res.status(200).json({
    success: true,
    count: services.length,
    data: services,
  });
});

// @desc    Get vendor bookings
// @route   GET /api/v1/vendors/:id/bookings
// @access  Private
exports.getVendorBookings = asyncHandler(async (req, res) => {
  const Booking = require('../models/Booking');
  
  const bookings = await Booking.find({ vendor: req.params.id })
    .populate('user')
    .populate('service')
    .populate('request');

  res.status(200).json({
    success: true,
    count: bookings.length,
    data: bookings,
  });
});

// @desc    Get vendor reviews
// @route   GET /api/v1/vendors/:id/reviews
// @access  Public
exports.getVendorReviews = asyncHandler(async (req, res) => {
  const Review = require('../models/Review');
  
  const reviews = await Review.find({ vendor: req.params.id })
    .populate('user', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 });

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : 0;

  res.status(200).json({
    success: true,
    count: reviews.length,
    averageRating,
    data: reviews,
  });
});
