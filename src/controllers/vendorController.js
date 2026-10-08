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
const {
  validatePagination,
  validateBusinessName,
  sanitizeString,
  validateVendorBio,
  validateVendorUrl,
  validateVendorCoverageStates,
  validateVendorLocation,
  validateVendorReviews,
} = require('../utils/inputValidator');
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

function normalizeStringList(list, maxItems = 20) {
  if (!Array.isArray(list)) return [];
  const normalized = list
    .map((item) => sanitizeString(String(item || '')).trim())
    .filter(Boolean)
    .slice(0, maxItems);
  return [...new Set(normalized)];
}

function normalizeGalleryItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const rawUrl = typeof item === 'string' ? item : item?.url || item?.image || item?.src;
      if (!rawUrl) return null;

      const urlResult = validateVendorUrl(rawUrl, 'Gallery image URL');
      if (!urlResult.valid) throw new Error(urlResult.error);

      return {
        url: urlResult.value,
        publicId: sanitizeString(String(item?.publicId || item?.public_id || '')).trim(),
        caption: sanitizeString(String(item?.caption || item?.title || '')).trim().substring(0, 220),
      };
    })
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeSocialLinks(socialLinks = {}) {
  const safe = {};
  const entries = [
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['tiktok', 'TikTok'],
    ['whatsapp', 'WhatsApp'],
  ];

  entries.forEach(([key, label]) => {
    const value = socialLinks && socialLinks[key] !== undefined ? socialLinks[key] : '';
    if (!value || value === null || value === '') return;
    const result = validateVendorUrl(value, label);
    if (!result.valid) {
      throw new Error(result.error);
    }
    safe[key] = result.value;
  });

  return safe;
}

function getVendorProfileUpdateData(body = {}) {
  const updateData = {};

  if (body.businessName !== undefined) {
    const businessNameVal = validateBusinessName(body.businessName);
    if (!businessNameVal.valid) throw new Error(businessNameVal.error);
    updateData.businessName = businessNameVal.value;
  }

  if (body.businessDescription !== undefined && body.businessDescription !== null) {
    const desc = sanitizeString(String(body.businessDescription)).substring(0, 2000);
    updateData.businessDescription = desc;
  }

  if (body.bio !== undefined) {
    const bioResult = validateVendorBio(body.bio, 1200);
    if (!bioResult.valid) throw new Error(bioResult.error);
    updateData.bio = bioResult.value;
  }

  if (body.testimonial !== undefined) {
    const testimonial = sanitizeString(String(body.testimonial || '')).substring(0, 800);
    updateData.testimonial = testimonial;
  }

  if (body.serviceCategories !== undefined) {
    updateData.serviceCategories = normalizeStringList(body.serviceCategories, 20);
  }

  if (body.coverageAreas !== undefined) {
    updateData.coverageAreas = normalizeStringList(body.coverageAreas, 20);
  }

  if (body.serviceCoverageStates !== undefined) {
    const coverageResult = validateVendorCoverageStates(body.serviceCoverageStates, { min: 2, max: 10 });
    if (!coverageResult.valid) throw new Error(coverageResult.error);
    updateData.serviceCoverageStates = coverageResult.value;
  }

  if (body.currentLocation !== undefined) {
    const locationResult = validateVendorLocation(body.currentLocation);
    if (!locationResult.valid) throw new Error(locationResult.error);
    updateData.currentLocation = locationResult.value;
  }

  if (body.socialLinks !== undefined) {
    updateData.socialLinks = normalizeSocialLinks(body.socialLinks);
  }

  if (body.profilePicture !== undefined && body.profilePicture !== null && body.profilePicture !== '') {
    const pictureResult = validateVendorUrl(body.profilePicture, 'Profile picture URL');
    if (!pictureResult.valid) throw new Error(pictureResult.error);
    updateData.profilePicture = pictureResult.value;
  }

  if (body.gallery !== undefined) {
    const gallery = normalizeGalleryItems(body.gallery);
    updateData.gallery = gallery;
  }

  if (body.previousReviews !== undefined) {
    const reviewsResult = validateVendorReviews(body.previousReviews);
    if (!reviewsResult.valid) throw new Error(reviewsResult.error);
    updateData.previousReviews = reviewsResult.value;
  }

  if (body.businessRegistrationNumber !== undefined) {
    updateData.businessRegistrationNumber = sanitizeString(String(body.businessRegistrationNumber)).substring(0, 50);
  }

  if (body.taxId !== undefined) {
    updateData.taxId = sanitizeString(String(body.taxId)).substring(0, 50);
  }

  if (body.bankAccountNumber !== undefined) {
    updateData.bankAccountNumber = sanitizeString(String(body.bankAccountNumber)).substring(0, 50);
  }

  if (body.bankName !== undefined) {
    updateData.bankCode = sanitizeString(String(body.bankName)).substring(0, 100);
  }

  return updateData;
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
    bio,
    testimonial,
    serviceCategories,
    coverageAreas,
    serviceCoverageStates,
    currentLocation,
    socialLinks,
    profilePicture,
    gallery,
    previousReviews,
    nin,
  } = req.body;

  const passportPhotograph = req.body.passportPhotograph || req.body.passportPhoto || req.body.passportPhotoUrl || profilePicture;

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

  if (user.isVerified) {
    res.status(403);
    throw new Error('Verified vendor profiles must be updated from the authenticated dashboard.');
  }

  const validProfile = getVendorProfileUpdateData({
    businessName,
    businessDescription,
    bio,
    testimonial,
    serviceCategories,
    coverageAreas,
    serviceCoverageStates,
    currentLocation,
    socialLinks,
    profilePicture: passportPhotograph || profilePicture,
    gallery,
    previousReviews,
    businessRegistrationNumber,
    taxId,
    bankAccountNumber,
    bankName,
  });

  let vendor = await Vendor.findOne({ user: user._id });
  if (!vendor) {
    vendor = await Vendor.create({
      user: user._id,
      ...validProfile,
      responseTimeHours: 24,
      nin,
      passportPhotograph,
    });
  } else {
    Object.assign(vendor, validProfile, {
      nin,
      passportPhotograph,
    });
    await vendor.save();
  }

  if (passportPhotograph || profilePicture) {
    user.profilePicture = passportPhotograph || profilePicture;
    await user.save();
  }

  return res.status(200).json({
    success: true,
    message: 'Vendor profile saved. Continue to OTP verification.',
    data: { email: user.email },
  });
});

