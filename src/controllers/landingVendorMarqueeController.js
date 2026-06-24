const asyncHandler = require('express-async-handler');

const Vendor = require('../models/Vendor');

// Public: landing page vendor marquee (no auth required)
// Returns { success: true, data: [{ name }] }
exports.getLandingVendorMarquee = asyncHandler(async (req, res) => {
  const limit = Math.max(parseInt(req.query.limit, 10) || 12, 1);

  // Use verified vendors if available; fall back to all.
  const filter = { isVerified: true };
  let vendors = await Vendor.find(filter)
    .sort({ rating: -1, totalReviews: -1 })
    .limit(limit)
    .select('businessName rating totalReviews isVerified')
    .lean();

  if (!vendors.length) {
    vendors = await Vendor.find({})
      .sort({ rating: -1, totalReviews: -1 })
      .limit(limit)
      .select('businessName rating totalReviews isVerified')
      .lean();
  }

  const items = (Array.isArray(vendors) ? vendors : [])
    .map((v) => ({ name: v?.businessName }))
    .filter((x) => x.name);

  return res.status(200).json({ success: true, data: items, message: 'Landing vendor marquee fetched' });
});

