const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const CompletionReport = require('../models/CompletionReport');
const Payment = require('../models/Payment');
const Request = require('../models/Request');
const User = require('../models/User');
const Message = require('../models/Message');
const Vendor = require('../models/Vendor');
const VendorPayout = require('../models/VendorPayout');
const { cloudinary } = require('../config/cloudinary');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');
const { uploadEvidenceFiles, deleteEvidenceAssets } = require('../utils/evidenceUploader');
const { createNotification } = require('../utils/notificationService');
const { logActivity } = require('../utils/activityLog');
const mediaLimits = require('../config/completionMediaLimits');

const CLIENT_REASONS = [
  'SERVICE_NOT_COMPLETED', 'POOR_QUALITY', 'INCOMPLETE_DELIVERABLES',
  'DIFFERED_FROM_AGREEMENT', 'REQUIREMENTS_NOT_MET', 'LATE_DELIVERY',
  'MISREPRESENTATION', 'OTHER',
];
const ADMIN_ACTIONS = [
  'APPROVE', 'REQUEST_VENDOR_INFO', 'REQUEST_CLIENT_CLARIFICATION',
  'REJECT', 'INVESTIGATE', 'ESCALATE', 'RESOLVE_DISPUTE', 'HOLD',
];

function completionMediaUrl(asset) {
  return cloudinary.url(asset.publicId, {
    resource_type: asset.resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
  });
}

function serializeReport(report) {
  const data = report.toObject ? report.toObject() : report;
  for (const asset of data.images || []) asset.url = completionMediaUrl(asset);
  for (const asset of data.videos || []) asset.url = completionMediaUrl(asset);
  for (const asset of data.clientFeedback?.evidence || []) asset.url = completionMediaUrl(asset);
  return data;
}

async function getVendorForUser(userId) {
  return Vendor.findOne({ user: userId }).select('_id businessName user');
}

async function loadReportWithRelations(reportId) {
  return CompletionReport.findById(reportId)
    .populate('booking')
    .populate('request')
    .populate('service')
    .populate({ path: 'vendor', populate: { path: 'user', select: 'firstName lastName email' } })
    .populate('user', 'firstName lastName email')
    .populate('satisfactionBy', 'firstName lastName role')
    .populate('reviewHistory.admin', 'firstName lastName email')
    .populate('additionalResponses.author', 'firstName lastName role');
}

async function canAccessReport(report, user) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'USER') return String(report.user) === String(user.id);
  if (user.role === 'VENDOR') {
    const vendor = await getVendorForUser(user.id);
    return !!vendor && String(report.vendor) === String(vendor._id);
  }
  return false;
}

async function notifyAdmins(req, report, title, message, email = true) {
  const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id email');
  const io = req.app?.get?.('io');
  await Promise.all(admins.map((admin) => createNotification({
    recipientId: admin._id,
    type: 'SERVICE_COMPLETION_SUBMITTED',
    title,
    message,
    link: `admin-service-completions.html?reportId=${encodeURIComponent(report.reportId)}`,
    entityType: 'CompletionReport',
    entityId: report._id,
    io,
    email,
  })));
}

exports.createDraftForBooking = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid booking ID' });
  }
  const vendor = await getVendorForUser(req.user.id);
  if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile not found' });
  const booking = await Booking.findOne({ _id: req.params.bookingId, vendor: vendor._id })
    .populate('request')
    .populate('service')
    .populate('user', 'firstName lastName email')
    .populate('vendor', 'businessName');
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found for this vendor' });
  if (!booking.request || String(booking.request.booking) !== String(booking._id)) {
    return res.status(409).json({ success: false, message: 'Booking and service request relationship is inconsistent' });
  }
  let report = await CompletionReport.findOne({ booking: booking._id });
  if (report && report.status !== 'DRAFT') {
    return res.status(200).json({ success: true, existing: true, data: serializeReport(report) });
  }
  if (booking.bookingStatus === 'CANCELLED' || booking.bookingStatus === 'COMPLETED') {
    return res.status(409).json({ success: false, message: `Cannot submit completion for a ${booking.bookingStatus.toLowerCase()} booking` });
  }
  if (!report) {
    try {
      report = await CompletionReport.create({
        booking: booking._id,
        request: booking.request._id,
        vendor: vendor._id,
        user: booking.user._id,
        service: booking.service._id,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      report = await CompletionReport.findOne({ booking: booking._id });
      if (!report) throw error;
    }
  }
  await report.populate([
    { path: 'booking', populate: [{ path: 'user', select: 'firstName lastName' }, { path: 'vendor', select: 'businessName' }, { path: 'service' }, { path: 'request' }] },
    { path: 'request' },
    { path: 'service' },
    { path: 'vendor', select: 'businessName' },
    { path: 'user', select: 'firstName lastName' },
  ]);
  res.status(200).json({
    success: true,
    existing: false,
    data: serializeReport(report),
    uploadLimits: mediaLimits,
  });
});

