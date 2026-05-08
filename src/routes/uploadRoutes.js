const express = require('express');
const asyncHandler = require('express-async-handler');

const { uploadSingle } = require('../middlewares/uploadMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');
const { protect } = require('../middlewares/authMiddleware');
const User = require('../models/User');

const router = express.Router();

// Upload profile picture for authenticated user (ADMIN/USER/VENDOR).
// Frontend should send: multipart/form-data with field name = `image`.
// Required: Authorization header (Bearer token).
router.post(
  '/profile-picture',
  protect,
  uploadSingle('image'),
  asyncHandler(async (req, res) => {
    const result = await uploadToCloudinary({
      file: req.file,
      folder: 'profile_pictures',
    });

    // Persist image URL to the logged-in user's profile.
    // (Vendor profile picture is also stored on User.profilePicture in this schema.)
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: result.secure_url },
      { new: true, runValidators: true }
    );

    res.status(201).json({
      success: true,
      data: {
        user,
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  })
);



router.post(
  '/vendor-kyc',

  uploadSingle('image'),
  asyncHandler(async (req, res) => {
    const result = await uploadToCloudinary({
      file: req.file,
      folder: 'vendor_kyc',
    });

    res.status(201).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  })
);

// Example generic uploads if you need more later.
router.post(
  '/generic',
  uploadSingle('image'),
  asyncHandler(async (req, res) => {
    const result = await uploadToCloudinary({
      file: req.file,
      folder: 'uploads',
    });

    res.status(201).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  })
);

module.exports = router;

