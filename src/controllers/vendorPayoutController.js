const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const CompletionReport = require('../models/CompletionReport');
const Payment = require('../models/Payment');
const Request = require('../models/Request');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const VendorPayout = require('../models/VendorPayout');
const mediaLimits = require('../config/completionMediaLimits');
const { cloudinary } = require('../config/cloudinary');
const { uploadEvidenceFiles, deleteEvidenceAssets } = require('../utils/evidenceUploader');
const { createNotification } = require('../utils/notificationService');
const { logActivity } = require('../utils/activityLog');

async function checkPayoutEligibility(payout) {
  const [report, booking, request, vendor, completedPayments, refundedPayment] = await Promise.all([
    CompletionReport.findById(payout.report),
    Booking.findById(payout.booking),
    Request.findById(payout.request),
    Vendor.findById(payout.vendor),
    Payment.find({ booking: payout.booking, paymentStatus: 'COMPLETED' }).select('amount currency').lean(),
    Payment.exists({ booking: payout.booking, paymentStatus: 'REFUNDED' }),
  ]);
  if (!report || !booking || !request || !vendor) return { eligible: false, message: 'Payout relationships are incomplete' };
  if (String(booking.vendor) !== String(vendor._id) || String(request.vendor) !== String(vendor._id)
    || String(booking.user) !== String(payout.user) || String(request.user) !== String(payout.user)
    || String(booking.request) !== String(request._id) || String(report.booking) !== String(booking._id)) {
    return { eligible: false, message: 'Vendor, client, booking, and request ownership do not match' };
  }
  if (report.status !== 'APPROVED' || !['APPROVED', 'DISPUTE_RESOLVED'].includes(report.adminReviewStatus)) {
    return { eligible: false, message: 'Completion report has not been approved by an administrator' };
  }
  if (report.images.length < mediaLimits.minimumImages || !report.serviceSummary || !report.completionDate) {
    return { eligible: false, message: 'Completion report evidence or required fields are incomplete' };
  }
  if (report.satisfactionStatus !== 'SATISFIED' && report.disputeResolution?.outcome !== 'APPROVE_PAYOUT') {
    return { eligible: false, message: 'Client satisfaction or an approved dispute resolution is required' };
  }
  const paidTotal = completedPayments
    .filter((payment) => String(payment.currency || 'NGN').toUpperCase() === String(booking.amountCurrency || 'NGN').toUpperCase())
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
  if (booking.paymentStatus !== 'COMPLETED' || paidTotal < Number(booking.totalAmount)) {
    return { eligible: false, message: 'The complete booking amount has not been confirmed as received' };
  }
  if (refundedPayment || booking.bookingStatus === 'CANCELLED' || request.status === 'CANCELLED' || report.status === 'DISPUTED'
    || report.satisfactionStatus === 'NOT_SATISFIED' && report.disputeResolution?.outcome !== 'APPROVE_PAYOUT') {
    return { eligible: false, message: 'A refund, cancellation, or active dispute blocks payout' };
  }
  return { eligible: true, report, booking, request, vendor };
}

