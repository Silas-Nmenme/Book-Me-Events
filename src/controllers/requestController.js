const asyncHandler = require('express-async-handler');
const Request = require('../models/Request');
const Service = require('../models/Service');
const Vendor = require('../models/Vendor');
const { validatePagination, validatePositiveNumber } = require('../utils/inputValidator');
const { isResourceOwner } = require('../utils/authorizationHelper');

// @desc    Get all requests
// @route   GET /api/v1/requests
// @access  Private
exports.getRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  // Validate pagination
  const paginationVal = validatePagination(page, limit, 50);
  const { page: pageNum, limit: limitNum } = paginationVal;

  let filter = {};

  if (status) {
    const validStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'BOOKED'];
    const statusUpper = status.toString().toUpperCase();
    if (validStatuses.includes(statusUpper)) {
      filter.status = statusUpper;
    }
  } else {
    filter.status = { $ne: 'BOOKED' };
  }

  // Authorization: Vendors see requests for their services, Users see their own requests
  if (req.user.role === 'VENDOR') {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (vendor) filter.vendor = vendor._id;
  } else if (req.user.role === 'USER') {
    filter.user = req.user.id;
  }
  // ADMIN sees all requests


  const skip = (pageNum - 1) * limitNum;

  const requests = await Request.find(filter)
    .populate('user', 'firstName lastName email phone')
    .populate('vendor', 'businessName user')
    .populate('service')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });


  const total = await Request.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: requests,
  });
});

// @desc    Get single request by ID
// @route   GET /api/v1/requests/:id
// @access  Private
exports.getRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id)
    .populate('user', 'firstName lastName email phone profilePicture')
    .populate('vendor', 'businessName email phone user')
    .populate('service');

  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  // Authorization: Users can only see their own requests, Vendors can see requests for their services, Admin can see all
  if (req.user.role !== 'ADMIN') {
    const isOwner = request.user && request.user._id && isResourceOwner(req.user.id, request.user._id);
    const isVendor = request.vendor && request.vendor._id && request.vendor._id.toString() === req.user._id?.toString();
    
    if (!isOwner && !isVendor) {
      res.status(403);
      throw new Error('Not authorized to access this request');
    }
  }

  res.status(200).json({
    success: true,
    data: request,
  });
});

