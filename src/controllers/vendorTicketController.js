const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const Request = require('../models/Request');
const Booking = require('../models/Booking');
const SupportTicket = require('../models/SupportTicket');

// MVP ticket triage for vendors.
// Scope rule:
// - A ticket is visible to a vendor if ticket.booking belongs to a booking of this vendor
//   OR ticket.request.vendor belongs to this vendor.
// Because SupportTicket currently only stores request + booking ObjectIds (without vendor ref),
// we validate access via populated documents.

exports.getMyTickets = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user.id });
  if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile not found' });

  const { status, page = 1, limit = 20 } = req.query;
  const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED', 'CLOSED'];
  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket status' });
  }
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(50, Math.max(parseInt(limit, 10) || 20, 1));
  const skip = (safePage - 1) * safeLimit;
  const [requestIds, bookingIds] = await Promise.all([
    Request.distinct('_id', { vendor: vendor._id }),
    Booking.distinct('_id', { vendor: vendor._id }),
  ]);
  const filter = {
    $or: [
      { vendor: vendor._id },
      { request: { $in: requestIds } },
      { booking: { $in: bookingIds } },
    ],
  };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .select('-adminNotes')
      .populate('user', 'firstName lastName email role')
      .populate('vendor', 'businessName')
      .populate('request', 'eventDate eventLocation status')
      .populate('booking', 'eventDate bookingStatus paymentStatus')
      .populate('payment', 'paymentStatus amount currency')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items,
  });
});

