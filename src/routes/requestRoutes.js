const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  getRequests,
  getRequest,
  createRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  updateRequest,
  deleteRequest,
} = require('../controllers/requestController');


// Protected routes with general API rate limiting
router.get('/', protect, apiLimiter, getRequests);
router.get('/:id', protect, apiLimiter, getRequest);

// Create request (User only) with rate limiting
router.post('/', protect, authorize('USER'), apiLimiter, createRequest);

// Update request with rate limiting
router.put('/:id', protect, apiLimiter, updateRequest);

// Delete request (User only) with rate limiting
router.delete('/:id', protect, apiLimiter, deleteRequest);

// Accept/Decline/Cancel requests with rate limiting

router.put('/:id/accept', protect, authorize('VENDOR'), apiLimiter, acceptRequest);
router.put('/:id/decline', protect, authorize('VENDOR'), apiLimiter, declineRequest);
router.put('/:id/cancel', protect, apiLimiter, cancelRequest);


module.exports = router;
