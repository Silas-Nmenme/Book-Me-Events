const asyncHandler = require('express-async-handler');

const Vendor = require('../models/Vendor');

// Public: landing page category vendor counts (no auth required)
// Returns { success: true, data: { "<category lowercase>": count } }
exports.getLandingCategoryCounts = asyncHandler(async (req, res) => {
  const rows = await Vendor.aggregate([
    { $match: { serviceCategories: { $exists: true, $ne: [] } } },
    { $unwind: '$serviceCategories' },
    {
      $group: {
        _id: { $toLower: '$serviceCategories' },
        count: { $sum: 1 },
      },
    },
  ]);

  const data = rows.reduce((acc, row) => {
    if (row?._id) acc[row._id] = row.count;
    return acc;
  }, {});

  return res.status(200).json({ success: true, data, message: 'Landing category counts fetched' });
});