exports.uploadCompletionMedia = asyncHandler(async (req, res) => {
  const report = await CompletionReport.findOne({ _id: req.params.reportId, vendor: await getVendorForUser(req.user.id).then((vendor) => vendor?._id) });
  if (!report) return res.status(404).json({ success: false, message: 'Completion report not found' });
  const draftUpload = report.status === 'DRAFT';
  const requestedVendorInfo = report.status === 'SUBMITTED' && report.adminReviewStatus === 'MORE_INFO_REQUESTED' && report.infoRequestedFrom === 'VENDOR';
  if (!draftUpload && !requestedVendorInfo) return res.status(409).json({ success: false, message: 'Media can only be added to a draft or when an admin requests more information' });

  const isVideo = req.file.mimetype.startsWith('video/');
  if (isVideo && report.videos.length >= mediaLimits.maximumVideos) return res.status(400).json({ success: false, message: `A maximum of ${mediaLimits.maximumVideos} videos is allowed` });
  if (!isVideo && report.images.length >= mediaLimits.maximumImages) return res.status(400).json({ success: false, message: `A maximum of ${mediaLimits.maximumImages} images is allowed` });

  let uploaded;
  try {
    uploaded = await uploadToCloudinary({
      file: req.file,
      folder: `service_completion/${report.reportId}`,
      resourceType: isVideo ? 'video' : 'image',
      deliveryType: 'authenticated',
      timeoutMs: 180000,
    });
    const media = {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      resourceType: isVideo ? 'video' : 'image',
      mimeType: req.file.mimetype,
      originalName: String(req.file.originalname || 'evidence').replace(/[\r\n]/g, '').slice(0, 255),
      size: req.file.size,
      caption: String(req.body?.caption || '').trim().slice(0, 300),
    };
    (isVideo ? report.videos : report.images).push(media);
    await report.save();
    const stored = (isVideo ? report.videos : report.images).at(-1);
    stored.url = completionMediaUrl(stored);
    res.status(201).json({ success: true, data: stored, counts: { images: report.images.length, videos: report.videos.length } });
  } catch (error) {
    if (uploaded?.public_id) {
      await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: isVideo ? 'video' : 'image', type: 'authenticated' }).catch(() => null);
    }
    throw error;
  }
});

exports.submitAdditionalInformation = asyncHandler(async (req, res) => {
  const vendor = await getVendorForUser(req.user.id);
  const report = await CompletionReport.findOne({
    _id: req.params.reportId,
    vendor: vendor?._id,
    status: 'SUBMITTED',
    adminReviewStatus: 'MORE_INFO_REQUESTED',
    infoRequestedFrom: 'VENDOR',
  });
  if (!report) return res.status(409).json({ success: false, message: 'No vendor information has been requested for this report' });
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 10 || message.length > 5000) return res.status(400).json({ success: false, message: 'Response must be 10-5000 characters' });
  report.additionalResponses.push({ author: req.user.id, authorRole: 'VENDOR', message });
  report.adminReviewStatus = 'PENDING_REVIEW';
  report.infoRequestedFrom = undefined;
  await report.save();
  await notifyAdmins(req, report, 'Vendor clarification received', `Vendor submitted additional information for completion report ${report.reportId}.`);
  await logActivity({ userId: report.user, actorId: req.user.id, actionType: 'SERVICE_COMPLETION_VENDOR_INFO_SUBMITTED', entityType: 'COMPLETION_REPORT', entityId: report._id, metadata: { reportId: report.reportId }, severity: 'ACTION' });
  res.status(200).json({ success: true, message: 'Additional information submitted for admin review' });
});

