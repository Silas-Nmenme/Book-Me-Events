const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  createTicket,
  getMyTickets,
  getTicket,
} = require('../controllers/ticketController');

router.post('/', protect, authorize('USER'), createTicket);
router.get('/me', protect, authorize('USER'), getMyTickets);
router.get('/:id', protect, authorize('USER'), getTicket);

module.exports = router;

