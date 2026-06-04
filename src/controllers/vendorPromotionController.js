const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const Promotion = require('../models/Promotion');

exports.getMyPromotions = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user.id });
  if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile not found' });

  const { page = 1, limit = 20, isActive } = req.query;
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
  const skip = (safePage - 1) * safeLimit;

  const filter = { vendor: vendor._id };
  if (isActive === 'true' || isActive === true) filter.isActive = true;
  if (isActive === 'false' || isActive === false) filter.isActive = false;

  const [items, total] = await Promise.all([
    Promotion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    Promotion.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items,
  });
});

exports.createPromotion = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user.id });
  if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile not found' });

  const {
    title,
    description,
    serviceCategory,
    discountPercent,
    fixedAmount,
    currency,
    startDate,
    endDate,
    isActive,
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ success: false, message: 'title and description are required' });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
  }

  const parsedStart = new Date(startDate);
  const parsedEnd = new Date(endDate);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date range' });
  }

  if (parsedEnd < parsedStart) {
    return res.status(400).json({ success: false, message: 'endDate must be >= startDate' });
  }

  const promotion = await Promotion.create({
    vendor: vendor._id,
    title: title.toString().trim(),
    description: description.toString().trim(),
    serviceCategory: serviceCategory ? serviceCategory.toString().trim() : undefined,
    discountPercent: discountPercent !== undefined ? Number(discountPercent) : undefined,
    fixedAmount: fixedAmount !== undefined ? Number(fixedAmount) : undefined,
    currency: currency ? currency.toString().trim() : undefined,
    startDate: parsedStart,
    endDate: parsedEnd,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(201).json({ success: true, data: promotion });
});

exports.updatePromotion = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user.id });
  if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile not found' });

  const { id } = req.params;
  const promotion = await Promotion.findById(id);
  if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
  if (promotion.vendor.toString() !== vendor._id.toString()) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const {
    title,
    description,
    serviceCategory,
    discountPercent,
    fixedAmount,
    currency,
    startDate,
    endDate,
    isActive,
  } = req.body;

  if (title !== undefined) promotion.title = title.toString().trim();
  if (description !== undefined) promotion.description = description.toString().trim();
  if (serviceCategory !== undefined) promotion.serviceCategory = serviceCategory ? serviceCategory.toString().trim() : undefined;
  if (discountPercent !== undefined) promotion.discountPercent = Number(discountPercent);
  if (fixedAmount !== undefined) promotion.fixedAmount = Number(fixedAmount);
  if (currency !== undefined) promotion.currency = currency.toString().trim();
  if (startDate !== undefined) promotion.startDate = new Date(startDate);
  if (endDate !== undefined) promotion.endDate = new Date(endDate);
  if (isActive !== undefined) promotion.isActive = Boolean(isActive);

  promotion.updatedBy = req.user.id;

  await promotion.save();
  res.status(200).json({ success: true, data: promotion });
});

exports.deletePromotion = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user.id });
  if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile not found' });

  const { id } = req.params;
  const promotion = await Promotion.findById(id);
  if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
  if (promotion.vendor.toString() !== vendor._id.toString()) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  await Promotion.findByIdAndDelete(id);
  res.status(200).json({ success: true, message: 'Promotion deleted' });
});

exports.getPromotionsPublic = asyncHandler(async (req, res) => {
  const { serviceCategory, page = 1, limit = 20 } = req.query;
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
  const skip = (safePage - 1) * safeLimit;

  const now = new Date();

  const filter = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  };

  if (serviceCategory) {
    filter.serviceCategory = serviceCategory.toString().trim();
  }

  const [items, total] = await Promise.all([
    Promotion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    Promotion.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items,
  });
});