exports.submitClientClarification = asyncHandler(async (req, res) => {
  const report = await CompletionReport.findOne({
    _id: req.params.reportId,
    user: req.user.id,
    status: { $in: ['SUBMITTED', 'DISPUTED'] },
    adminReviewStatus: 'MORE_INFO_REQUESTED',
    infoRequestedFrom: 'USER',
  });
  if (!report) return res.status(409).json({ success: false, message: 'No clarification has been requested for this report' });
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 10 || message.length > 5000) return res.status(400).json({ success: false, message: 'Clarification must be 10-5000 characters' });
  report.additionalResponses.push({ author: req.user.id, authorRole: 'USER', message });
  report.adminReviewStatus = 'PENDING_REVIEW';
  report.infoRequestedFrom = undefined;
  await report.save();
  await notifyAdmins(req, report, 'Client clarification received', `Client submitted additional information for completion report ${report.reportId}.`);
  await logActivity({ userId: req.user.id, actorId: req.user.id, actionType: 'SERVICE_COMPLETION_CLIENT_INFO_SUBMITTED', entityType: 'COMPLETION_REPORT', entityId: report._id, metadata: { reportId: report.reportId }, severity: 'ACTION' });
  res.status(200).json({ success: true, message: 'Clarification submitted for admin review' });
});

exports.removeCompletionMedia = asyncHandler(async (req, res) => {
  const vendor = await getVendorForUser(req.user.id);
  const report = await CompletionReport.findOne({ _id: req.params.reportId, vendor: vendor?._id });
  if (!report) return res.status(404).json({ success: false, message: 'Completion report not found' });
  if (report.status !== 'DRAFT') return res.status(409).json({ success: false, message: 'Submitted reports cannot be changed' });
  const image = report.images.id(req.params.mediaId);
  const video = report.videos.id(req.params.mediaId);
  const media = image || video;
  if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
  const resourceType = media.resourceType;
  const publicId = media.publicId;
  if (image) report.images.pull(req.params.mediaId);
  else report.videos.pull(req.params.mediaId);
  await report.save();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'authenticated' }).catch((error) => {
    console.error('Completion evidence cleanup failed:', error?.message || error);
  });
  res.status(200).json({ success: true, counts: { images: report.images.length, videos: report.videos.length } });
});