function maskAccount(value) {
  const digits = String(value || '').replace(/\s/g, '');
  return digits.length > 4 ? `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : digits || 'Not provided';
}

exports.listVendorPayouts = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user.id }).select('_id');
  if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile not found' });
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const [items, total] = await Promise.all([
    VendorPayout.find({ vendor: vendor._id })
      .populate('report', 'reportId status satisfactionStatus adminReviewStatus payoutStatus submittedAt')
      .populate('booking', 'eventDate totalAmount amountCurrency paymentStatus bookingStatus')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    VendorPayout.countDocuments({ vendor: vendor._id }),
  ]);
  res.status(200).json({ success: true, data: items, total, page, pages: Math.ceil(total / limit) });
});

exports.listAdminPayouts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const validStatuses = ['ON_HOLD', 'ELIGIBLE', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'];
  if (req.query.status && !validStatuses.includes(req.query.status)) return res.status(400).json({ success: false, message: 'Invalid payout status' });
  const filter = req.query.status ? { payoutStatus: req.query.status } : {};
  const [items, total] = await Promise.all([
    VendorPayout.find(filter)
      .populate('vendor', 'businessName bankAccountNumber bankCode user')
      .populate('user', 'firstName lastName email')
      .populate('booking', 'eventDate totalAmount amountCurrency paymentStatus bookingStatus')
      .populate('report', 'reportId status satisfactionStatus adminReviewStatus payoutStatus images submittedAt')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    VendorPayout.countDocuments(filter),
  ]);
  const data = await Promise.all(items.map(async (item) => {
    const eligibility = item.payoutStatus === 'ON_HOLD' ? await checkPayoutEligibility(item) : null;
    return {
      ...item,
      vendor: item.vendor ? { ...item.vendor, bankAccountMasked: maskAccount(item.vendor.bankAccountNumber) } : null,
      netAmount: item.netAmount ?? null,
      netAmountPendingConfiguration: item.netAmount == null,
      eligibility: eligibility ? { eligible: eligibility.eligible, message: eligibility.message || null } : undefined,
      manualProof: (item.manualProof || []).map((proof) => ({
        ...proof,
        url: cloudinary.url(proof.publicId, { resource_type: proof.resourceType, type: 'authenticated', sign_url: true, secure: true }),
      })),
    };
  }));
  res.status(200).json({
    success: true,
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

exports.recheckPayoutEligibility = asyncHandler(async (req, res) => {
  const payout = await VendorPayout.findById(req.params.payoutId);
  if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
  if (payout.payoutStatus !== 'ON_HOLD') return res.status(409).json({ success: false, message: 'Only on-hold payouts can be rechecked' });
  const result = await checkPayoutEligibility(payout);
  if (!result.eligible) return res.status(409).json({ success: false, eligible: false, message: result.message });
  const updated = await VendorPayout.findOneAndUpdate(
    { _id: payout._id, payoutStatus: 'ON_HOLD' },
    { $set: { payoutStatus: 'ELIGIBLE' } },
    { new: true }
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Payout changed during recheck' });
  await CompletionReport.updateOne({ _id: payout.report, payoutStatus: 'ON_HOLD' }, { $set: { payoutStatus: 'ELIGIBLE' } });
  await Promise.all([
    Booking.updateOne({ _id: payout.booking, bookingStatus: { $in: ['AWAITING_CLIENT_CONFIRMATION', 'AWAITING_ADMIN_REVIEW', 'DISPUTED'] } }, { $set: { bookingStatus: 'COMPLETED' } }),
    Request.updateOne({ _id: payout.request, status: { $in: ['AWAITING_CLIENT_CONFIRMATION', 'AWAITING_ADMIN_REVIEW', 'DISPUTED'] } }, { $set: { status: 'COMPLETED' } }),
  ]);
  res.status(200).json({ success: true, data: updated, message: 'Payout eligibility confirmed. No transfer has been initiated.' });
});

exports.approveVendorPayout = asyncHandler(async (req, res) => {
  const payout = await VendorPayout.findById(req.params.payoutId);
  if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
  if (payout.payoutStatus === 'PAID') return res.status(409).json({ success: false, message: 'Payout has already been reconciled as paid' });
  if (payout.payoutStatus !== 'ELIGIBLE') return res.status(409).json({ success: false, message: 'Payout is not eligible for approval' });

  const eligibility = await checkPayoutEligibility(payout);
  if (!eligibility.eligible) {
    await VendorPayout.updateOne({ _id: payout._id, payoutStatus: 'ELIGIBLE' }, { $set: { payoutStatus: 'ON_HOLD' } });
    await CompletionReport.updateOne({ _id: payout.report }, { $set: { payoutStatus: 'ON_HOLD' } });
    return res.status(409).json({ success: false, message: eligibility.message });
  }
  if (!eligibility.vendor.bankAccountNumber || !eligibility.vendor.bankCode) {
    return res.status(409).json({ success: false, message: 'Vendor payout bank account and bank code are not configured' });
  }

  const { netAmount, commissionAmount, feeAmount, reason } = req.body || {};
  const parsedNet = Number(netAmount);
  const parsedCommission = commissionAmount === '' || commissionAmount === undefined ? null : Number(commissionAmount);
  const parsedFee = feeAmount === '' || feeAmount === undefined ? null : Number(feeAmount);
  if (!Number.isFinite(parsedNet) || parsedNet <= 0 || parsedNet > payout.grossAmount) {
    return res.status(400).json({ success: false, message: 'Enter the explicitly approved net transfer amount; no commission rate is configured' });
  }
  if (parsedCommission !== null && (!Number.isFinite(parsedCommission) || parsedCommission < 0)) return res.status(400).json({ success: false, message: 'Commission must be a non-negative amount' });
  if (parsedFee !== null && (!Number.isFinite(parsedFee) || parsedFee < 0)) return res.status(400).json({ success: false, message: 'Fees must be a non-negative amount' });
  if ((parsedCommission === null) !== (parsedFee === null)) {
    return res.status(400).json({ success: false, message: 'Enter both commission and fee amounts, or leave both blank when approving an explicit manual net amount' });
  }
  if (parsedCommission !== null && parsedFee !== null && Math.abs(payout.grossAmount - parsedCommission - parsedFee - parsedNet) > 0.01) {
    return res.status(400).json({ success: false, message: 'Gross amount must equal commission plus fees plus net payout' });
  }
  if (typeof reason !== 'string' || reason.trim().length < 10) return res.status(400).json({ success: false, message: 'Record the basis for the manually calculated net amount' });

  const updated = await VendorPayout.findOneAndUpdate(
    { _id: payout._id, payoutStatus: 'ELIGIBLE' },
    {
      $set: {
        payoutStatus: 'APPROVED',
        netAmount: parsedNet,
        commissionAmount: parsedCommission,
        feeAmount: parsedFee,
        netAmountSource: 'MANUAL_ADMIN',
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      $push: { attempts: { admin: req.user.id, action: 'APPROVED', amount: parsedNet, reason: reason.trim() } },
    },
    { new: true }
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Payout was updated by another administrator' });
  await CompletionReport.updateOne({ _id: payout.report, payoutStatus: 'ELIGIBLE' }, { $set: { payoutStatus: 'APPROVED' } });
  await logActivity({
    userId: payout.user,
    actorId: req.user.id,
    actionType: 'VENDOR_PAYOUT_APPROVED_MANUAL',
    entityType: 'VENDOR_PAYOUT',
    entityId: payout._id,
    metadata: { payoutId: payout.payoutId, grossAmount: payout.grossAmount, netAmount: parsedNet, commissionAmount: parsedCommission, feeAmount: parsedFee, reason: reason.trim() },
    severity: 'ACTION',
  });
  await createNotification({
    recipientId: eligibility.vendor.user,
    type: 'PAYOUT_STATUS',
    title: 'Payout approved for manual transfer',
    message: `Payout ${updated.payoutId} was approved for a manual transfer of ${updated.currency} ${Number(updated.netAmount).toLocaleString()}. Approval does not mean funds have been sent.`,
    link: 'vendor-payouts.html',
    entityType: 'VendorPayout',
    entityId: updated._id,
    io: req.app?.get?.('io'),
    email: true,
  });
  res.status(200).json({ success: true, data: updated, message: 'Payout approved for manual transfer. No transfer has been initiated.' });
});

exports.recordManualPayout = asyncHandler(async (req, res) => {
  const payout = await VendorPayout.findById(req.params.payoutId);
  if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
  if (payout.payoutStatus === 'PAID') return res.status(409).json({ success: false, message: 'This payout already has a paid reference' });
  if (payout.payoutStatus !== 'PROCESSING') return res.status(409).json({ success: false, message: 'Start and reference the manual transfer before recording reconciliation' });
  if (String(payout.approvedBy) === String(req.user.id)) {
    return res.status(403).json({ success: false, message: 'A second administrator must reconcile the transfer' });
  }
  const transferReference = typeof req.body?.transferReference === 'string' ? req.body.transferReference.trim() : '';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (transferReference.length < 5 || transferReference.length > 120) return res.status(400).json({ success: false, message: 'Transfer reference must be 5-120 characters' });
  if (transferReference !== payout.transferReference) return res.status(409).json({ success: false, message: 'Transfer reference must match the reference recorded when the transfer entered processing' });
  if (req.body?.confirmedSent !== 'true' && req.body?.confirmedSent !== true) return res.status(400).json({ success: false, message: 'Confirm that the bank transfer was actually sent' });
  if (!Array.isArray(req.files) || req.files.length < 1) return res.status(400).json({ success: false, message: 'Upload transfer proof before marking this payout paid' });
  if (reason.length < 10) return res.status(400).json({ success: false, message: 'Provide a reconciliation note of at least 10 characters' });

  const eligibility = await checkPayoutEligibility(payout);
  if (!eligibility.eligible) return res.status(409).json({ success: false, message: eligibility.message });
  let proof = [];
  try {
    proof = await uploadEvidenceFiles(req.files, `vendor_payouts/${payout.payoutId}`);
    const updated = await VendorPayout.findOneAndUpdate(
      { _id: payout._id, payoutStatus: 'APPROVED' },
      {
        $set: { payoutStatus: 'PAID', transferReference, transferredAt: new Date(), manualProof: proof },
        $push: { attempts: { admin: req.user.id, action: 'TRANSFER_RECORDED', reference: transferReference, amount: payout.netAmount, reason } },
      },
      { new: true }
    );
    if (!updated) {
      await deleteEvidenceAssets(proof);
      return res.status(409).json({ success: false, message: 'Payout was updated by another administrator' });
    }
    await CompletionReport.updateOne({ _id: payout.report }, { $set: { payoutStatus: 'PAID' } });
    await logActivity({
      userId: payout.user,
      actorId: req.user.id,
      actionType: 'VENDOR_PAYOUT_MANUAL_TRANSFER_RECONCILED',
      entityType: 'VENDOR_PAYOUT',
      entityId: payout._id,
      metadata: { payoutId: payout.payoutId, transferReference, amount: payout.netAmount, reason },
      severity: 'SUCCESS',
    });
    const vendor = await Vendor.findById(payout.vendor).select('user');
    await Promise.all([
      createNotification({
        recipientId: vendor?.user,
        type: 'PAYOUT_STATUS',
        title: 'Vendor payout recorded',
        message: `A manual payout of ${payout.currency} ${Number(payout.netAmount).toLocaleString()} was recorded for payout ${payout.payoutId}, reference ${transferReference}.`,
        link: 'vendor-payouts.html',
        entityType: 'VendorPayout',
        entityId: payout._id,
        io: req.app?.get?.('io'),
        email: true,
      }),
      createNotification({
        recipientId: payout.user,
        type: 'PAYOUT_STATUS',
        title: 'Vendor payout reconciled',
        message: `The vendor payment for your service has been manually reconciled.`,
        link: 'bookings.html',
        entityType: 'VendorPayout',
        entityId: payout._id,
        io: req.app?.get?.('io'),
      }),
    ]);
    res.status(200).json({ success: true, data: updated, message: 'Manual transfer recorded as paid with proof' });
  } catch (error) {
    if (proof.length) await deleteEvidenceAssets(proof);
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Transfer reference already exists' });
    throw error;
  }
});

exports.beginManualPayoutTransfer = asyncHandler(async (req, res) => {
  const payout = await VendorPayout.findById(req.params.payoutId);
  if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
  if (payout.payoutStatus !== 'APPROVED') return res.status(409).json({ success: false, message: 'Only approved payouts can enter manual transfer processing' });
  const transferReference = typeof req.body?.transferReference === 'string' ? req.body.transferReference.trim() : '';
  if (transferReference.length < 5 || transferReference.length > 120) return res.status(400).json({ success: false, message: 'Enter the transfer reference before initiating the manual transfer' });
  const eligibility = await checkPayoutEligibility(payout);
  if (!eligibility.eligible) return res.status(409).json({ success: false, message: eligibility.message });
  if (!eligibility.vendor.bankAccountNumber || !eligibility.vendor.bankCode) return res.status(409).json({ success: false, message: 'Vendor payout destination is incomplete' });

  const updated = await VendorPayout.findOneAndUpdate(
    { _id: payout._id, payoutStatus: 'APPROVED', transferReference: { $exists: false } },
    {
      $set: { payoutStatus: 'PROCESSING', transferReference },
      $push: { attempts: { admin: req.user.id, action: 'TRANSFER_INITIATED', reference: transferReference, amount: payout.netAmount, reason: 'Manual transfer entered processing; funds are not yet verified as paid.' } },
    },
    { new: true }
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Payout already has a transfer attempt or changed during processing' });
  await CompletionReport.updateOne({ _id: payout.report, payoutStatus: 'APPROVED' }, { $set: { payoutStatus: 'PROCESSING' } });
  await logActivity({
    userId: payout.user,
    actorId: req.user.id,
    actionType: 'VENDOR_PAYOUT_MANUAL_TRANSFER_PROCESSING',
    entityType: 'VENDOR_PAYOUT',
    entityId: payout._id,
    metadata: { payoutId: payout.payoutId, transferReference, amount: payout.netAmount },
    severity: 'ACTION',
  });
  res.status(200).json({ success: true, data: updated, message: 'Manual transfer recorded as processing. This does not mean payment is confirmed.' });
});

exports.markPayoutFailed = asyncHandler(async (req, res) => {
  const payout = await VendorPayout.findById(req.params.payoutId);
  if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
  if (!['APPROVED', 'PROCESSING'].includes(payout.payoutStatus)) return res.status(409).json({ success: false, message: 'Only approved or processing payouts can be marked failed' });
  if (req.body?.confirmedNotPaid !== true && req.body?.confirmedNotPaid !== 'true') {
    return res.status(400).json({ success: false, message: 'Confirm that no payment was completed before marking the payout failed' });
  }
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10) return res.status(400).json({ success: false, message: 'Provide a reconciliation reason of at least 10 characters' });
  payout.payoutStatus = 'FAILED';
  payout.attempts.push({ admin: req.user.id, action: 'FAILED', reference: payout.transferReference, reason });
  await payout.save();
  await CompletionReport.updateOne({ _id: payout.report }, { $set: { payoutStatus: 'FAILED' } });
  const vendor = await Vendor.findById(payout.vendor).select('user');
  await createNotification({
    recipientId: vendor?.user,
    type: 'PAYOUT_STATUS',
    title: 'Payout requires reconciliation',
    message: `Payout ${payout.payoutId} could not be reconciled. The payout remains unpaid; contact support for details.`,
    link: 'vendor-payouts.html',
    entityType: 'VendorPayout',
    entityId: payout._id,
    io: req.app?.get?.('io'),
    email: true,
  });
  const admins = await User.find({ role: 'ADMIN', isActive: true, _id: { $ne: req.user.id } }).select('_id');
  await Promise.all(admins.map((admin) => createNotification({
    recipientId: admin._id,
    type: 'PAYOUT_STATUS',
    title: 'Payout requires reconciliation',
    message: `Payout ${payout.payoutId} was marked failed by an administrator and requires review.`,
    link: 'admin-payouts.html',
    entityType: 'VendorPayout',
    entityId: payout._id,
    io: req.app?.get?.('io'),
  })));
  await logActivity({
    userId: payout.user,
    actorId: req.user.id,
    actionType: 'VENDOR_PAYOUT_MANUAL_RECONCILIATION_FAILED',
    entityType: 'VENDOR_PAYOUT',
    entityId: payout._id,
    metadata: { payoutId: payout.payoutId, reason },
    severity: 'ERROR',
  });
  res.status(200).json({ success: true, data: payout, message: 'Payout marked failed; it has not been marked paid' });
});

exports.reopenFailedPayout = asyncHandler(async (req, res) => {
  const payout = await VendorPayout.findById(req.params.payoutId);
  if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
  if (payout.payoutStatus !== 'FAILED') return res.status(409).json({ success: false, message: 'Only failed payouts can be reopened' });
  if (req.body?.transferNotSent !== true && req.body?.transferNotSent !== 'true') {
    return res.status(400).json({ success: false, message: 'Confirm no transfer was completed before reopening this payout' });
  }
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10) return res.status(400).json({ success: false, message: 'Provide a retry/reconciliation reason of at least 10 characters' });
  const updated = await VendorPayout.findOneAndUpdate(
    { _id: payout._id, payoutStatus: 'FAILED' },
    {
      $set: { payoutStatus: 'ON_HOLD' },
      $unset: { transferReference: '' },
      $push: { attempts: { admin: req.user.id, action: 'REOPENED_FOR_RETRY', reason } },
    },
    { new: true }
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Payout changed during retry review' });
  await CompletionReport.updateOne({ _id: payout.report, payoutStatus: 'FAILED' }, { $set: { payoutStatus: 'ON_HOLD' } });
  await logActivity({
    userId: payout.user,
    actorId: req.user.id,
    actionType: 'VENDOR_PAYOUT_REOPENED_FOR_RETRY',
    entityType: 'VENDOR_PAYOUT',
    entityId: payout._id,
    metadata: { payoutId: payout.payoutId, reason },
    severity: 'ACTION',
  });
  res.status(200).json({ success: true, data: updated, message: 'Payout returned to hold for a fresh eligibility check' });
});
