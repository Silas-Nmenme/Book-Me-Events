const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getPayments,
  getPayment,
  createPayment,
  getPaymentByRef,
  refundPayment,
  getPaymentStats,
} = require('../controllers/paymentController');

// Protected routes
router.get('/', protect, getPayments);
router.get('/:id', protect, getPayment);
router.get('/ref/:ref', protect, getPaymentByRef);

// Create payment (User only)
router.post('/', protect, authorize('USER'), createPayment);

// Refund payment
router.post('/:id/refund', protect, refundPayment);

// Payment statistics (Admin only)
router.get('/stats/overview', protect, authorize('ADMIN'), getPaymentStats);

module.exports = router;
