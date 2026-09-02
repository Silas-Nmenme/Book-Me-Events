const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { userOwnsResource, throwAuthorizationError, parsePagination } = require('../utils/securityUtils');
const { validatePagination, validateName, validatePhone, sanitizeString } = require('../utils/inputValidator');
const { isResourceOwner } = require('../utils/authorizationHelper');

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  // Only ADMIN can list all users
  if (req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to view all users');
  }

  // Validate pagination
  const { page: pageNum, limit: limitNum } = validatePagination(page, limit, 50);

  const skip = (pageNum - 1) * limitNum;

  const users = await User.find()
    .select('-password -refreshToken -otpCode -otpSecret')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments();

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: users,
  });
});

// @desc    Get single user by ID
// @route   GET /api/v1/users/:id
// @access  Private (User can view own profile or Admin can view any)
exports.getUser = asyncHandler(async (req, res) => {
  // SECURITY: Only allow users to view their own profile or admins to view any
  if (!isResourceOwner(req.user.id, req.params.id) && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to view this user profile');
  }

  const user = await User.findById(req.params.id).select('-password -refreshToken -otpCode -otpSecret');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Update user profile
// @route   PUT /api/v1/users/:id
// @access  Private
exports.updateUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, bio, profilePicture } = req.body || {};

  let user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if user is updating their own profile
  if (!isResourceOwner(req.user.id || req.user._id, req.params.id) && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to update this user');
  }

  // Validate input if provided
  const updateData = {};
  
  if (firstName !== undefined) {
    const firstNameVal = validateName(firstName, 'firstName');
    if (!firstNameVal.valid) {
      res.status(400);
      throw new Error(firstNameVal.error);
    }
    updateData.firstName = firstNameVal.value;
  }

  if (lastName !== undefined) {
    const lastNameVal = validateName(lastName, 'lastName');
    if (!lastNameVal.valid) {
      res.status(400);
      throw new Error(lastNameVal.error);
    }
    updateData.lastName = lastNameVal.value;
  }

  if (phone !== undefined) {
    const phoneVal = validatePhone(phone);
    if (!phoneVal.valid) {
      res.status(400);
      throw new Error(phoneVal.error);
    }
    updateData.phone = phoneVal.value;
  }

  if (bio !== undefined && bio !== null) {
    updateData.bio = sanitizeString(bio).substring(0, 500); // Max 500 chars
  }

  if (profilePicture !== undefined && profilePicture !== null) {
    updateData.profilePicture = profilePicture; // Should come from file upload endpoint
  }

  if (!Object.keys(updateData).length) {
    res.status(400);
    throw new Error('At least one profile field is required');
  }

  try {
    user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -refreshToken');
  } catch (error) {
    if (error?.code === 11000) {
      res.status(400);
      throw new Error('That phone number is already in use');
    }
    if (error?.name === 'ValidationError') {
      res.status(400);
      throw new Error('Please check the profile details and try again');
    }
    throw error;
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if user is deleting their own account
  if (req.user.id !== req.params.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to delete this user');
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

// @desc    Get user bookings
// @route   GET /api/v1/users/:id/bookings
// @access  Private (User can view own bookings or Admin can view any)
exports.getUserBookings = asyncHandler(async (req, res) => {
  // SECURITY: Only allow users to view their own bookings or admins to view any
  if (!isResourceOwner(req.user.id, req.params.id) && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to view these bookings');
  }

  const Booking = require('../models/Booking');
  const { page = 1, limit = 10 } = req.query;

  // Validate pagination
  const { page: pageNum, limit: limitNum } = validatePagination(page, limit, 50);

  const skip = (pageNum - 1) * limitNum;

  const bookings = await Booking.find({ user: req.params.id })
    .populate('vendor', 'businessName email phone')
    .populate('service', 'name serviceName price')
    .populate('request')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Booking.countDocuments({ user: req.params.id });

  res.status(200).json({
    success: true,
    count: bookings.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: bookings,
  });
});

// @desc    Get user requests
// @route   GET /api/v1/users/:id/requests
// @access  Private (User can view own requests or Admin can view any)
exports.getUserRequests = asyncHandler(async (req, res) => {
  // SECURITY: Only allow users to view their own requests or admins to view any
  if (!isResourceOwner(req.user.id, req.params.id) && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to view these requests');
  }

  const Request = require('../models/Request');
  const { page = 1, limit = 10 } = req.query;
  const { skip, limit: parsedLimit } = parsePagination(page, limit, 100);

  const requests = await Request.find({ user: req.params.id })
    .populate('vendor', 'businessName email user')
    .populate('service', 'name serviceName price')
    .skip(skip)
    .limit(parsedLimit)
    .sort({ createdAt: -1 });

  const total = await Request.countDocuments({ user: req.params.id });

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    pages: Math.ceil(total / parsedLimit),
    currentPage: parseInt(page, 10),
    data: requests,
  });
});