// @desc    Create service request
// @route   POST /api/v1/requests
// @access  Private (User only)
exports.createRequest = asyncHandler(async (req, res) => {
  const {
    // from UI dropdown
    serviceId,
    // keep backwards compatibility with old UI
    service,


    eventDate,
    eventLocation,
    eventDescription,
    guestCount,
    budgetAmount,
    notes,
  } = req.body;

  const resolvedServiceId = serviceId || service;
  if (!resolvedServiceId) {
    res.status(400);
    throw new Error('Service is required');
  }

  const serviceExists = await Service.findById(resolvedServiceId);
  if (!serviceExists) {
    res.status(400);
    throw new Error('Service not found');
  }

  const vendor = serviceExists.vendor;
  if (!vendor) {
    res.status(400);
    throw new Error('Service vendor not found');
  }



  // Convert/validate eventDate early for clearer 400s
  const parsedEventDate = eventDate ? new Date(eventDate) : null;
  if (!parsedEventDate || Number.isNaN(parsedEventDate.getTime())) {
    res.status(400);
    throw new Error('Valid eventDate is required');
  }

  if (!eventLocation || typeof eventLocation !== 'string' || eventLocation.trim().length === 0) {
    res.status(400);
    throw new Error('eventLocation is required');
  }

  if (!eventDescription || typeof eventDescription !== 'string' || eventDescription.trim().length === 0) {
    res.status(400);
    throw new Error('eventDescription is required');
  }

  // Validate budgetAmount if provided
  if (budgetAmount !== undefined && budgetAmount !== null) {
    const budgetVal = validatePositiveNumber(budgetAmount, 'budgetAmount', 1000000);
    if (!budgetVal.valid) {
      res.status(400);
      throw new Error(budgetVal.error);
    }
  }

  // Validate guestCount if provided
  if (guestCount !== undefined && guestCount !== null) {
    const guestVal = validatePositiveNumber(guestCount, 'guestCount', 10000);
    if (!guestVal.valid) {
      res.status(400);
      throw new Error(guestVal.error);
    }
  }

const request = await Request.create({
    user: req.user.id,
    vendor,
    service: resolvedServiceId || undefined,
    eventDate: parsedEventDate,
    eventLocation: eventLocation.trim(),
    eventDescription: eventDescription.trim(),
    guestCount,
    budgetAmount,
    notes: notes ? notes.trim().substring(0, 1000) : undefined, // Max 1000 chars
    responseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // USER activity
  const { logActivity } = require('../utils/activityLog');
  await logActivity({
    userId: req.user.id,
    actorId: req.user.id,
    actionType: 'REQUEST_CREATED',
    entityType: 'REQUEST',
    entityId: request._id,
    metadata: { vendor: vendor?.toString?.() || vendor, service: resolvedServiceId },
    severity: 'ACTION',
  });



  res.status(201).json({
    success: true,
    message: 'Service request created successfully',
    data: request,
  });
});


// @desc    Accept service request (Vendor)
// @route   PUT /api/v1/requests/:id/accept
// @access  Private (Vendor only)
exports.acceptRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  // req.user is a User, while request.vendor is a Vendor._id.
  if (req.user.role !== 'ADMIN') {
    const vendor = await Vendor.findOne({ user: req.user.id || req.user._id });
    const myVendorId = vendor?._id;
    if (!myVendorId || request.vendor.toString() !== myVendorId.toString()) {
      res.status(403);
      throw new Error('Not authorized to accept this request');
    }
  }

  request.status = 'ACCEPTED';
  await request.save();

  // USER + VENDOR activity (user is request.user)
  const { logActivity } = require('../utils/activityLog');
  await logActivity({
    userId: request.user.toString(),
    actorId: req.user.id,
    actionType: 'REQUEST_ACCEPTED',
    entityType: 'REQUEST',
    entityId: request._id,
    metadata: { vendor: request.vendor?.toString?.() || request.vendor },
    severity: 'SUCCESS',
  });

  res.status(200).json({
    success: true,
    message: 'Request accepted successfully',
    data: request,
  });
});

// @desc    Decline service request (Vendor)
// @route   PUT /api/v1/requests/:id/decline
// @access  Private (Vendor only)
exports.declineRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  // req.user is a User, while request.vendor is a Vendor._id.
  if (req.user.role !== 'ADMIN') {
    const vendor = await Vendor.findOne({ user: req.user.id || req.user._id });
    const myVendorId = vendor?._id;
    if (!myVendorId || request.vendor.toString() !== myVendorId.toString()) {
      res.status(403);
      throw new Error('Not authorized to decline this request');
    }
  }

  request.status = 'DECLINED';
  await request.save();

  const { logActivity } = require('../utils/activityLog');
  await logActivity({
    userId: request.user.toString(),
    actorId: req.user.id,
    actionType: 'REQUEST_DECLINED',
    entityType: 'REQUEST',
    entityId: request._id,
    severity: 'WARN',
  });

  res.status(200).json({
    success: true,
    message: 'Request declined successfully',
    data: request,
  });
});

// @desc    Cancel service request (User)
// @route   PUT /api/v1/requests/:id/cancel
// @access  Private (User only)
exports.cancelRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  // Check if user owns this request
  if (request.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to cancel this request');
  }

  request.status = 'CANCELLED';
  await request.save();

  const { logActivity } = require('../utils/activityLog');
  await logActivity({
    userId: request.user.toString(),
    actorId: req.user.id,
    actionType: 'REQUEST_CANCELLED',
    entityType: 'REQUEST',
    entityId: request._id,
    severity: 'WARN',
  });

  res.status(200).json({
    success: true,
    message: 'Request cancelled successfully',
    data: request,
  });
});

// @desc    Update request
// @route   PUT /api/v1/requests/:id
// @access  Private
exports.updateRequest = asyncHandler(async (req, res) => {
  let request = await Request.findById(req.params.id);


  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  // Check if user owns this request
  if (request.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to update this request');
  }

  request = await Request.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: 'Request updated successfully',
    data: request,
  });
});

// @desc    Delete request (User only)
// @route   DELETE /api/v1/requests/:id
// @access  Private (User only)
exports.deleteRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  // Check if user owns this request
  if (request.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to delete this request');
  }

  await Request.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Request deleted successfully',
  });
});

