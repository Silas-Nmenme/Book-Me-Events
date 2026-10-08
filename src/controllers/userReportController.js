const asyncHandler = require('express-async-handler');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Request = require('../models/Request');
const User = require('../models/User');
const UserReport = require('../models/UserReport');
const Vendor = require('../models/Vendor');
const { sendEmail } = require('../utils/emailClient');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');
const { cloudinary } = require('../config/cloudinary');
const { createNotification } = require('../utils/notificationService');
const { logActivity } = require('../utils/activityLog');

const REASONS = new Set([
  'FRAUD_SCAM', 'POOR_SERVICE', 'MISREPRESENTATION', 'HARASSMENT', 'NO_SHOW',
  'PAYMENT_ISSUE', 'FAKE_PROFILE', 'INAPPROPRIATE_BEHAVIOR', 'ABUSE', 'OTHER',
]);

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[character]));

const displayReason = (report) => report.reason === 'OTHER'
  ? report.otherReason || 'Other'
  : report.reason.replaceAll('_', ' ').toLowerCase();

exports.getReportVendors = asyncHandler(async (req, res) => {
  const [vendorRecords, requestedVendorIds, bookedVendorIds, requests, bookings] = await Promise.all([
    Vendor.find().select('businessName user').populate('user', 'firstName lastName role isActive'),
    Request.distinct('vendor', { user: req.user.id }),
    Booking.distinct('vendor', { user: req.user.id }),
    Request.find({ user: req.user.id })
      .select('vendor eventDate eventDescription status')
      .populate('vendor', 'businessName')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Booking.find({ user: req.user.id })
      .select('vendor eventDate bookingStatus')
      .populate('vendor', 'businessName')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const preferredIds = new Set([...requestedVendorIds, ...bookedVendorIds].map(String));
  const vendors = vendorRecords
    .filter((vendor) => vendor.user?.role === 'VENDOR' && vendor.user.isActive)
    .map((vendor) => ({
      _id: vendor._id,
      businessName: vendor.businessName,
      preferred: preferredIds.has(String(vendor._id)),
    }))
    .sort((left, right) => Number(right.preferred) - Number(left.preferred) || left.businessName.localeCompare(right.businessName));

  res.status(200).json({
    success: true,
    data: {
      vendors,
      requests: requests.map((item) => ({
        _id: item._id,
        vendorId: item.vendor?._id,
        vendorName: item.vendor?.businessName,
        eventDate: item.eventDate,
        label: `${item.vendor?.businessName || 'Vendor'} · ${new Date(item.eventDate).toLocaleDateString()} · Request`,
      })),
      bookings: bookings.map((item) => ({
        _id: item._id,
        vendorId: item.vendor?._id,
        vendorName: item.vendor?.businessName,
        eventDate: item.eventDate,
        label: `${item.vendor?.businessName || 'Vendor'} · ${new Date(item.eventDate).toLocaleDateString()} · Booking`,
      })),
    },
  });
});

exports.createUserReport = asyncHandler(async (req, res) => {
  const {
    vendorId,
    requestId,
    bookingId,
    target,
    reason: requestedReason,
    reasonCode,
    otherReason,
    description: submittedDescription,
  } = req.body || {};
  const reportedRole = target || (req.user.role === 'USER' ? 'VENDOR' : 'USER');
  if (!['USER', 'VENDOR'].includes(reportedRole)) {
    return res.status(400).json({ success: false, message: 'Invalid report target' });
  }
  if (reportedRole === 'VENDOR' && req.user.role !== 'USER') {
    return res.status(403).json({ success: false, message: 'Only users may report a vendor account' });
  }

  const legacyReason = typeof requestedReason === 'string' && !REASONS.has(requestedReason) ? requestedReason.trim() : '';
  const reason = reasonCode || (REASONS.has(requestedReason) ? requestedReason : legacyReason ? 'OTHER' : requestedReason);
  const other = typeof otherReason === 'string' ? otherReason.trim() : legacyReason;
  const description = typeof submittedDescription === 'string' ? submittedDescription.trim() : legacyReason;
  if (!REASONS.has(reason) || (reason === 'OTHER' && (!other || other.length > 200)) || description.length < 20 || description.length > 5000) {
    return res.status(400).json({ success: false, message: 'Choose a report reason and provide a 20-5000 character description. Other reasons must be specified.' });
  }
  if (reason === 'OTHER' && !other) {
    return res.status(400).json({ success: false, message: 'Please specify the other report reason.' });
  }
  if (requestId && !mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(400).json({ success: false, message: 'Invalid request ID' });
  }
  if (bookingId && !mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid booking ID' });
  }

  let vendor;
  let request = null;
  let booking = null;
  if (reportedRole === 'VENDOR') {
    if (!mongoose.Types.ObjectId.isValid(vendorId || '')) {
      return res.status(400).json({ success: false, message: 'Select a valid vendor' });
    }
    vendor = await Vendor.findById(vendorId).populate('user', 'firstName lastName email role isActive');
    if (!vendor || vendor.user?.role !== 'VENDOR' || !vendor.user.isActive) {
      return res.status(404).json({ success: false, message: 'Vendor not found or unavailable' });
    }
    if (requestId) {
      request = await Request.findOne({ _id: requestId, user: req.user.id, vendor: vendor._id });
      if (!request) return res.status(400).json({ success: false, message: 'The selected request does not belong to this vendor and account' });
    }
    if (bookingId) {
      booking = await Booking.findOne({ _id: bookingId, user: req.user.id, vendor: vendor._id });
      if (!booking) return res.status(400).json({ success: false, message: 'The selected booking does not belong to this vendor and account' });
    }
    if (request && booking && String(request.booking) !== String(booking._id) && String(booking.request) !== String(request._id)) {
      return res.status(400).json({ success: false, message: 'The selected request and booking are not related' });
    }
  } else {
    if (req.user.role !== 'VENDOR') {
      return res.status(403).json({ success: false, message: 'Only vendors may report a user account' });
    }
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ success: false, message: 'A service request is required to report a user' });
    }
    const vendorProfile = await Vendor.findOne({ user: req.user.id }).select('_id');
    if (!vendorProfile) return res.status(403).json({ success: false, message: 'Vendor profile not found' });
    request = await Request.findOne({ _id: requestId, vendor: vendorProfile?._id }).select('user vendor booking');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found for this vendor' });
    vendor = await Vendor.findById(request.vendor).populate('user', 'firstName lastName email role isActive');
    if (!vendor?.user) return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    if (bookingId) {
      booking = await Booking.findOne({ _id: bookingId, vendor: vendor._id, request: request._id });
      if (!booking) return res.status(400).json({ success: false, message: 'The selected booking is not related to this request' });
    }
  }

  const reporter = req.user;
  const reportedAccount = reportedRole === 'VENDOR'
    ? vendor.user
    : await User.findById(request.user).select('_id firstName lastName email role');
  if (!reportedAccount) return res.status(404).json({ success: false, message: 'Reported account not found' });

  const files = Array.isArray(req.files) ? req.files : [];
  const report = new UserReport({
    reporter: req.user.id,
    reportedUser: reportedRole === 'VENDOR' ? vendor.user._id : request.user,
    reportedRole,
    vendor: vendor._id,
    request: request?._id,
    booking: booking?._id,
    reason,
    otherReason: reason === 'OTHER' ? other : undefined,
    description,
    priority: 'MEDIUM',
  });
  const uploadedAssets = [];
  try {
    for (const file of files) {
      const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
      const uploaded = await uploadToCloudinary({
        file,
        folder: `user_reports/${report.reportId}`,
        resourceType,
        deliveryType: 'authenticated',
        publicId: resourceType === 'raw' ? `${report.reportId}-${uploadedAssets.length + 1}.pdf` : undefined,
      });
      uploadedAssets.push({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        resourceType,
        mimeType: file.mimetype,
        originalName: file.originalname.replace(/[\r\n]/g, '').slice(0, 255),
        size: file.size,
      });
    }
    report.evidence = uploadedAssets;
    await report.save();
  } catch (error) {
    await Promise.all(uploadedAssets.map((asset) => cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType }).catch(() => null)));
    throw error;
  }

  const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id email');
  const adminEmails = [...new Set([
    process.env.ADMIN_EMAIL,
    process.env.SUPPORT_EMAIL,
    ...admins.map((admin) => admin.email),
  ].filter(Boolean))];
  const reportReason = displayReason(report);
  const reportedName = reportedRole === 'VENDOR'
    ? vendor.businessName
    : `${reportedAccount?.firstName || ''} ${reportedAccount?.lastName || ''}`.trim() || reportedAccount?.email || 'User account';
  const reportedLabel = reportedRole === 'VENDOR' ? 'Reported vendor' : 'Reported account';
  const reportDate = report.createdAt.toLocaleString();
  const evidenceLines = report.evidence.length
    ? report.evidence.map((asset) => asset.originalName).join('\n')
    : 'No evidence attached.';
  const evidenceHtml = report.evidence.length
    ? report.evidence.map((asset) => `<li>${escapeHtml(asset.originalName)}</li>`).join('')
    : '<li>No evidence attached.</li>';
  const safeDescription = escapeHtml(report.description).replace(/\n/g, '<br>');
  const html = `<h2>Report ${escapeHtml(report.reportId)}</h2><p><strong>${reportedLabel}:</strong> ${escapeHtml(reportedName)}</p><p><strong>Reason:</strong> ${escapeHtml(reportReason)}</p><p><strong>Description:</strong><br>${safeDescription}</p><p><strong>Date submitted:</strong> ${escapeHtml(reportDate)}</p><p><strong>Status:</strong> Pending Review</p><p><strong>Evidence:</strong></p><ul>${evidenceHtml}</ul>`;
  const reportUrl = `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/admin-reports.html?reportId=${encodeURIComponent(report.reportId)}`;
  const messageText = `Report ID: ${report.reportId}\n${reportedLabel}: ${reportedName}\nReason: ${reportReason}\nDescription: ${report.description}\nDate submitted: ${reportDate}\nStatus: Pending Review\nEvidence:\n${evidenceLines}`;
  const emailJobs = [
    sendEmail({
      to: reporter?.email,
      subject: `Report received (${report.reportId})`,
      text: messageText,
      html: `${html}<p>Your report has been received and is pending review.</p>`,
    }),
    sendEmail({
      to: reportedAccount?.email,
      subject: 'A report has been submitted regarding your account',
      text: 'A report has been submitted regarding your account. The platform will review the report and take appropriate action based on its findings.',
      html: '<p>A report has been submitted regarding your account. The platform will review the report and take appropriate action based on its findings.</p>',
    }),
    ...adminEmails.map((email) => sendEmail({
      to: email,
      subject: `Participant report submitted (${report.reportId})`,
      text: `${messageText}\nReview: ${reportUrl}`,
      html: `${html}<p><a href="${escapeHtml(reportUrl)}">Review report</a></p>`,
    })),
  ];
  await Promise.all(emailJobs);

  const io = req.app?.get?.('io');
  await Promise.all([
    createNotification({
      recipientId: reporter._id,
      type: 'REPORT_SUBMITTED',
      title: 'Report submitted',
      message: `Report ${report.reportId} is pending review.`,
      link: 'notifications.html',
      entityType: 'UserReport',
      entityId: report._id,
      io,
    }),
    createNotification({
      recipientId: reportedAccount._id,
      type: 'REPORT_SUBMITTED',
      title: 'Report notice',
      message: 'A report has been submitted regarding your account. The platform will review the report and take appropriate action based on its findings.',
      link: 'notifications.html',
      entityType: 'UserReport',
      entityId: report._id,
      io,
    }),
    ...admins.map((admin) => createNotification({
      recipientId: admin._id,
      type: 'REPORT_SUBMITTED',
      title: 'Vendor report submitted',
      message: `Report ${report.reportId} is pending review.`,
      link: `admin-reports.html?reportId=${encodeURIComponent(report.reportId)}`,
      entityType: 'UserReport',
      entityId: report._id,
      io,
    })),
  ]);
  await logActivity({
    userId: req.user.id,
    actorId: req.user.id,
    actionType: 'REPORT_SUBMITTED',
    entityType: 'USER_REPORT',
    entityId: report._id,
    metadata: { reportId: report.reportId, vendor: vendor._id, request: request?._id, booking: booking?._id },
    severity: 'ACTION',
  });

  res.status(201).json({
    success: true,
    data: {
      _id: report._id,
      reportId: report.reportId,
      status: report.status,
      evidence: report.evidence.map(({ originalName, mimeType, size }) => ({ originalName, mimeType, size })),
    },
  });
});

