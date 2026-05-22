const { flutterwaveWebhook } = require('../controllers/paymentController');

module.exports = (req, res) => flutterwaveWebhook(req, res);
