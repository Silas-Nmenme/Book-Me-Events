const multer = require('multer');

// Use memory storage so the file buffer can be streamed directly to Cloudinary.
const memoryStorage = multer.memoryStorage();

/**
 * Verify actual file content by checking magic bytes
 * Returns true if file signature matches claimed MIME type
 */
function verifyFileSignature(buffer, mimetype) {
  if (!buffer || buffer.length < 4) return false;

  if (mimetype === 'application/pdf') {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (mimetype === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  if (mimetype === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  if (mimetype === 'image/gif') return buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimetype === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

const fileFilter = (req, file, cb) => {
  if (!file) return cb(null, false);

  const allowed = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
  ];

  // Check MIME type (client-provided, can be spoofed)
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Upload an image file (png/jpg/jpeg/webp/gif).'));
  }

  cb(null, true);
};

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter,
});

const evidenceMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const evidenceUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    if (!evidenceMimes.includes(file.mimetype)) {
      return cb(new Error('Evidence must be PNG, JPEG, WebP, GIF, or PDF (max 5 MB each).'));
    }
    cb(null, true);
  },
});

function validateUploadedFiles(req, res, next) {
  const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
  const invalidFile = files.find((file) => !verifyFileSignature(file.buffer, file.mimetype));

  if (invalidFile) {
    res.status(400);
    return next(new Error('File content does not match claimed format. Ensure you are uploading a valid image.'));
  }

  next();
}

const uploadSingle = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(err);
    }
    return validateUploadedFiles(req, res, next);
  });
};

const uploadEvidence = (fieldName) => (req, res, next) => {
  evidenceUpload.array(fieldName, 4)(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(err);
    }
    return validateUploadedFiles(req, res, next);
  });
};

module.exports = {
  upload,
  uploadSingle,
  uploadEvidence,
  validateUploadedFiles,
};