exports.getUserReports = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const allowedStatuses = ['PENDING_REVIEW', 'UNDER_INVESTIGATION', 'RESOLVED', 'REJECTED', 'ESCALATED', 'OPEN', 'IN_REVIEW', 'DISMISSED'];
  if (req.query.status && !allowedStatuses.includes(req.query.status)) {
    return res.status(400).json({ success: false, message: 'Invalid report status filter' });
  }
  const filter = {};
  const statusAliases = {
    PENDING_REVIEW: ['PENDING_REVIEW', 'OPEN'],
    UNDER_INVESTIGATION: ['UNDER_INVESTIGATION', 'IN_REVIEW'],
    REJECTED: ['REJECTED', 'DISMISSED'],
  };
  if (req.query.status) filter.status = { $in: statusAliases[req.query.status] || [req.query.status] };
  if (req.query.reportId) filter.reportId = req.query.reportId.toString().trim().slice(0, 80);
  const [items, total] = await Promise.all([
    UserReport.find(filter)
      .populate('reporter', 'firstName lastName email')
      .populate('reportedUser', 'firstName lastName email role')
      .populate('vendor', 'businessName user')
      .populate('request', 'eventDate eventLocation eventDescription status')
      .populate('booking', 'eventDate eventLocation bookingStatus paymentStatus totalAmount amountCurrency')
      .populate('reviewedBy', 'firstName lastName email')
      .populate('internalNotes.admin', 'firstName lastName email')
      .populate('moderationActions.admin', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    UserReport.countDocuments(filter),
  ]);
  const legacyStatusMap = { OPEN: 'PENDING_REVIEW', IN_REVIEW: 'UNDER_INVESTIGATION', DISMISSED: 'REJECTED' };
  const reports = items.map((item) => ({
    ...item,
    status: legacyStatusMap[item.status] || item.status,
    evidence: (item.evidence || []).map((asset) => ({
      ...asset,
      url: cloudinary.url(asset.publicId, {
        resource_type: asset.resourceType,
        type: 'authenticated',
        sign_url: true,
        secure: true,
      }),
    })),
  }));
  res.status(200).json({ success: true, data: reports, total, page, pages: Math.ceil(total / limit) });
});

