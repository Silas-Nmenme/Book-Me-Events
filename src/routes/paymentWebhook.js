const { handleFlutterwaveWebhook } = require('../controllers/paymentController');

module.exports = (req, res) => handleFlutterwaveWebhook(req, res);