// @desc    Get the authenticated vendor's own profile
// @route   GET /api/v1/vendors/me
// @access  Private/Vendor
exports.getMyVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user.id })
    .populate('user', 'firstName lastName email phone profilePicture');

  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }

  res.status(200).json({ success: true, data: vendor });
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
  const { category, search, verified, page = 1, limit = 10, city } = req.query;

  if (city && typeof city === 'string' && city.trim()) {
    const safeCity = city.trim();
    const cityCoords = {
      Lagos: { lat: 6.5244, lng: 3.3792 },
      Abuja: { lat: 9.0765, lng: 7.3986 },
      'Port Harcourt': { lat: 4.8156, lng: 7.0498 },
      Ibadan: { lat: 7.3775, lng: 3.947 },
    };

    const base = cityCoords[safeCity] || cityCoords.Lagos;
    const limitNum = Math.max(parseInt(limit, 10) || 20, 1);

    const vendorList = await Vendor.find({
      ...(category ? { serviceCategories: { $in: [sanitizeString(category)] } } : {}),
      ...(verified === 'true' ? { isVerified: true } : {}),
    })
      .select('_id businessName rating totalReviews serviceCategories lat lng user profileCompletionPercentage')
      .limit(limitNum)
      .sort({ rating: -1 })
      .lean();

    const items = vendorList.map((v) => {
      const lat = typeof v.lat === 'number' ? v.lat : base.lat + (Math.random() - 0.5) * 0.05;
      const lng = typeof v.lng === 'number' ? v.lng : base.lng + (Math.random() - 0.5) * 0.05;
      return {
        _id: v._id,
        name: v.businessName,
        category: (v.serviceCategories && v.serviceCategories[0]) || category || 'Vendor',
        rating: v.rating,
        totalReviews: v.totalReviews,
        lat,
        lng,
      };
    });

    return res.status(200).json({
      success: true,
      data: items,
      items,
      message: 'Vendors for map fetched',
    });
  }

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

  const updateData = getVendorProfileUpdateData(req.body);

  if (updateData.profilePicture) {
    const user = await User.findById(vendor.user);
    if (user) {
      user.profilePicture = updateData.profilePicture;
      await user.save();
    }
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
