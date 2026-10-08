function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  minimumImages: positiveInteger(process.env.COMPLETION_MIN_IMAGES, 5),
  maximumImages: positiveInteger(process.env.COMPLETION_MAX_IMAGES, 20),
  maximumVideos: positiveInteger(process.env.COMPLETION_MAX_VIDEOS, 5),
  imageMaxBytes: positiveInteger(process.env.COMPLETION_IMAGE_MAX_BYTES, 8 * 1024 * 1024),
  videoMaxBytes: positiveInteger(process.env.COMPLETION_VIDEO_MAX_BYTES, 50 * 1024 * 1024),
};
