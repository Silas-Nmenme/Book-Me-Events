const express = require('express');
const router = express.Router();

const {
  adminLogin,
  verifyAdminTotp,
} = require('../controllers/adminAuthController');

router.post('/login', adminLogin);
router.post('/verify-totp', verifyAdminTotp);

module.exports = router;

