const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const Service = require('../models/Service');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailClient');
const {
  otpVerificationEmail,
  vendorVerificationRequestedEmail,
  adminNewVendorApprovalRequestEmail,
} = require('../utils/emailTemplates');
const { validatePagination, validateBusinessName, sanitizeString } = require('../utils/inputValidator');
const { isResourceOwner } = require('../utils/authorizationHelper');

// ===============================
// Vendor multi-step OTP + profile
// ===============================
function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpExpiryMs() {
  const minutes = Number(process.env.JWT_OTP_EXPIRE_MINUTES || 10);
  return minutes * 60 * 1000;
}

async function sendVendorOtpEmail({ user }) {
  const otp = user.otpCode;
  const { subject, text, html } = otpVerificationEmail({
    firstName: user.firstName,
    otpCode: otp,
    expiresInMinutes: Number(process.env.JWT_OTP_EXPIRE_MINUTES || 10),
    purposeLabel: 'vendor account verification',
  });

  // best-effort
  await sendEmail({
    to: user.email,
    subject,
    text,
    html,
  });
}

// ===============================
// Vendor multi-step OTP + profile
// Endpoints mounted under:
// POST /api/v1/vendors/register/page1
// POST /api/v1/vendors/register/page2
// POST /api/v1/vendors/register/page3
// POST /api/v1/vendors/register/verify-otp
// ===============================

// @desc    Vendor Register - Page 1 (create vendor user + send OTP)
// @route   POST /api/v1/vendors/register/page1
// @access  Public
exports.vendorRegisterPage1 = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, passwordConfirm } = req.body;

  if (!firstName || !lastName || !email || !phone || !password || !passwordConfirm) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  if (password !== passwordConfirm) {
    res.status(400);
    throw new Error('Passwords do not match');
  }

  const normalizedEmail = email.toLowerCase();

  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const user = await User.create({
    firstName,
    lastName,
    email: normalizedEmail,
    phone,
    password,
    role: 'VENDOR',
    isVerified: false,
  });

  const otp = generateSixDigitOtp();
  user.otpCode = otp;
  user.otpExpiresAt = new Date(Date.now() + otpExpiryMs());
  user.otpPurpose = 'vendor_verify_email';
  user.otpVerifiedAt = undefined;
  await user.save();

  await sendVendorOtpEmail({ user });

  return res.status(201).json({
    success: true,
    message: 'OTP sent to your email',
    data: { email: user.email },
  });
});

// @desc    Vendor Register - Page 2 (create/update Vendor profile)
// @route   POST /api/v1/vendors/register/page2
// @access  Public
exports.vendorRegisterPage2 = asyncHandler(async (req, res) => {
  const {
    email,
    businessName,
    businessRegistrationNumber,
    taxId,
    bankAccountNumber,
    bankName,
    businessDescription,
    serviceCategories,
    coverageAreas,
    nin,
  } = req.body;

  // passport photograph comes from frontend upload endpoint or will be sent as URL.
  const passportPhotograph = req.body.passportPhotograph || req.body.passportPhoto || req.body.passportPhotoUrl;

  // Ensure schema fields exist (legacy schema may not include them yet)
  const normalizedNin = nin ? nin.toString() : undefined;


  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }
  if (!businessName) {
    res.status(400);
    throw new Error('businessName is required');
  }

  const user = await User.findOne({ email: email.toLowerCase(), role: 'VENDOR' });
  if (!user) {
    res.status(404);
    throw new Error('Vendor account not found');
  }

  const normalizedServiceCategories = Array.isArray(serviceCategories) ? serviceCategories : [];
  const normalizedCoverageAreas = Array.isArray(coverageAreas) ? coverageAreas : [];

  let vendor = await Vendor.findOne({ user: user._id });
  if (!vendor) {
    vendor = await Vendor.create({
      user: user._id,
      businessName,
      businessRegistrationNumber,
      taxId,
      bankAccountNumber,
      bankCode: bankName, // legacy schema uses bankCode
      businessDescription,
      serviceCategories: normalizedServiceCategories,
      coverageAreas: normalizedCoverageAreas,
      responseTimeHours: 24,
      nin,
      passportPhotograph,
    });
  } else {
    vendor.businessName = businessName;
    vendor.businessRegistrationNumber = businessRegistrationNumber;
    vendor.taxId = taxId;
    vendor.bankAccountNumber = bankAccountNumber;
    vendor.bankCode = bankName;
    vendor.businessDescription = businessDescription;
    vendor.serviceCategories = normalizedServiceCategories;
    vendor.coverageAreas = normalizedCoverageAreas;
    vendor.nin = nin;
    vendor.passportPhotograph = passportPhotograph;
    await vendor.save();
  }

  return res.status(200).json({
    success: true,
    message: 'Vendor profile saved. Continue to OTP verification.',
    data: { email: user.email },
  });
});

