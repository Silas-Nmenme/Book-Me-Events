const asyncHandler = require('express-async-handler');
const Request = require('../models/Request');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const SupportTicket = require('../models/SupportTicket');

// User dashboard analytics derived from existing domain models.
// Keeps MVP minimal: no persistence, just computed views.
exports.getUserDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [
    requestsTotal,
    requestsPending,
    bookingsTotal,
    bookingsCompleted,
    ticketsTotal,
    avgRatingAgg,
    // Optional: keep totalRevenue available for later UI work.
    paymentsTotalRevenueAgg,
  ] = await Promise.all([
    Request.countDocuments({ user: userId }),
    Request.countDocuments({ user: userId, status: 'PENDING' }),
    Booking.countDocuments({ user: userId }),
    Booking.countDocuments({ user: userId, bookingStatus: 'COMPLETED' }),
    SupportTicket.countDocuments({ user: userId }),
    Review.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, avg: { $avg: '$rating' } } },
    ]),
    Payment.aggregate([
      { $match: { user: userId, paymentStatus: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const averageRatingRaw = avgRatingAgg?.[0]?.avg;
  const averageRating = averageRatingRaw != null && Number.isFinite(Number(averageRatingRaw))
    ? Number(Number(averageRatingRaw).toFixed(1))
    : 0;

  const totalRevenue = paymentsTotalRevenueAgg?.[0]?.total ?? 0;

  res.status(200).json({
    success: true,
    data: {
      requestsTotal,
      requestsPending,
      bookingsTotal,
      bookingsCompleted,
      ticketsTotal,
      averageRating,
      totalRevenue,
    },
  });
});


