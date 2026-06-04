const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');

// VENDOR: analytics derived from existing domain models.
// Keeps MVP minimal: no persistence, just computed views.
exports.getVendorAnalytics = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user.id });
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
    Payment.aggregate([
      { $match: { vendor: vendor._id, paymentStatus: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Review.aggregate([
      { $match: { vendor: vendor._id } },
      { $group: { _id: null, avg: { $avg: '$rating' } } },
    ]),
    Review.countDocuments({ vendor: vendor._id }),
    Payment.aggregate([
      { $match: { vendor: vendor._id, paymentStatus: 'COMPLETED' } },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const totalRevenue = totalRevenueAgg?.[0]?.total || 0;
  const averageRating = avgRatingAgg?.[0]?.avg ? Number(avgRatingAgg[0].avg).toFixed(1) : '0.0';

  res.status(200).json({
    success: true,
    data: {
      vendor: vendor._id,
      totalBookings,
      completedBookings,
      totalRevenue,
      averageRating: Number(averageRating),
      totalReviews: reviewsCount,
      paymentsByMethod: paymentsByMethodAgg,
    },
  });
});

