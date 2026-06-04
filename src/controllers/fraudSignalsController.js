const asyncHandler = require('express-async-handler');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Vendor = require('../models/Vendor');
const User = require('../models/User');

// MVP fraud/anomaly signals for ADMIN.
// Returns computed aggregates only (no persistence).
// Keep this endpoint lightweight and deterministic.
exports.getFraudSignals = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const safeDays = Math.max(parseInt(days, 10) || 30, 1);

  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  // 1) Payment failures / failed attempts
  const failedPaymentsAgg = await Payment.aggregate([
    {
      $match: {
        paymentStatus: { $in: ['FAILED', 'PENDING'] },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$user',
        failedCount: { $sum: 1 },
        failedAmount: { $sum: { $toDouble: '$amount' } },
      },
    },
    { $sort: { failedCount: -1 } },
    { $limit: 10 },
  ]);

  // 2) Zero/near-zero settled attempts (amount small)
  const microAmountAgg = await Payment.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        paymentStatus: 'FAILED',
        amount: { $lte: 10 },
      },
    },
    {
      $group: {
        _id: '$vendor',
        microFailedCount: { $sum: 1 },
      },
    },
    { $sort: { microFailedCount: -1 } },
    { $limit: 10 },
  ]);

  // 3) Booking status mismatches: COMPLETED bookings without COMPLETED payments
  // Derive: completed bookings last safeDays.
  const mismatchesAgg = await Booking.aggregate([
    {
      $match: {
        bookingStatus: 'COMPLETED',
        createdAt: { $gte: since },
      },
    },
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'booking',
        as: 'payments',
      },
    },
    {
      $addFields: {
        hasCompletedPayment: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: '$payments',
                  as: 'p',
                  cond: { $eq: ['$$p.paymentStatus', 'COMPLETED'] },
                },
              },
            },
            0,
          ],
        },
      },
    },
    { $match: { hasCompletedPayment: false } },
    {
      $group: {
        _id: '$vendor',
        mismatchCount: { $sum: 1 },
      },
    },
    { $sort: { mismatchCount: -1 } },
    { $limit: 10 },
  ]);

  // 4) Unverified vendors with service listings not available? (signal only)
  const rejectedVendorsCount = await Vendor.countDocuments({ kycStatus: 'REJECTED' });
  const pendingKycVendorsCount = await Vendor.countDocuments({ kycStatus: 'PENDING' });

  // 5) Admin should review vendors that have recently switched KYC states heavily.
  // We lack immutable audit trail in MVP; return simple counts by KYC status.

  res.status(200).json({
    success: true,
    data: {
      window: { since: since.toISOString(), days: safeDays },
      failedPaymentsByUser: failedPaymentsAgg,
      microFailedByVendor: microAmountAgg,
      completedBookingWithoutCompletedPaymentByVendor: mismatchesAgg,
      kyc: {
        rejectedVendorsCount,
        pendingKycVendorsCount,
      },
      notes: 'Signals are computed from existing payment/booking/KYC states. For strong auditability, wire immutable ActivityLog and persist moderation events.',
    },
  });
});

