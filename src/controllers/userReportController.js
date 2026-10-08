const asyncHandler = require('express-async-handler');
const Request = require('../models/Request');
const User = require('../models/User');
const UserReport = require('../models/UserReport');
const Vendor = require('../models/Vendor');
const { createNotification } = require('../utils/notificationService');

exports.createUserReport = asyncHandler(async (req, res) => {
  const { requestId, reason, target = 'USER' } = req.body || {};
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  const reportedRole = target === 'VENDOR' ? 'VENDOR' : 'USER';
  if (!requestId || !['USER', 'VENDOR'].includes(target) || trimmedReason.length < 10 || trimmedReason.length > 2000) {
    return res.status(400).json({ success: false, message: 'A valid report target, request, and 10-2000 character reason are required' });
  }

  const request = await Request.findById(requestId).select('user vendor');
  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  let reportedUser;
  if (reportedRole === 'USER') {
    const vendor = await Vendor.findOne({ user: req.user.id }).select('_id');
    if (!vendor || String(request.vendor) !== String(vendor._id)) {
      return res.status(404).json({ success: false, message: 'Request not found for this vendor' });
    }
    reportedUser = request.user;
  } else {
    if (String(request.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You can only report vendors on your own requests' });
    }
    const vendor = await Vendor.findById(request.vendor).select('user');
    if (!vendor?.user) return res.status(404).json({ success: false, message: 'Vendor not found' });
    reportedUser = vendor.user;
  }

  const report = await UserReport.create({
    reporter: req.user.id,
    reportedUser,
    reportedRole,
    request: request._id,
    reason: trimmedReason,
  });
  const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id');
  const io = req.app?.get?.('io');
  await Promise.all(admins.map((admin) => createNotification({
    recipientId: admin._id,
    type: 'REPORT_SUBMITTED',
    title: 'Report submitted',
    message: `A ${req.user.role.toLowerCase()} submitted a report linked to a service request.`,
    link: 'admin-reports.html',
    entityType: 'UserReport',
    entityId: report._id,
    io,
  })));

  res.status(201).json({ success: true, data: report });
});

exports.getUserReports = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    UserReport.find(filter)
      .populate('reporter', 'firstName lastName email')
      .populate('reportedUser', 'firstName lastName email role')
      .populate('request', 'eventDate eventLocation status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    UserReport.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: items, total, page, pages: Math.ceil(total / limit) });
});

exports.updateUserReport = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body || {};
  const validStatuses = ['IN_REVIEW', 'RESOLVED', 'DISMISSED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be IN_REVIEW, RESOLVED, or DISMISSED' });
  }

  const updates = {
    status,
    reviewedBy: req.user.id,
    reviewedAt: new Date(),
  };
  if (typeof adminNotes === 'string') updates.adminNotes = adminNotes.trim().slice(0, 2000);

  const report = await UserReport.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

  await createNotification({
    recipientId: report.reporter,
    type: 'REPORT_UPDATE',
    title: 'Report updated',
    message: `Your report status is now ${status.replace('_', ' ').toLowerCase()}.`,
    link: 'vendor-service.html',
    entityType: 'UserReport',
    entityId: report._id,
    io: req.app?.get?.('io'),
  });
  res.status(200).json({ success: true, data: report });
});
