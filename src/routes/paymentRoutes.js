const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { body } = require('express-validator');
const validateRequest = require('../middlewares/validateRequest');
const {
  getPayments,
  getPayment,
  createPayment,
  getPaymentByRef,
  refundPayment,
  getPaymentStats,
  createFlutterwavePayment,
} = require('../controllers/paymentController');

const { getPaymentsSummary } = require('../controllers/paymentsSummaryController');


// Protected routes
router.get('/', protect, getPayments);
router.get('/ref/:ref', protect, getPaymentByRef);
router.get('/stats/overview', protect, authorize('ADMIN'), getPaymentStats);

router.get('/summary', protect, getPaymentsSummary);

router.get('/:id', protect, getPayment);


// Create payment (User only)
router.post(
  '/',
  protect,
  authorize('USER'),
  [
    body('booking').exists().withMessage('booking is required').isMongoId().withMessage('booking must be a valid id'),
    body('paymentMethod').exists().withMessage('paymentMethod is required').isIn(['CARD', 'OFFLINE', 'WALLET']).withMessage('invalid paymentMethod'),
    body('transactionReference').exists().withMessage('transactionReference is required').isString(),
    body('paymentGateway').optional().isString(),
  ],
  validateRequest,
  createPayment
);

// Refund payment
router.post('/:id/refund', protect, refundPayment);

// Create Flutterwave Payment Link
router.post('/initialize', protect, authorize('USER'), createFlutterwavePayment);


module.exports = router;
