const asyncHandler = require('express-async-handler');
const Service = require('../models/Service');
const { validatePagination, validatePositiveNumber, sanitizeString } = require('../utils/inputValidator');
const { isServiceOwner } = require('../utils/authorizationHelper');

// @desc    Get all services
// @route   GET /api/v1/services
// @access  Public
exports.getServices = asyncHandler(async (req, res) => {
  const { category, search, featured, page = 1, limit = 10 } = req.query;

  // Validate pagination
  const paginationVal = validatePagination(page, limit, 50);
  const { page: pageNum, limit: limitNum } = paginationVal;

  let filter = { availabilityStatus: 'AVAILABLE' };

  if (category && typeof category === 'string') {
    filter.serviceCategory = { $regex: category, $options: 'i' };
  }

  if (featured === 'true') {
    filter.isFeatured = true;
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const sanitizedSearch = sanitizeString(search).substring(0, 100); // Max 100 chars
    filter.$or = [
      { serviceName: { $regex: sanitizedSearch, $options: 'i' } },
      { description: { $regex: sanitizedSearch, $options: 'i' } },
    ];
  }

  const skip = (pageNum - 1) * limitNum;

  const services = await Service.find(filter)
    .populate('vendor', 'businessName rating')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Service.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: services.length,
    total,
    pages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: services,
  });
});

// @desc    Get single service by ID
// @route   GET /api/v1/services/:id
// @access  Public
exports.getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id)
    .populate('vendor', 'businessName businessDescription rating totalReviews email phone');

  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }

  res.status(200).json({
    success: true,
    data: service,
  });
});

// @desc    Create service
// @route   POST /api/v1/services
// @access  Private (Vendor only)
exports.createService = asyncHandler(async (req, res) => {
  const Vendor = require('../models/Vendor');

  const {
    serviceName,
    serviceCategory,
    description,
    basePrice,
    priceCurrency,
    images,
  } = req.body;

  // If multipart upload is used (field name: `images`), multer will place
  // files on req.files as an array: [{ buffer, mimetype, ... }]
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];

  // Upload received images to Cloudinary and convert them to URL strings.
  // Frontend expects we store the Cloudinary `secure_url` in Service.images.
  const { uploadToCloudinary } = require('../utils/cloudinaryUpload');

  // If files were uploaded, overwrite `images` with Cloudinary URLs.
  let finalImages = images;
  if (uploadedFiles.length) {
    const urls = [];
    for (const file of uploadedFiles) {
      const result = await uploadToCloudinary({
        file,
        folder: 'service_images',
      });
      if (result?.secure_url) urls.push(result.secure_url);
    }
    finalImages = urls;
  }

  // Authorization: rely on vendor profile existence for this authenticated user.
  const vendor = await Vendor.findOne({ user: req.user.id });
  if (!vendor) {
    res.status(403);
    throw new Error(
      `Only vendors can create services (vendor profile missing for user ${req.user?.id}).`
    );
  }

  // Enforce vendor KYC/admin verification before service creation.
  if (!vendor.isVerified) {
    res.status(403);
    throw new Error('Your vendor account is not verified by admin yet. Services are locked until verification.');
  }

  // Validate basePrice if provided
  if (basePrice !== undefined && basePrice !== null) {
    const priceVal = validatePositiveNumber(basePrice, 'basePrice', 1000000);
    if (!priceVal.valid) {
      res.status(400);
      throw new Error(priceVal.error);
    }
  }

  const service = await Service.create({

    vendor: vendor._id,
    serviceName: serviceName ? sanitizeString(serviceName).substring(0, 200) : undefined,
    serviceCategory: serviceCategory ? sanitizeString(serviceCategory).substring(0, 100) : undefined,
    description: description ? sanitizeString(description).substring(0, 2000) : undefined,
    basePrice,
    priceCurrency,
    images: finalImages,
  });

  res.status(201).json({
    success: true,
    message: 'Service created successfully',
    data: service,
  });
});

// @desc    Update service
// @route   PUT /api/v1/services/:id
// @access  Private (Vendor only)
exports.updateService = asyncHandler(async (req, res) => {
  let service = await Service.findById(req.params.id);

  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }

  // Check if user owns this service
  const Vendor = require('../models/Vendor');
  const vendor = await Vendor.findOne({ user: req.user.id });

  if (service.vendor.toString() !== vendor._id.toString() && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to update this service');
  }

  // Enforce verification before allowing vendor updates to services.
  if (req.user.role !== 'ADMIN' && !vendor?.isVerified) {
    res.status(403);
    throw new Error('Your vendor account is not verified by admin yet. Services are locked until verification.');
  }


  service = await Service.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: 'Service updated successfully',
    data: service,
  });
});

// @desc    Delete service
// @route   DELETE /api/v1/services/:id
// @access  Private (Vendor only)
exports.deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }

  // Check if user owns this service
  const Vendor = require('../models/Vendor');
  const vendor = await Vendor.findOne({ user: req.user.id });

  if (service.vendor.toString() !== vendor._id.toString() && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to delete this service');
  }

  // Enforce verification before allowing vendor deletion of services.
  if (req.user.role !== 'ADMIN' && !vendor?.isVerified) {
    res.status(403);
    throw new Error('Your vendor account is not verified by admin yet. Services are locked until verification.');
  }


  await Service.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Service deleted successfully',
  });
});
