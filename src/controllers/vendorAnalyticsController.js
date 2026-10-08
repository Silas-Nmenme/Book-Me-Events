const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Request = require('../models/Request');
const Message = require('../models/Message');
const SupportTicket = require('../models/SupportTicket');

// VENDOR: analytics derived from the real data model owned by the authenticated vendor.
exports.getVendorAnalytics = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: missing user id' });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ success: false, message: 'Unauthorized: invalid user id token' });
    }

    const vendor = await Vendor.findOne({ user: userId }).select('_id user');
    if (!vendor) {
      return res.status(403).json({ success: false, message: 'Vendor profile not found' });
    }

    const vendorObjectId = vendor._id;
    const vendorUserObjectId = vendor.user;

    const [
      totalServices,
      activeServices,
      pendingRequests,
      acceptedRequests,
      completedRequests,
      cancelledRequests,
      totalBookings,
      completedBookings,
      pendingBookings,
      totalPayments,
      totalRevenueAgg,
      avgRatingAgg,
      reviewsCount,
      paymentsByMethodAgg,
      unreadMessages,
      openSupportTickets,
    ] = await Promise.all([
      Service.countDocuments({ vendor: vendorObjectId }),
      Service.countDocuments({ vendor: vendorObjectId, availabilityStatus: 'AVAILABLE' }),
      Request.countDocuments({ vendor: vendorObjectId, status: 'PENDING' }),
      Request.countDocuments({ vendor: vendorObjectId, status: 'ACCEPTED' }),
      Request.countDocuments({ vendor: vendorObjectId, status: 'COMPLETED' }),
      Request.countDocuments({ vendor: vendorObjectId, status: 'CANCELLED' }),
      Booking.countDocuments({ vendor: vendorObjectId }),
      Booking.countDocuments({ vendor: vendorObjectId, bookingStatus: 'COMPLETED' }),
      Booking.countDocuments({
        vendor: vendorObjectId,
        bookingStatus: { $in: ['CONFIRMED', 'IN_PROGRESS'] },
      }),
      Payment.countDocuments({ vendor: vendorObjectId }),
      Payment.aggregate([
        { $match: { vendor: vendorObjectId, paymentStatus: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Review.aggregate([
        { $match: { vendor: vendorObjectId } },
        { $group: { _id: null, avg: { $avg: '$rating' } } },
      ]),
      Review.countDocuments({ vendor: vendorObjectId }),
      Payment.aggregate([
        { $match: { vendor: vendorObjectId, paymentStatus: 'COMPLETED' } },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      Message.countDocuments({ recipient: vendorUserObjectId, isRead: false }),
      SupportTicket.countDocuments({
        $or: [
          { request: { $in: await Request.find({ vendor: vendorObjectId }).distinct('_id') } },
          { booking: { $in: await Booking.find({ vendor: vendorObjectId }).distinct('_id') } },
        ],
      }),
    ]);

    const totalRevenue = Number(totalRevenueAgg?.[0]?.total ?? 0) || 0;
    const avgRaw = avgRatingAgg?.[0]?.avg;
    const averageRating = Number(avgRaw ?? 0);
    const averageRatingRounded = Number.isFinite(averageRating) ? Number(averageRating.toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        vendor: vendorObjectId,
        totalServices,
        activeServices,
        pendingRequests,
        incomingRequests: pendingRequests,
        acceptedRequests,
        completedRequests,
        cancelledRequests,
        totalBookings,
        completedBookings,
        pendingBookings,
        totalPayments,
        totalRevenue,
        averageRating: averageRatingRounded,
        totalReviews: reviewsCount,
        paymentsByMethod: paymentsByMethodAgg,
        unreadMessages,
        openSupportTickets,
      },
    });
  } catch (err) {
    console.error('[vendorAnalytics] getVendorAnalytics failed:', {
      message: err?.message,
      stack: err?.stack,
      userId: req?.user?._id || req?.user?.id,
    });

    return res.status(500).json({ success: false, message: 'Failed to load vendor analytics' });
  }
});