exports.submitCompletionReport = asyncHandler(async (req, res) => {
  const vendor = await getVendorForUser(req.user.id);
  const report = await CompletionReport.findOne({ _id: req.params.reportId, vendor: vendor?._id });
  if (!report) return res.status(404).json({ success: false, message: 'Completion report not found' });
  if (report.status !== 'DRAFT') return res.status(409).json({ success: false, message: 'Completion report has already been submitted' });
  const serviceSummary = typeof req.body?.serviceSummary === 'string' ? req.body.serviceSummary.trim() : '';
  const additionalNotes = typeof req.body?.additionalNotes === 'string' ? req.body.additionalNotes.trim() : '';
  const completionDate = new Date(req.body?.completionDate);
  if (serviceSummary.length < 50 || serviceSummary.length > 10000) {
    return res.status(400).json({ success: false, message: 'Service delivery summary must be 50-10000 characters' });
  }
  if (!Number.isFinite(completionDate.getTime()) || completionDate > new Date()) {
    return res.status(400).json({ success: false, message: 'Completion date must be valid and cannot be in the future' });
  }
  if (additionalNotes.length > 5000) return res.status(400).json({ success: false, message: 'Additional notes must be 5000 characters or fewer' });
  if (report.images.length < mediaLimits.minimumImages) return res.status(400).json({ success: false, message: `At least ${mediaLimits.minimumImages} uploaded service photos are required` });

  const session = await mongoose.startSession();
  let committedReport;
  let payout;
  try {
    await session.withTransaction(async () => {
      const [currentReport, booking, request] = await Promise.all([
        CompletionReport.findById(report._id).session(session),
        Booking.findOne({ _id: report.booking, vendor: vendor._id }).session(session),
        Request.findOne({ _id: report.request, vendor: vendor._id, user: report.user }).session(session),
      ]);
      if (!currentReport || currentReport.status !== 'DRAFT') throw Object.assign(new Error('Completion report was already submitted'), { statusCode: 409 });
      if (!booking || !request || String(booking.request) !== String(request._id) || String(request.booking) !== String(booking._id)) {
        throw Object.assign(new Error('Booking/request ownership could not be verified'), { statusCode: 409 });
      }
      if (['CANCELLED', 'COMPLETED'].includes(booking.bookingStatus) || ['CANCELLED', 'COMPLETED', 'DECLINED'].includes(request.status)) {
        throw Object.assign(new Error('This booking is not eligible for a completion report'), { statusCode: 409 });
      }
      const eventDate = new Date(booking.eventDate);
      if (completionDate < new Date(booking.createdAt) || completionDate < new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())) {
        throw Object.assign(new Error('Completion date cannot be before the booking or scheduled event date'), { statusCode: 400 });
      }

      currentReport.serviceSummary = serviceSummary;
      currentReport.completionDate = completionDate;
      currentReport.additionalNotes = additionalNotes;
      currentReport.status = 'SUBMITTED';
      currentReport.submittedAt = new Date();
      currentReport.adminReviewStatus = 'PENDING_REVIEW';
      currentReport.payoutStatus = 'ON_HOLD';
      await currentReport.save({ session });

      booking.bookingStatus = 'AWAITING_CLIENT_CONFIRMATION';
      await booking.save({ session });
      request.status = 'AWAITING_CLIENT_CONFIRMATION';
      await request.save({ session });

      [payout] = await VendorPayout.create([{
        report: currentReport._id,
        booking: booking._id,
        request: request._id,
        vendor: vendor._id,
        user: booking.user,
        grossAmount: booking.totalAmount,
        currency: booking.amountCurrency || 'NGN',
        payoutStatus: 'ON_HOLD',
      }], { session });
      committedReport = currentReport;
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'A completion report or payout already exists for this booking' });
    if (error?.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    throw error;
  } finally {
    await session.endSession();
  }

  const [booking, service, vendorUser] = await Promise.all([
    Booking.findById(committedReport.booking).select('eventDate totalAmount amountCurrency request'),
    mongoose.model('Service').findById(committedReport.service).select('serviceName serviceCategory'),
    User.findById(vendor.user).select('firstName lastName email'),
  ]);
  const vendorName = vendor.businessName;
  const clientName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
  const serviceName = service?.serviceName || 'Service';
  const eventDateLabel = booking?.eventDate?.toLocaleDateString() || 'Not specified';
  const requestReference = String(committedReport.request);
  const reviewLink = `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/user-service-completion.html?reportId=${encodeURIComponent(committedReport._id)}`;
  const io = req.app?.get?.('io');
  await Promise.all([
    createNotification({
      recipientId: committedReport.user,
      type: 'SERVICE_COMPLETION_SUBMITTED',
      title: 'Service completion report ready for review',
      message: `${vendorName} submitted evidence of completion for ${serviceName}. Request ${requestReference}; event date ${eventDateLabel}; submitted ${committedReport.submittedAt.toLocaleString()}. Please review the report and record your satisfaction.`,
      link: `user-service-completion.html?reportId=${encodeURIComponent(committedReport._id)}`,
      entityType: 'CompletionReport',
      entityId: committedReport._id,
      io,
      email: true,
    }),
    createNotification({
      recipientId: vendor.user,
      type: 'SERVICE_COMPLETION_SUBMITTED',
      title: 'Completion report submitted',
      message: `Your completion report for ${serviceName} is awaiting client confirmation and admin review. Payout remains on hold.`,
      link: `vendor-service-completion-details.html?reportId=${encodeURIComponent(committedReport._id)}`,
      entityType: 'CompletionReport',
      entityId: committedReport._id,
      io,
    }),
    notifyAdmins(req, committedReport, 'Service completion submitted', `${vendorName} submitted a completion report for ${serviceName}, request ${requestReference}.`),
  ]);
  await logActivity({
    userId: committedReport.user,
    actorId: req.user.id,
    actionType: 'SERVICE_COMPLETION_REPORT_SUBMITTED',
    entityType: 'COMPLETION_REPORT',
    entityId: committedReport._id,
    metadata: { reportId: committedReport.reportId, booking: committedReport.booking, payout: payout?._id },
    severity: 'ACTION',
  });
  res.status(201).json({ success: true, data: { reportId: committedReport.reportId, _id: committedReport._id, payoutStatus: 'ON_HOLD' }, message: 'Completion report submitted for client and admin review' });
});

