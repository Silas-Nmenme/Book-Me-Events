const express = require('express');
const router = express.Router();

const { handleFlutterwaveWebhook } = require('../controllers/paymentController');

// Flutterwave webhook handler.
// app.js mounts this router at:
//   /payment/webhook/flutterwave
//   /api/payment/webhook/flutterwave
//   /v1/payments/webhook/flutterwave
//   /api/v1/payments/webhook/flutterwave
// so the path here can be the empty string.
router.post('/', handleFlutterwaveWebhook);

module.exports = router;


