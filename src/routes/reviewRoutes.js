const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  addVendorResponse,
  markHelpful,
  markUnhelpful,
} = require('../controllers/reviewController');

// Public routes
router.get('/', getReviews);
router.get('/:id', getReview);

// Protected routes
router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

// Vendor response to review
router.put('/:id/vendor-response', protect, addVendorResponse);

// Mark helpful/unhelpful (public)
router.put('/:id/helpful', markHelpful);
router.put('/:id/unhelpful', markUnhelpful);

module.exports = router;
