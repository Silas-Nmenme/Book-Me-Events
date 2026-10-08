const { randomUUID } = require('crypto');
const path = require('path');
const { uploadToCloudinary } = require('./cloudinaryUpload');
const { cloudinary } = require('../config/cloudinary');

async function deleteEvidenceAssets(assets = []) {
  await Promise.all(assets.map((asset) => cloudinary.uploader
    .destroy(asset.publicId, { resource_type: asset.resourceType, type: 'authenticated' })
    .catch(() => null)));
}

async function uploadEvidenceFiles(files = [], folder) {
  const assets = [];
  try {
    for (const file of files) {
      const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
      const uploaded = await uploadToCloudinary({
        file,
        folder,
        resourceType,
        deliveryType: 'authenticated',
        publicId: resourceType === 'raw' ? `${randomUUID()}.pdf` : undefined,
      });
      assets.push({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        resourceType,
        mimeType: file.mimetype,
        originalName: path.basename(file.originalname || 'attachment').replace(/[\u0000-\u001f]/g, '').slice(0, 255),
        size: file.size,
      });
    }
    return assets;
  } catch (error) {
    await deleteEvidenceAssets(assets);
    throw error;
  }
}

module.exports = { uploadEvidenceFiles, deleteEvidenceAssets };
