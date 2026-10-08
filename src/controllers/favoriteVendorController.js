const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

exports.getFavoriteVendors = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('favoriteVendors')
    .populate({
      path: 'favoriteVendors',
      select: 'businessName profilePicture currentLocation serviceCategories rating totalReviews isVerified gallery',
    })
    .lean();

  res.status(200).json({ success: true, data: user?.favoriteVendors || [] });
});

exports.addFavoriteVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.vendorId).select('_id');
  if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

  await User.updateOne(
    { _id: req.user.id },
    { $addToSet: { favoriteVendors: vendor._id } }
  );
  res.status(200).json({ success: true, message: 'Vendor saved' });
});

exports.removeFavoriteVendor = asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user.id },
    { $pull: { favoriteVendors: req.params.vendorId } }
  );
  res.status(200).json({ success: true, message: 'Vendor removed from saved vendors' });
});