exports.getCompletionReport = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.reportId)) return res.status(400).json({ success: false, message: 'Invalid report ID' });
  const report = await loadReportWithRelations(req.params.reportId);
  if (!report) return res.status(404).json({ success: false, message: 'Completion report not found' });
  if (!(await canAccessReport(report, req.user))) return res.status(403).json({ success: false, message: 'Not authorized to view this report' });
  res.status(200).json({ success: true, data: serializeReport(report) });
});

exports.submitSatisfactionDecision = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.reportId)) return res.status(400).json({ success: false, message: 'Invalid report ID' });
  const report = await CompletionReport.findOne({ _id: req.params.reportId, user: req.user.id });
  if (!report) return res.status(404).json({ success: false, message: 'Completion report not found' });
  if (report.status !== 'SUBMITTED' || report.satisfactionStatus !== 'PENDING') {
    return res.status(409).json({ success: false, message: 'A satisfaction decision has already been recorded or the report is not awaiting client review' });
  }
  const decision = req.body?.decision;
  if (!['SATISFIED', 'NOT_SATISFIED'].includes(decision)) return res.status(400).json({ success: false, message: 'Decision must be SATISFIED or NOT_SATISFIED' });

  const feedback = req.body?.feedback || {
    reason: req.body?.reason,
    explanation: req.body?.explanation,
    differedFromAgreement: req.body?.differedFromAgreement === true || req.body?.differedFromAgreement === 'true',
    missingDeliverables: req.body?.missingDeliverables === true || req.body?.missingDeliverables === 'true',
  };
  let evidence = [];
  if (decision === 'NOT_SATISFIED') {
    if (!CLIENT_REASONS.includes(feedback.reason)) return res.status(400).json({ success: false, message: 'Select a valid dissatisfaction reason' });
    const explanation = typeof feedback.explanation === 'string' ? feedback.explanation.trim() : '';
    if (explanation.length < 20 || explanation.length > 10000) return res.status(400).json({ success: false, message: 'Explanation must be 20-10000 characters' });
    if (typeof feedback.differedFromAgreement !== 'boolean' || typeof feedback.missingDeliverables !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Answer both service agreement questions' });
    }
    if (feedback.reason === 'OTHER' && explanation.length < 30) return res.status(400).json({ success: false, message: 'Please describe the other reason in more detail' });
    evidence = await uploadEvidenceFiles(Array.isArray(req.files) ? req.files : [], `service_completion/${report.reportId}/client-feedback`);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const currentReport = await CompletionReport.findOne({ _id: report._id, user: req.user.id }).session(session);
      if (!currentReport || currentReport.status !== 'SUBMITTED' || currentReport.satisfactionStatus !== 'PENDING') {
        throw Object.assign(new Error('A satisfaction decision has already been recorded'), { statusCode: 409 });
      }
      currentReport.satisfactionStatus = decision;
      currentReport.satisfactionBy = req.user.id;
      currentReport.satisfactionAt = new Date();
      currentReport.payoutStatus = 'ON_HOLD';
      if (decision === 'NOT_SATISFIED') {
        currentReport.status = 'DISPUTED';
        currentReport.adminReviewStatus = 'UNDER_INVESTIGATION';
        currentReport.clientFeedback = {
          reason: feedback.reason,
          explanation: feedback.explanation.trim(),
          differedFromAgreement: feedback.differedFromAgreement,
          missingDeliverables: feedback.missingDeliverables,
          evidence,
          submittedAt: new Date(),
        };
      } else {
        currentReport.adminReviewStatus = 'PENDING_REVIEW';
      }
      await currentReport.save({ session });
      await Booking.updateOne(
        { _id: currentReport.booking, user: req.user.id },
        { $set: { bookingStatus: decision === 'NOT_SATISFIED' ? 'DISPUTED' : 'AWAITING_ADMIN_REVIEW' } },
        { session }
      );
      await Request.updateOne(
        { _id: currentReport.request, user: req.user.id },
        { $set: { status: decision === 'NOT_SATISFIED' ? 'DISPUTED' : 'AWAITING_ADMIN_REVIEW' } },
        { session }
      );
      await VendorPayout.updateOne({ report: currentReport._id }, { $set: { payoutStatus: 'ON_HOLD' } }, { session });
    });
  } catch (error) {
    if (evidence.length) await deleteEvidenceAssets(evidence);
    if (error?.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    throw error;
  } finally {
    await session.endSession();
  }

  await report.populate('vendor', 'businessName user');
  const vendorUserId = report.vendor?.user;
  const message = decision === 'SATISFIED'
    ? `The client marked service completion report ${report.reportId} as satisfied. The report is forwarded for admin review; payout remains on hold.`
    : `The client raised a concern about completion report ${report.reportId}. The case is under admin review and payout remains on hold.`;
  const io = req.app?.get?.('io');
  await Promise.all([
    createNotification({
      recipientId: vendorUserId,
      type: decision === 'SATISFIED' ? 'SERVICE_SATISFACTION' : 'SERVICE_DISPUTE',
      title: decision === 'SATISFIED' ? 'Client confirmed satisfaction' : 'Client raised a service concern',
      message,
      link: `vendor-service-completion-details.html?reportId=${encodeURIComponent(report._id)}`,
      entityType: 'CompletionReport',
      entityId: report._id,
      io,
      email: true,
    }),
    notifyAdmins(req, report, decision === 'SATISFIED' ? 'Client satisfaction recorded' : 'Client dispute opened', message),
    createNotification({
      recipientId: req.user.id,
      type: decision === 'SATISFIED' ? 'SERVICE_SATISFACTION' : 'SERVICE_DISPUTE',
      title: decision === 'SATISFIED' ? 'Satisfaction recorded' : 'Feedback submitted',
      message: decision === 'SATISFIED'
        ? 'Your satisfaction has been recorded and forwarded for administrative review. Vendor payout remains subject to admin approval and payment verification.'
        : 'Your concern has been submitted for administrative review. The vendor payout remains on hold.',
      link: `user-service-completion.html?reportId=${encodeURIComponent(report._id)}`,
      entityType: 'CompletionReport',
      entityId: report._id,
      io,
    }),
  ]);
  await logActivity({
    userId: req.user.id,
    actorId: req.user.id,
    actionType: decision === 'SATISFIED' ? 'SERVICE_SATISFACTION_RECORDED' : 'SERVICE_DISPUTE_OPENED',
    entityType: 'COMPLETION_REPORT',
    entityId: report._id,
    metadata: { reportId: report.reportId, decision, reason: feedback.reason || null },
    severity: decision === 'SATISFIED' ? 'SUCCESS' : 'WARN',
  });
  res.status(200).json({ success: true, message: decision === 'SATISFIED' ? 'Satisfaction recorded and forwarded for admin review' : 'Your concern has been submitted for review' });
});

