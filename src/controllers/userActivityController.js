const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');


// USER: activity feed
exports.getMyActivity = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);

  const skip = (safePage - 1) * safeLimit;

  // Guard against bad/incorrectly-injected req.user.id values (prevents ObjectId cast crash)
  const userIdRaw = req?.user?.id ?? req?.user?._id ?? req?.user;
  const userIdStr = typeof userIdRaw === 'string' ? userIdRaw : userIdRaw?.toString?.();
  if (!userIdStr || !mongoose.Types.ObjectId.isValid(String(userIdStr))) {
    return res.status(401).json({
      success: false,
      message: 'Invalid user context'
    });
  }
  const userId = mongoose.Types.ObjectId(String(userIdStr));





  const items = await ActivityLog.find({ user: userId })
    .sort({ occurredAt: -1 })
    .skip(skip)
    .limit(safeLimit);

  const total = await ActivityLog.countDocuments({ user: userId });

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items,
  });
});


// USER: booking tracking timeline (derived MVP)
exports.getMyBookingTracking = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);

  const skip = (safePage - 1) * safeLimit;

  const userId = req?.user?.id;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid user context'
    });
  }

  const bookings = await Booking.find({ user: userId })
    .populate('vendor')
    .populate('service')
    .populate('request')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit);

  const bookingIds = bookings.map((b) => b._id);
  const payments = await Payment.find({ booking: { $in: bookingIds } });
  const paymentByBooking = new Map(payments.map((p) => [p.booking.toString(), p]));

  const items = bookings.map((b) => {
    const p = paymentByBooking.get(b._id.toString());
    return {
      booking: b,
      payment: p || null,
      timeline: [
        { at: b.createdAt, label: 'Requested/Created booking record' },
        { at: b.updatedAt, label: `Booking status: ${b.bookingStatus}` },
        p
          ? { at: p.updatedAt, label: `Payment status: ${p.paymentStatus}` }
          : { at: null, label: 'Payment: not initiated' },
      ].filter((x) => x.at !== null),
    };
  });

  const total = await Booking.countDocuments({ user: req.user.id });

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items,
  });
});

