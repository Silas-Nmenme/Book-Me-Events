const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadEvidence, uploadCompletionMedia } = require('../middlewares/uploadMiddleware');
const { uploadLimiter } = require('../middlewares/rateLimiters');
const {
  createDraftForBooking,
  uploadCompletionMedia: uploadCompletionMediaController,
  removeCompletionMedia,
  submitCompletionReport,
  submitAdditionalInformation,
  getCompletionReport,
  submitClientClarification,
  submitSatisfactionDecision,
} = require('../controllers/completionReportController');

router.post('/bookings/:bookingId/draft', protect, authorize('VENDOR'), createDraftForBooking);
router.post('/:reportId/media', protect, authorize('VENDOR'), uploadLimiter, uploadCompletionMedia('media'), uploadCompletionMediaController);
router.delete('/:reportId/media/:mediaId', protect, authorize('VENDOR'), removeCompletionMedia);
router.post('/:reportId/submit', protect, authorize('VENDOR'), submitCompletionReport);
router.post('/:reportId/vendor-response', protect, authorize('VENDOR'), submitAdditionalInformation);
router.post('/:reportId/client-response', protect, authorize('USER'), submitClientClarification);
router.post('/:reportId/satisfaction', protect, authorize('USER'), uploadLimiter, uploadEvidence('evidence'), submitSatisfactionDecision);
router.get('/:reportId', protect, authorize('USER', 'VENDOR', 'ADMIN'), getCompletionReport);

module.exports = router;