exports.listAdminCompletionReports = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const validFilters = {
    AWAITING_CLIENT_CONFIRMATION: { status: 'SUBMITTED', satisfactionStatus: 'PENDING' },
    SATISFIED: { satisfactionStatus: 'SATISFIED' },
    NOT_SATISFIED: { satisfactionStatus: 'NOT_SATISFIED' },
    PENDING_ADMIN_REVIEW: { adminReviewStatus: 'PENDING_REVIEW' },
    APPROVED_FOR_PAYOUT: { payoutStatus: 'ELIGIBLE' },
    PAYOUT_PENDING: { payoutStatus: { $in: ['APPROVED', 'PROCESSING'] } },
    PAID: { payoutStatus: 'PAID' },
    DISPUTED: { status: 'DISPUTED' },
    REJECTED: { status: 'REJECTED' },
    CANCELLED: { status: 'CANCELLED' },
  };
  if (req.query.filter && !validFilters[req.query.filter]) return res.status(400).json({ success: false, message: 'Invalid completion report filter' });
  const filter = validFilters[req.query.filter] || {};
  const [reports, total] = await Promise.all([
    CompletionReport.find(filter)
      .populate('booking', 'totalAmount amountCurrency paymentStatus bookingStatus eventDate')
      .populate('request', 'eventDate eventLocation eventDescription status notes')
      .populate('service', 'serviceName serviceCategory')
      .populate('vendor', 'businessName user')
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CompletionReport.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: reports.map(serializeReport), total, page, pages: Math.ceil(total / limit) });
});

