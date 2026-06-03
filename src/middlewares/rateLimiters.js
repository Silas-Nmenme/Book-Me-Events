const rateLimit = require('express-rate-limit');

// Note: These limits are tuned for common attack patterns (brute force / OTP guessing).
// If you expect high legitimate traffic, increase windows/counts.

const createAccountKey = (req) => {
  // Works for endpoints where email is typically in body.
  const email = req.body?.email || req.body?.username;
  return email ? String(email).toLowerCase() : '';
};

// express-rate-limit needs a safe IPv6-aware fallback key.
// Use req.ip only after it has been normalized by the built-in ipKeyGenerator.
const ipKey = (req) => {
  // express-rate-limit will pass IPv6 through its ipKeyGenerator when available.
  // We still avoid using raw req.ip in keyGenerator functions that trigger IPv6 validation.
  // For account-keyed limiters, this is unused.
  const ip = req.ip || '';
  return ip;
};


const loginLimiterByAccount = rateLimit({

  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `acct:${createAccountKey(req)}`,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

const loginLimiterByIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Use default IP key generator (IPv6-safe) from express-rate-limit.
  message: { success: false, message: 'Too many requests. Try again later.' },
});


const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `otp:${createAccountKey(req)}:${req.path}`,
  message: { success: false, message: 'Too many OTP attempts. Try again later.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `reset:${createAccountKey(req)}:${req.path}`,
  message: { success: false, message: 'Too many reset requests. Try again later.' },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  // Avoid custom keyGenerator using raw req.ip (IPv6 validation in express-rate-limit).
  message: { success: false, message: 'Too many reset attempts. Try again later.' },
});


module.exports = {
  loginLimiterByAccount,
  loginLimiterByIp,
  otpLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
};

