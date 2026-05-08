const express = require('express');
const asyncHandler = require('express-async-handler');

const { uploadSingle } = require('../middlewares/uploadMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

// Public upload endpoints (you can later protect them with auth).
// Frontend should send: multipart/form-data with field name = `image`.

router.post(
  '/profile-picture',
  uploadSingle('image'),
  asyncHandler(async (req, res) => {
    const result = await uploadToCloudinary({
      file: req.file,
      folder: 'profile_pictures',
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

