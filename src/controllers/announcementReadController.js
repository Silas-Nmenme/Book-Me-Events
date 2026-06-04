const asyncHandler = require('express-async-handler');
const Announcement = require('../models/Announcement');
const AnnouncementRead = require('../models/AnnouncementRead');

exports.markAnnouncementRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const announcement = await Announcement.findById(id);
  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found',
    });
  }

  const role = req.user.role;
  const normalizedRole = (role || '').toString().toUpperCase();
  if (normalizedRole !== 'USER' && normalizedRole !== 'VENDOR') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
  }

  // Only allow users to mark reads if announcement targets their role.
  if (announcement.recipientType !== normalizedRole) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden for this announcement',
    });
  }

  // Upsert read record
  await AnnouncementRead.updateOne(
    { user: req.user.id, announcement: announcement._id },
    { $set: { readAt: new Date() } },
    { upsert: true }
  );

  res.status(200).json({
    success: true,
    message: 'Announcement marked as read',
  });
});

exports.getMyAnnouncements = asyncHandler(async (req, res) => {
  const role = (req.user.role || '').toString().toUpperCase();
  if (role !== 'USER' && role !== 'VENDOR') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { page = 1, limit = 20, unreadOnly } = req.query;
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
  const skip = (safePage - 1) * safeLimit;

  const query = { recipientType: role };

  if (unreadOnly === 'true' || unreadOnly === true) {
    // Unread: announcements not present in AnnouncementRead
    const readIds = await AnnouncementRead.find({ user: req.user.id })
      .select('announcement')
      .lean();
    const readSet = new Set(readIds.map((x) => x.announcement.toString()));

    const all = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const filtered = all.filter((a) => !readSet.has(a._id.toString()));
    const slice = filtered.slice(skip, skip + safeLimit);

    return res.status(200).json({
      success: true,
      count: slice.length,
      total: filtered.length,
      pages: Math.ceil(filtered.length / safeLimit),
      currentPage: safePage,
      data: slice,
    });
  }

  const announcements = await Announcement.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit);

  const total = await Announcement.countDocuments(query);

  return res.status(200).json({
    success: true,
    count: announcements.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: announcements,
  });
});


