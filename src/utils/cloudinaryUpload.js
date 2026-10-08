const { cloudinary } = require('../config/cloudinary');

/**
 * Upload a Multer (memory) file buffer to Cloudinary.
 * @param {object} options
 * @param {import('multer').File} options.file
 * @param {string} options.folder
 * @param {string} [options.publicId]
 * @param {number} [options.quality]
 */
async function uploadToCloudinary({ file, folder, publicId, quality = 80, resourceType = 'image', deliveryType, timeoutMs = 120000 }) {
  if (!file) throw new Error('No file provided');
  if (!file.buffer) throw new Error('File buffer missing');

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      streamUpload.destroy(new Error('Cloudinary upload timed out'));
      reject(new Error('Cloudinary upload timed out'));
    }, timeoutMs);
    const streamUpload = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        ...(deliveryType ? { type: deliveryType } : {}),
        ...(resourceType === 'image' ? { quality } : {}),
        overwrite: false,
      },
      (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamUpload.end(file.buffer);
  });
}

module.exports = {
  uploadToCloudinary,
};

