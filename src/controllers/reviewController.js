const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Vendor = require('../models/Vendor');

// @desc    Get all reviews
// @route   GET /api/v1/reviews
// @access  Public
exports.getReviews = asyncHandler(async (req, res) => {
  const { vendor, page = 1, limit = 10 } = req.query;

  let filter = {};

  if (vendor) {
    filter.vendor = vendor;
  }

  const skip = (page - 1) * limit;

  const reviews = await Review.find(filter)
    .populate('user', 'firstName lastName profilePicture')
    .populate('vendor', 'businessName')
    .populate('service', 'serviceName')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Review.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: reviews.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: reviews,
  });
});

// @desc    Get single review by ID
// @route   GET /api/v1/reviews/:id
// @access  Public
exports.getReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id)
    .populate('user', 'firstName lastName profilePicture')
    .populate('vendor', 'businessName')
    .populate('service', 'serviceName');

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  res.status(200).json({
    success: true,
    data: review,
  });
});

// @desc    Create review
// @route   POST /api/v1/reviews
// @access  Private (User)
exports.createReview = asyncHandler(async (req, res) => {
  const {
    booking,
    vendor,
    service,
    rating,
    title,
    comment,
    photos,
  } = req.body;

  // Check if booking exists and belongs to user
  const bookingData = await Booking.findById(booking);
  if (!bookingData) {
    res.status(404);
    throw new Error('Booking not found');
  }

  if (bookingData.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to review this booking');
  }

  // Check if user already reviewed this booking
  const existingReview = await Review.findOne({ booking });
  if (existingReview) {
    res.status(400);
    throw new Error('You have already reviewed this booking');
  }

  const review = await Review.create({
    booking,
    user: req.user.id,
    vendor,
    service,
    rating,
    title,
    comment,
    photos,
  });

  // Update vendor rating
  const vendorReviews = await Review.find({ vendor });
  const averageRating = vendorReviews.reduce((sum, r) => sum + r.rating, 0) / vendorReviews.length;

  await Vendor.findByIdAndUpdate(vendor, {
    rating: parseFloat(averageRating.toFixed(1)),
    totalReviews: vendorReviews.length,
  });

  res.status(201).json({
    success: true,
    message: 'Review posted successfully',
    data: review,
  });
});

// @desc    Update review
// @route   PUT /api/v1/reviews/:id
// @access  Private
exports.updateReview = asyncHandler(async (req, res) => {
  let review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Check if user owns the review
  if (review.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to update this review');
  }

  review = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: 'Review updated successfully',
    data: review,
  });
});

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
// @access  Private
exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Check if user owns the review
  if (review.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to delete this review');
  }

  await Review.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully',
  });
});

// @desc    Add vendor response to review
// @route   PUT /api/v1/reviews/:id/vendor-response
// @access  Private (Vendor)
exports.addVendorResponse = asyncHandler(async (req, res) => {
  const { vendorResponse } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Check if user is the vendor owner
  // review.vendor is a Vendor._id; req.user is a User.
  const Vendor = require('../models/Vendor');
  const myVendor = await Vendor.findOne({ user: req.user.id });

  if (review.vendor.toString() !== (myVendor?._id?.toString?.() || '') && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to respond to this review');
  }

  review.vendorResponse = vendorResponse;
  review.vendorResponseDate = new Date();

  await review.save();

  res.status(200).json({
    success: true,
    message: 'Response added successfully',
    data: review,
  });
});

// @desc    Mark review as helpful
// @route   PUT /api/v1/reviews/:id/helpful
// @access  Public
exports.markHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  review.helpfulCount += 1;
  await review.save();

  res.status(200).json({
    success: true,
    message: 'Review marked as helpful',
    data: review,
  });
});

// @desc    Mark review as unhelpful
// @route   PUT /api/v1/reviews/:id/unhelpful
// @access  Public
exports.markUnhelpful = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  review.unhelpfulCount += 1;
  await review.save();

  res.status(200).json({
    success: true,
    message: 'Review marked as unhelpful',
    data: review,
  });
});
