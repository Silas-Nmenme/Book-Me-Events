const express = require('express');
const router = express.Router();

const {
  vendorRegisterPage1,
  vendorRegisterPage2,
  vendorRegisterPage3,
  vendorVerifyOtp,
} = require('../controllers/vendorController');

// Vendor multi-step registration (page1/page2/page3)
router.post('/register/page1', vendorRegisterPage1);
router.post('/register/page2', vendorRegisterPage2);
router.post('/register/page3', vendorRegisterPage3);
router.post('/register/verify-otp', vendorVerifyOtp);

module.exports = router;

