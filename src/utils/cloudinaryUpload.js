const { cloudinary } = require('../config/cloudinary');

/**
 * Upload a Multer (memory) file buffer to Cloudinary.
 * @param {object} options
 * @param {import('multer').File} options.file
 * @param {string} options.folder
 * @param {string} [options.publicId]
 * @param {number} [options.quality]
 */
async function uploadToCloudinary({ file, folder, publicId, quality = 80 }) {
  if (!file) throw new Error('No file provided');
  if (!file.buffer) throw new Error('File buffer missing');

  return new Promise((resolve, reject) => {
    const streamUpload = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        quality,
        overwrite: false,
      },
      (error, result) => {
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

