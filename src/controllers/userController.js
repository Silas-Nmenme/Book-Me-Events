const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password -refreshToken');

  res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});

// @desc    Get single user by ID
// @route   GET /api/v1/users/:id
// @access  Private
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -refreshToken');

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
  const { firstName, lastName, phone, bio, profilePicture } = req.body;

  let user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if user is updating their own profile
  if (req.user.id !== req.params.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to update this user');
  }

  user = await User.findByIdAndUpdate(
    req.params.id,
    { firstName, lastName, phone, bio, profilePicture },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

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
// @access  Private
exports.getUserBookings = asyncHandler(async (req, res) => {
  const Booking = require('../models/Booking');
  
  const bookings = await Booking.find({ user: req.params.id })
    .populate('vendor')
    .populate('service')
    .populate('request');

  res.status(200).json({
    success: true,
    count: bookings.length,
    data: bookings,
  });
});

// @desc    Get user requests
// @route   GET /api/v1/users/:id/requests
// @access  Private
exports.getUserRequests = asyncHandler(async (req, res) => {
  const Request = require('../models/Request');
  
  const requests = await Request.find({ user: req.params.id })
    .populate('vendor')
    .populate('service');

  res.status(200).json({
    success: true,
    count: requests.length,
    data: requests,
  });
});
