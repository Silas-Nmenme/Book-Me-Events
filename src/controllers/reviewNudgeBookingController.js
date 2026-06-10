const asyncHandler = require('express-async-handler');

const Booking = require('../models/Booking');
const Review = require('../models/Review');

// Implements: GET /api/v1/bookings?status=completed&reviewed=false
// Spec goal: return completed bookings that do not yet have a review.
exports.getCompletedUnreviewedBookings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;

  const completedBookings = await Booking.find({
    user: userId,
    bookingStatus: 'COMPLETED',
  })
    .select('_id vendor service eventDate eventLocation')
    .limit(Number(limit))
    .lean();

  const bookingIds = completedBookings.map((b) => b._id);

  const existingReviews = await Review.find({
    booking: { $in: bookingIds },
    user: userId,
  })
    .select('booking')
    .lean();

  const reviewedSet = new Set(existingReviews.map((r) => String(r.booking)));

  const unreviewed = completedBookings.filter((b) => !reviewedSet.has(String(b._id)));

  // Enrich vendor/service data if referenced by widgets.
  const populated = await Booking.find({ _id: { $in: unreviewed.map((b) => b._id) } })
    .populate('vendor', 'businessName rating profilePicture')
    .populate('service', 'serviceName category name')
    .sort({ eventDate: 1 });

  return res.status(200).json({
    success: true,
    data: populated,
    message: 'Unreviewed completed bookings fetched',
  });
});

