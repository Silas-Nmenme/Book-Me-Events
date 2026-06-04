const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
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
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (status) filter.status = status;

  // Pull candidate tickets; then filter by vendor ownership after population.
  const candidates = await SupportTicket.find(filter)
    .populate({
      path: 'booking',
      populate: { path: 'request', select: '_id vendor', populate: { path: 'vendor', select: '_id' } },
    })
    .populate({
      path: 'request',
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean();

  // Post-filter by derived vendor ownership.
  const filtered = candidates.filter((t) => {
    const reqVendor = t?.request?.vendor?._id || t?.request?.vendor || null;
    const bookingVendor = t?.booking?.vendor?._id || t?.booking?.vendor || null;
    const myVendorId = vendor._id.toString();
    return (reqVendor && reqVendor.toString() === myVendorId) || (bookingVendor && bookingVendor.toString() === myVendorId);
  });

  // Total approximation: MVP keeps total small; for accuracy we'd compute in DB with lookups.
  // We recompute total by fetching without pagination (limit for MVP).
  const totalCandidates = await SupportTicket.find(filter)
    .populate('booking')
    .populate('request')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const totalFiltered = totalCandidates.filter((t) => {
    const reqVendor = t?.request?.vendor?._id || t?.request?.vendor || null;
    const bookingVendor = t?.booking?.vendor?._id || t?.booking?.vendor || null;
    const myVendorId = vendor._id.toString();
    return (reqVendor && reqVendor.toString() === myVendorId) || (bookingVendor && bookingVendor.toString() === myVendorId);
  });

  res.status(200).json({
    success: true,
    count: filtered.length,
    total: totalFiltered.length,
    pages: Math.ceil(totalFiltered.length / safeLimit),
    currentPage: safePage,
    data: filtered,
  });
});