exports.updateUserReport = asyncHandler(async (req, res) => {
  const {
    status,
    priority,
    note,
    adminNotes,
    moderationAction,
    durationDays,
    details,
  } = req.body || {};
  const validStatuses = ['PENDING_REVIEW', 'UNDER_INVESTIGATION', 'RESOLVED', 'REJECTED', 'ESCALATED'];
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const validActions = ['WARNING', 'TEMPORARY_SUSPENSION', 'PERMANENT_SUSPENSION', 'RESTRICTION', 'RESTORE_ACCOUNT'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid report status' });
  }
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ success: false, message: 'Invalid report priority' });
  }
  if (moderationAction && !validActions.includes(moderationAction)) {
    return res.status(400).json({ success: false, message: 'Invalid moderation action' });
  }

  const report = await UserReport.findById(req.params.id);
  if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
  if (!report.reportId) report.reportId = `RPT-${randomUUID()}`;
  if (!report.vendor && report.request) {
    const linkedRequest = await Request.findById(report.request).select('vendor');
    if (linkedRequest?.vendor) report.vendor = linkedRequest.vendor;
  }
  if (!REASONS.has(report.reason)) {
    report.otherReason = report.otherReason || String(report.reason || 'Legacy report').slice(0, 200);
    report.reason = 'OTHER';
  }
  if (!report.description) report.description = report.otherReason || 'Legacy report submitted before description support.';
  const noteText = typeof note === 'string' ? note.trim() : typeof adminNotes === 'string' ? adminNotes.trim() : '';
  if (noteText.length > 2000) return res.status(400).json({ success: false, message: 'Internal note must be 2000 characters or fewer' });
  if (noteText) {
    report.internalNotes.push({ admin: req.user.id, note: noteText });
    report.adminNotes = noteText;
  }
  report.status = status;
  if (priority) report.priority = priority;
  report.reviewedBy = req.user.id;
  report.reviewedAt = new Date();

  let targetUser;
  let suspensionUntil;
  if (moderationAction) {
    targetUser = await User.findById(report.reportedUser);
    if (!targetUser) return res.status(404).json({ success: false, message: 'Reported account not found' });
    const actionDetails = typeof details === 'string' ? details.trim().slice(0, 1000) : '';
    if (moderationAction === 'TEMPORARY_SUSPENSION') {
      const days = Number.parseInt(durationDays, 10);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return res.status(400).json({ success: false, message: 'Temporary suspension must be 1-365 days' });
      }
      suspensionUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      targetUser.isActive = false;
      targetUser.suspendedUntil = suspensionUntil;
    } else if (moderationAction === 'PERMANENT_SUSPENSION') {
      targetUser.isActive = false;
      targetUser.suspendedUntil = undefined;
    } else if (moderationAction === 'RESTRICTION') {
      targetUser.accountRestricted = true;
    } else if (moderationAction === 'RESTORE_ACCOUNT') {
      targetUser.isActive = true;
      targetUser.suspendedUntil = undefined;
      targetUser.accountRestricted = false;
    }
    report.moderationActions.push({
      admin: req.user.id,
      action: moderationAction,
      details: actionDetails,
      until: suspensionUntil,
    });
    await targetUser.save();
  }

  await report.save();
  const auditMetadata = {
    reportId: report.reportId,
    status,
    priority: report.priority,
    moderationAction: moderationAction || null,
    durationDays: moderationAction === 'TEMPORARY_SUSPENSION' ? Number(durationDays) : null,
    note: noteText || null,
    details: typeof details === 'string' ? details.trim().slice(0, 1000) : null,
  };
  await logActivity({
    userId: report.reportedUser,
    actorId: req.user.id,
    actionType: moderationAction ? `REPORT_MODERATION_${moderationAction}` : 'REPORT_REVIEW_UPDATED',
    entityType: 'USER_REPORT',
    entityId: report._id,
    metadata: auditMetadata,
    severity: moderationAction?.includes('SUSPENSION') ? 'WARN' : 'ACTION',
  });

  const io = req.app?.get?.('io');
  if (moderationAction && targetUser) {
    const suspension = moderationAction.includes('SUSPENSION');
    const restored = moderationAction === 'RESTORE_ACCOUNT';
    await createNotification({
      recipientId: targetUser._id,
      type: restored ? 'ACCOUNT_STATUS_CHANGED' : suspension ? 'ACCOUNT_SUSPENSION' : 'ACCOUNT_WARNING',
      title: restored ? 'Account access restored' : suspension ? 'Account suspended' : moderationAction === 'WARNING' ? 'Account warning' : 'Account restricted',
      message: restored
        ? 'An administrator has restored your account access.'
        : suspension
        ? suspensionUntil
          ? `Your account has been temporarily suspended until ${suspensionUntil.toLocaleString()}.`
          : 'Your account has been permanently suspended.'
        : moderationAction === 'RESTRICTION'
          ? 'Some account actions have been restricted. Contact support for assistance.'
          : actionDetails || 'The platform has issued an account warning after reviewing a report.',
      link: 'user-tickets.html',
      entityType: 'UserReport',
      entityId: report._id,
      io,
      email: true,
    });
  }
  await createNotification({
    recipientId: report.reporter,
    type: 'REPORT_UPDATE',
    title: 'Report updated',
    message: `Report ${report.reportId} is now ${status.replaceAll('_', ' ').toLowerCase()}.`,
    link: 'notifications.html',
    entityType: 'UserReport',
    entityId: report._id,
    io,
  });

  res.status(200).json({ success: true, data: report });
});
