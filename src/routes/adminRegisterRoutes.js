const express = require('express');
const router = express.Router();

const {
  adminRegisterPage1,
  adminVerifyOtp,
} = require('../controllers/adminRegisterController');


router.post('/register/page1', adminRegisterPage1);
router.post('/register/page2/verify-otp', adminVerifyOtp);

module.exports = router;

