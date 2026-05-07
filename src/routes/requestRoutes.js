const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getRequests,
  getRequest,
  createRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  updateRequest,
} = require('../controllers/requestController');

// Protected routes
router.get('/', protect, getRequests);
router.get('/:id', protect, getRequest);

// Create request (User only)
router.post('/', protect, authorize('USER'), createRequest);

// Update request
router.put('/:id', protect, updateRequest);

// Accept/Decline/Cancel requests
router.put('/:id/accept', protect, authorize('VENDOR'), acceptRequest);
router.put('/:id/decline', protect, authorize('VENDOR'), declineRequest);
router.put('/:id/cancel', protect, cancelRequest);

module.exports = router;
