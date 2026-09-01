const multer = require('multer');

// Use memory storage so the file buffer can be streamed directly to Cloudinary.
const memoryStorage = multer.memoryStorage();

/**
 * Verify actual file content by checking magic bytes
 * Returns true if file signature matches claimed MIME type
 */
function verifyFileSignature(buffer, mimetype) {
  if (!buffer || buffer.length < 4) return false;

  // Magic bytes for common image formats
  const signatures = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF for WebP
  };

  const sig = signatures[mimetype];
  if (!sig) return false;

  for (let i = 0; i < sig.length; i++) {
    if (buffer[i] !== sig[i]) return false;
  }
  return true;
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

  // Verify actual file content via magic bytes
  if (!verifyFileSignature(file.buffer, file.mimetype)) {
    return cb(new Error('File content does not match claimed format. Ensure you are uploading a valid image.'));
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

const uploadSingle = (fieldName) => upload.single(fieldName);

module.exports = {
  upload,
  uploadSingle,
};

