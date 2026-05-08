const multer = require('multer');

// Use memory storage so the file buffer can be streamed directly to Cloudinary.
const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file) return cb(null, false);

  const allowed = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Upload an image file (png/jpg/jpeg/webp/gif).'));
  }

  cb(null, true);
};

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB (tune as needed)
  },
  fileFilter,
});

const uploadSingle = (fieldName) => upload.single(fieldName);

module.exports = {
  upload,
  uploadSingle,
};

