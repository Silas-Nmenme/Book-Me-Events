const asyncHandler = require('express-async-handler');

const Vendor = require('../models/Vendor');

// City coordinates fallback (simple, can be refined later)
const cityCoords = {
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Abuja: { lat: 9.0765, lng: 7.3986 },
  'Port Harcourt': { lat: 4.8156, lng: 7.0498 },
  Ibadan: { lat: 7.3775, lng: 3.947 },
};

exports.getVendorsForMap = asyncHandler(async (req, res) => {
  const { city, category, limit = 20 } = req.query;

  let filter = {};
  if (category) {
    filter.serviceCategories = { $in: [category] };
  }

  // We don't have geocoding in schema yet; use city fallback.
  const base = cityCoords[city] || cityCoords.Lagos;

  const vendors = await Vendor.find(filter)
    .limit(Number(limit))
    .sort({ rating: -1 })
    .select('_id businessName rating totalReviews serviceCategories lat lng user profileCompletionPercentage')
    .lean();

  const items = vendors.map((v, idx) => {
    const lat = typeof v.lat === 'number' ? v.lat : base.lat + (Math.random() - 0.5) * 0.05;
    const lng = typeof v.lng === 'number' ? v.lng : base.lng + (Math.random() - 0.5) * 0.05;
    return {
      _id: v._id,
      name: v.businessName,
      category: (v.serviceCategories && v.serviceCategories[0]) || category || 'Vendor',
      rating: v.rating,
      lat,
      lng,
    };
  });

  return res.status(200).json({ success: true, data: items, message: 'Vendors for map fetched' });
});

