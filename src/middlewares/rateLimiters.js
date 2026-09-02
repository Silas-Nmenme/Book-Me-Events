/**
 * Comprehensive rate limiting for all critical endpoints
 * Protects against brute force, DoS, and enumeration attacks
 */

const { ipKeyGenerator, rateLimit } = require('express-rate-limit');

// Account key generator - consistent across limiters
const createAccountKey = (req) => {
  const email = req.body?.email || req.body?.username || '';
  return email ? String(email).toLowerCase() : ipKeyGenerator(req.ip);
};

// ==================== AUTH LIMITERS ====================

const loginLimiterByAccount = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Reduced from 8 to 5
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `acct:${createAccountKey(req)}`,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  skip: (req) => {
    // Skip rate limiting for health checks or test mode
    return process.env.NODE_ENV === 'test';
  },
});

const loginLimiterByIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Reduced from 30
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP. Try again later.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Reduced from 10 to prevent OTP enumeration
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `otp:${createAccountKey(req)}:${req.path}`,
  message: { success: false, message: 'Too many OTP attempts. Try again in 15 minutes.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Reduced from 6
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `reset:${createAccountKey(req)}:${req.path}`,
  message: { success: false, message: 'Too many password reset requests. Try again in 1 hour.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reset attempts. Try again in 15 minutes.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

// ==================== API ENDPOINT LIMITERS ====================

// General API limiter for all protected endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Booking creation - protect against booking spam
const bookingCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 bookings per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `booking:${req.user?.id || ipKeyGenerator(req.ip)}`,
  message: { success: false, message: 'Too many booking requests. Try again later.' },
  skip: (req) => process.env.NODE_ENV === 'test' || !req.user,
});

// Payment creation - protect against payment spam
const paymentCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 payment attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `payment:${req.user?.id || ipKeyGenerator(req.ip)}`,
  message: { success: false, message: 'Too many payment attempts. Try again later.' },
  skip: (req) => process.env.NODE_ENV === 'test' || !req.user,
});

// Review creation - prevent review bombing
const reviewCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 reviews per day per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `review:${req.user?.id || ipKeyGenerator(req.ip)}`,
  message: { success: false, message: 'You can only submit 10 reviews per day.' },
  skip: (req) => process.env.NODE_ENV === 'test' || !req.user,
});

// Message sending - prevent spam
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `message:${req.user?.id || ipKeyGenerator(req.ip)}`,
  message: { success: false, message: 'You are messaging too quickly. Please slow down.' },
  skip: (req) => process.env.NODE_ENV === 'test' || !req.user,
});

// File upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `upload:${req.user?.id || ipKeyGenerator(req.ip)}`,
  message: { success: false, message: 'Too many upload attempts. Try again later.' },
  skip: (req) => process.env.NODE_ENV === 'test' || !req.user,
});

// Admin operations - stricter
const adminOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // Higher for admin but still tracked
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `admin:${req.user?.id || ipKeyGenerator(req.ip)}`,
  message: { success: false, message: 'Admin operation rate limit exceeded.' },
  skip: (req) => process.env.NODE_ENV === 'test' || !req.user,
});

// Public listing endpoints - prevent enumeration
const listingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

module.exports = {
  // Auth
  loginLimiterByAccount,
  loginLimiterByIp,
  otpLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  
  // API
  apiLimiter,
  bookingCreationLimiter,
  paymentCreationLimiter,
  reviewCreationLimiter,
  messageLimiter,
  uploadLimiter,
  adminOperationLimiter,
  listingLimiter,
};

