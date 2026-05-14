const asyncHandler = require('express-async-handler');
const Announcement = require('../models/Announcement');

// @desc    Get announcements for current user role
// @route   GET /api/v1/announcements
// @access  Private
exports.getAnnouncementsForMe = asyncHandler(async (req, res) => {
  // authMiddleware should attach role on req.user.
  const role = (req.user?.role || req.user?.user?.role || '').toString().toUpperCase();
  if (role !== 'USER' && role !== 'VENDOR') {
    res.status(403);
    throw new Error('Unsupported role for announcements');
  }

  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;

  const skip = (safePage - 1) * safeLimit;

  const filter = { recipientType: role };

  const items = await Announcement.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit);

  const total = await Announcement.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items,
  });
});

