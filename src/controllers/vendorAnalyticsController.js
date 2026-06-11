const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');

// VENDOR: analytics derived from existing domain models.
// Keeps MVP minimal: no persistence, just computed views.
exports.getVendorAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized: missing user id' });
  }

  const vendor = await Vendor.findOne({ user: userId });
  if (!vendor) {
    return res.status(403).json({ success: false, message: 'Vendor profile not found' });
  }

  const [
    totalBookings,
    completedBookings,
    totalRevenueAgg,
    avgRatingAgg,
    reviewsCount,
    paymentsByMethodAgg,
  ] = await Promise.all([
    Booking.countDocuments({ vendor: vendor._id }),
    Booking.countDocuments({ vendor: vendor._id, bookingStatus: 'COMPLETED' }),

    // TOTAL REVENUE (harden amount coercion)
    Payment.aggregate([
      { $match: { vendor: vendor._id, paymentStatus: 'COMPLETED' } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: [{ $toDouble: '$amount' }, 0] } },
        },
      },
    ]),

    // AVG RATING (harden rating coercion)
    Review.aggregate([
      { $match: { vendor: vendor._id } },
      {
        $group: {
          _id: null,
          avg: { $avg: { $ifNull: [{ $toDouble: '$rating' }, 0] } },
        },
      },
    ]),

    Review.countDocuments({ vendor: vendor._id }),

    // PAYMENTS BY METHOD (harden amount coercion)
    Payment.aggregate([
      { $match: { vendor: vendor._id, paymentStatus: 'COMPLETED' } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: { $ifNull: [{ $toDouble: '$amount' }, 0] } },
        },
      },
    ]),
  ]);

  const totalRevenue = Number(totalRevenueAgg?.[0]?.total ?? 0) || 0;
  const avgRaw = avgRatingAgg?.[0]?.avg;
  const averageRating = Number(avgRaw ?? 0);
  const averageRatingRounded = Number.isFinite(averageRating) ? Number(averageRating.toFixed(1)) : 0;


  res.status(200).json({
    success: true,
    data: {
      vendor: vendor._id,
      totalBookings,
      completedBookings,
      totalRevenue,
      averageRating: averageRatingRounded,
      totalReviews: reviewsCount,
      paymentsByMethod: paymentsByMethodAgg,
    },
  });
});