// @desc    Vendor Register - Page 3 (send OTP again if needed)
// @route   POST /api/v1/vendors/register/page3
// @access  Public
exports.vendorRegisterPage3 = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const user = await User.findOne({ email: email.toLowerCase(), role: 'VENDOR' });
  if (!user) {
    res.status(404);
    throw new Error('Vendor account not found');
  }

  if (user.otpPurpose !== 'vendor_verify_email' || !user.otpCode || !user.otpExpiresAt) {
    const otp = generateSixDigitOtp();
    user.otpCode = otp;
    user.otpExpiresAt = new Date(Date.now() + otpExpiryMs());
    user.otpPurpose = 'vendor_verify_email';
    user.otpVerifiedAt = undefined;
    await user.save();
  }

  await sendVendorOtpEmail({ user });

  return res.status(200).json({
    success: true,
    message: 'OTP sent to your email',
  });
});

// @desc    Vendor Register - Verify OTP (confirm 6-digit OTP + issue JWT)
// @route   POST /api/v1/vendors/register/verify-otp
// @access  Public
exports.vendorVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and OTP are required');
  }

  const user = await User.findOne({ email: email.toLowerCase(), role: 'VENDOR' });
  if (!user) {
    res.status(404);
    throw new Error('Vendor account not found');
  }

  if (user.otpPurpose !== 'vendor_verify_email') {
    res.status(400);
    throw new Error('Invalid OTP purpose');
  }

  if (!user.otpCode || !user.otpExpiresAt) {
    res.status(400);
    throw new Error('No OTP request found');
  }

  if (new Date() > user.otpExpiresAt) {
    res.status(400);
    throw new Error('OTP expired');
  }

  if (user.otpCode !== otp.toString()) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  user.isVerified = true;
  user.otpVerifiedAt = new Date();
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  user.otpPurpose = undefined;
  await user.save();

  // Issue JWT now (frontend will redirect to dashboard)
  const { generateToken } = require('../utils/generateToken');
  const token = generateToken(user._id);

  user.password = undefined;
  return res.status(200).json({
    success: true,
    message: 'Vendor email verified successfully',
    token,
    data: user,
  });
});

// @desc    Get all vendors
// @route   GET /api/v1/vendors
// @access  Public
exports.getVendors = asyncHandler(async (req, res) => {
  const { category, search, verified, page = 1, limit = 10 } = req.query;

  // Validate pagination
  const paginationVal = validatePagination(page, limit, 50);
  const { page: pageNum, limit: limitNum } = paginationVal;

  let filter = {};

  if (category && typeof category === 'string') {
    filter.serviceCategories = { $in: [sanitizeString(category)] };
  }

  if (verified === 'true') {
    filter.isVerified = true;
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const sanitizedSearch = sanitizeString(search).substring(0, 100);
    filter.$or = [
      { businessName: { $regex: sanitizedSearch, $options: 'i' } },
      { businessDescription: { $regex: sanitizedSearch, $options: 'i' } },
    ];
  }

  const skip = (pageNum - 1) * limitNum;

  const vendors = await Vendor.find(filter)
    .populate('user', 'firstName lastName profilePicture email phone')
    .skip(skip)
    .limit(limitNum)
    .sort({ rating: -1 });

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

// @desc    Create vendor profile (legacy)
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



  // Normalize arrays for the immediate vendor signup flow.
  // (If frontend sends empty strings/null, keep Mongo validation happy.)
  // NOTE: we intentionally create vendor immediately after signup.
  // Keep arrays normalized but pass through frontend values directly.
  const normalizedServiceCategories = Array.isArray(serviceCategories)
    ? serviceCategories
    : [];
  const normalizedCoverageAreas = Array.isArray(coverageAreas)
    ? coverageAreas
    : [];


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
    serviceCategories: normalizedServiceCategories,
    coverageAreas: normalizedCoverageAreas,
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

  // Validate input if provided
  const updateData = {};

  if (req.body.businessName !== undefined) {
    const businessNameVal = validateBusinessName(req.body.businessName);
    if (!businessNameVal.valid) {
      res.status(400);
      throw new Error(businessNameVal.error);
    }
    updateData.businessName = businessNameVal.value;
  }

  if (req.body.businessDescription !== undefined && req.body.businessDescription !== null) {
    updateData.businessDescription = sanitizeString(req.body.businessDescription).substring(0, 2000);
  }

  if (req.body.serviceCategories !== undefined && Array.isArray(req.body.serviceCategories)) {
    updateData.serviceCategories = req.body.serviceCategories.map(cat => 
      sanitizeString(cat).substring(0, 100)
    ).filter(cat => cat.length > 0);
  }

  if (req.body.coverageAreas !== undefined && Array.isArray(req.body.coverageAreas)) {
    updateData.coverageAreas = req.body.coverageAreas.map(area =>
      sanitizeString(area).substring(0, 100)
    ).filter(area => area.length > 0);
  }

  if (req.body.businessRegistrationNumber !== undefined) {
    updateData.businessRegistrationNumber = sanitizeString(req.body.businessRegistrationNumber).substring(0, 50);
  }

  if (req.body.taxId !== undefined) {
    updateData.taxId = sanitizeString(req.body.taxId).substring(0, 50);
  }

  vendor = await Vendor.findByIdAndUpdate(req.params.id, updateData, {
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