exports.getAdminCompletionReport = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.reportId)) return res.status(400).json({ success: false, message: 'Invalid report ID' });
  const report = await loadReportWithRelations(req.params.reportId);
  if (!report) return res.status(404).json({ success: false, message: 'Completion report not found' });
  const [payments, messages, payout] = await Promise.all([
    Payment.find({ booking: report.booking?._id || report.booking })
      .select('amount currency paymentStatus paymentGateway transactionReference initializedAt webhookReceivedAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean(),
    Message.find({
      $or: [
        { request: report.request?._id || report.request },
        { booking: report.booking?._id || report.booking },
      ],
    })
      .populate('sender', 'firstName lastName role')
      .populate('recipient', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .limit(100)
      .select('sender recipient messageContent attachments createdAt request booking')
      .lean(),
    VendorPayout.findOne({ report: report._id })
      .populate('approvedBy', 'firstName lastName email')
      .lean(),
  ]);
  res.status(200).json({ success: true, data: serializeReport(report), payments, messages, payout });
});

exports.reviewCompletionReport = asyncHandler(async (req, res) => {
  const { action, reason, outcome } = req.body || {};
  if (!ADMIN_ACTIONS.includes(action)) return res.status(400).json({ success: false, message: 'Invalid review action' });
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  if (['REQUEST_VENDOR_INFO', 'REQUEST_CLIENT_CLARIFICATION', 'REJECT', 'INVESTIGATE', 'ESCALATE', 'HOLD', 'RESOLVE_DISPUTE'].includes(action) && cleanReason.length < 5) {
    return res.status(400).json({ success: false, message: 'Provide a reason of at least five characters' });
  }
  if (action === 'RESOLVE_DISPUTE' && !['APPROVE_PAYOUT', 'REJECT_PAYOUT'].includes(outcome)) {
    return res.status(400).json({ success: false, message: 'Select a dispute resolution outcome' });
  }
  const report = await CompletionReport.findById(req.params.reportId);
  if (!report) return res.status(404).json({ success: false, message: 'Completion report not found' });
  if (report.status === 'DRAFT') return res.status(409).json({ success: false, message: 'Draft reports cannot be reviewed' });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await CompletionReport.findById(report._id).session(session);
      const booking = await Booking.findById(report.booking).session(session);
      const request = await Request.findById(report.request).session(session);
      if (!current || !booking || !request) throw Object.assign(new Error('Report relationships are incomplete'), { statusCode: 409 });
      current.reviewHistory.push({ admin: req.user.id, action, reason: cleanReason || undefined, details: action === 'RESOLVE_DISPUTE' ? { outcome } : undefined });

      if (action === 'REQUEST_VENDOR_INFO') {
        current.adminReviewStatus = 'MORE_INFO_REQUESTED';
        current.infoRequestedFrom = 'VENDOR';
      }
      if (action === 'REQUEST_CLIENT_CLARIFICATION') {
        current.adminReviewStatus = 'MORE_INFO_REQUESTED';
        current.infoRequestedFrom = 'USER';
      }
      if (action === 'INVESTIGATE' || action === 'ESCALATE' || action === 'HOLD') {
        current.adminReviewStatus = 'UNDER_INVESTIGATION';
        if (action !== 'HOLD') current.status = 'DISPUTED';
        current.payoutStatus = 'ON_HOLD';
      }
      if (action === 'REJECT') {
        current.status = 'REJECTED';
        current.adminReviewStatus = 'REJECTED';
        current.payoutStatus = 'CANCELLED';
        await VendorPayout.updateOne({ report: current._id }, { $set: { payoutStatus: 'CANCELLED' } }, { session });
      }
      if (action === 'APPROVE') {
        if (current.satisfactionStatus !== 'SATISFIED' && current.disputeResolution?.outcome !== 'APPROVE_PAYOUT') {
          throw Object.assign(new Error('Client satisfaction or an approved dispute resolution is required'), { statusCode: 409 });
        }
        current.status = 'APPROVED';
        current.adminReviewStatus = 'APPROVED';
      }
      if (action === 'RESOLVE_DISPUTE') {
        current.disputeResolution = { outcome, reason: cleanReason, resolvedBy: req.user.id, resolvedAt: new Date() };
        current.adminReviewStatus = 'DISPUTE_RESOLVED';
        current.status = outcome === 'APPROVE_PAYOUT' ? 'APPROVED' : 'REJECTED';
        if (outcome === 'REJECT_PAYOUT') {
          current.payoutStatus = 'CANCELLED';
          await VendorPayout.updateOne({ report: current._id }, { $set: { payoutStatus: 'CANCELLED' } }, { session });
        }
      }
      await current.save({ session });

      if (current.status === 'APPROVED') {
        const payment = await Payment.findOne({ booking: booking._id, paymentStatus: 'COMPLETED' }).session(session);
        const hasBlockingPayment = await Payment.exists({ booking: booking._id, paymentStatus: { $in: ['REFUNDED', 'FAILED'] } }).session(session);
        const satisfactionEligible = current.satisfactionStatus === 'SATISFIED' || current.disputeResolution?.outcome === 'APPROVE_PAYOUT';
        const resolvedDispute = current.disputeResolution?.outcome === 'APPROVE_PAYOUT';
        const conditionsMet = payment && !hasBlockingPayment && booking.paymentStatus === 'COMPLETED'
          && current.images.length >= mediaLimits.minimumImages && satisfactionEligible
          && booking.bookingStatus !== 'CANCELLED'
          && request.status !== 'CANCELLED'
          && (booking.bookingStatus !== 'DISPUTED' || resolvedDispute);
        if (conditionsMet) {
          current.payoutStatus = 'ELIGIBLE';
          booking.bookingStatus = 'COMPLETED';
          request.status = 'COMPLETED';
          await VendorPayout.updateOne({ report: current._id, payoutStatus: 'ON_HOLD' }, { $set: { payoutStatus: 'ELIGIBLE' } }, { session });
        } else {
          current.payoutStatus = 'ON_HOLD';
        }
        await current.save({ session });
        await booking.save({ session });
        await request.save({ session });
      }
    });
  } catch (error) {
    if (error?.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    throw error;
  } finally {
    await session.endSession();
  }

  const io = req.app?.get?.('io');
  const vendor = await Vendor.findById(report.vendor).select('user businessName');
  const notifyTargets = [report.user, vendor?.user].filter(Boolean);
  const statusMessage = `Admin action ${action.replaceAll('_', ' ').toLowerCase()} was recorded for report ${report.reportId}.${cleanReason ? ` Reason: ${cleanReason}` : ''}`;
  await Promise.all([
    ...notifyTargets.map((recipientId) => createNotification({
      recipientId,
      type: action === 'APPROVE' || action === 'REJECT' || action === 'RESOLVE_DISPUTE' ? 'SERVICE_REVIEW' : 'SERVICE_DISPUTE',
      title: 'Completion report updated',
      message: statusMessage,
      link: `${String(recipientId) === String(report.user) ? 'user-service-completion.html' : 'vendor-service-completion-details.html'}?reportId=${encodeURIComponent(report._id)}`,
      entityType: 'CompletionReport',
      entityId: report._id,
      io,
      email: true,
    })),
  ]);
  await logActivity({
    userId: report.user,
    actorId: req.user.id,
    actionType: `SERVICE_COMPLETION_ADMIN_${action}`,
    entityType: 'COMPLETION_REPORT',
    entityId: report._id,
    metadata: { reportId: report.reportId, reason: cleanReason || null, outcome: outcome || null },
    severity: action === 'REJECT' ? 'WARN' : 'ACTION',
  });
  res.status(200).json({ success: true, data: await CompletionReport.findById(report._id) });
});
