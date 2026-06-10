const asyncHandler = require('express-async-handler');

const Booking = require('../models/Booking');

exports.getUpcomingBookings = asyncHandler(async (req, res) => {
  // Next 3 bookings, sorted by date, status, vendor info
  const userId = req.user.id;

  const now = new Date();

  const items = await Booking.find({
    user: userId,
    bookingStatus: { $in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
    eventDate: { $gte: now },
  })
    .populate('vendor', 'businessName rating profileCompletionPercentage totalReviews')
    .populate('service', 'serviceName name category')
    .sort({ eventDate: 1 })
    .limit(3);

  // normalize shape for widget
  const data = items.map((b) => ({
    _id: b._id,
    eventType: b.service?.serviceName || b.service?.name || b.service?.category || 'Event',
    vendor: {
      _id: b.vendor?._id,
      name: b.vendor?.businessName,
    },
    vendorName: b.vendor?.businessName,
    type: b.service?.category || b.service?.name,
    date: b.eventDate,
    status: b.bookingStatus,
    bookingStatus: b.bookingStatus,
  }));

  return res.status(200).json({ success: true, data, message: 'Upcoming bookings fetched' });
});

