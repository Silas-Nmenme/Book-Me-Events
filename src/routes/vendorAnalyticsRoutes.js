const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { getVendorAnalytics } = require('../controllers/vendorAnalyticsController');
const { getVendorSla } = require('../controllers/vendorSlaController');
const {
  getMyTickets,
} = require('../controllers/vendorTicketController');
const {
  getMyPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getPromotionsPublic,
} = require('../controllers/vendorPromotionController');

// VENDOR-only analytics & SLA
router.get('/analytics', protect, authorize('VENDOR'), getVendorAnalytics);
router.get('/sla', protect, authorize('VENDOR'), getVendorSla);

// VENDOR ticket triage (MVP: derived via request/booking ownership)
router.get('/tickets', protect, authorize('VENDOR'), getMyTickets);

// VENDOR promotions (MVP)
router.get('/promotions', protect, authorize('VENDOR'), getMyPromotions);
router.post('/promotions', protect, authorize('VENDOR'), createPromotion);
router.put('/promotions/:id', protect, authorize('VENDOR'), updatePromotion);
router.delete('/promotions/:id', protect, authorize('VENDOR'), deletePromotion);

// Public promotions listing
router.get('/promotions/public', getPromotionsPublic);

module.exports = router;

