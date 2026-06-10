require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { errorHandler } = require('./src/middlewares/errorMiddleware');
const { securityHeaders } = require('./src/middlewares/securityHeaders');
const {
  loginLimiterByAccount,
  loginLimiterByIp,
  otpLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} = require('./src/middlewares/rateLimiters');

const app = express();

// Security headers (Helmet)
app.use(...securityHeaders);

/**
 * ===== CORE MIDDLEWARE =====
 */
// Flutterwave webhook endpoint. Mount it before the JSON body parser.
try {
  const flutterwaveWebhookHandler = require('./src/routes/paymentWebhook');
  app.post('/payment/webhook/flutterwave', express.raw({ type: 'application/json' }), flutterwaveWebhookHandler);
  app.post('/api/payment/webhook/flutterwave', express.raw({ type: 'application/json' }), flutterwaveWebhookHandler);
  app.post('/v1/payments/webhook/flutterwave', express.raw({ type: 'application/json' }), flutterwaveWebhookHandler);
  app.post('/api/v1/payments/webhook/flutterwave', express.raw({ type: 'application/json' }), flutterwaveWebhookHandler);
  console.log('Loaded raw webhook routes: /payment/webhook/flutterwave, /api/payment/webhook/flutterwave, /v1/payments/webhook/flutterwave, /api/v1/payments/webhook/flutterwave');
} catch (err) {
  console.error('Failed to mount Flutterwave webhook route:', err?.message || err);
}

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(morgan('dev'));
app.use(cors({
  origin: ['https://bookmeevent.netlify.app', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// (Optional) Basic rate limits on auth endpoints to prevent brute-force/OTP guessing.
app.use('/api/v1/auth/login', loginLimiterByIp, loginLimiterByAccount);
app.use('/api/v1/auth/verify-otp', otpLimiter);
app.use('/api/v1/auth/forgot-password', forgotPasswordLimiter);
app.use('/api/v1/auth/reset-password', resetPasswordLimiter);



/**
 * ===== HEALTH CHECK =====
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Book Me Events API is running'
  });
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bookmeevent.netlify.app'; // kept for logging/back-compat


/**
 * ===== SAFE ROUTE LOADER =====

 * Prevents full crash if a route file has an error
 */
const safeRoute = (path, route) => {
  try {
    app.use(path, route);
    console.log(`Loaded route: ${path}`);
  } catch (err) {
    console.error(`Failed to load route ${path}:`, err?.message);
    if (err?.stack) console.error(err.stack);

    // Fail fast for announcements so Vercel doesn't silently return 404.
    if (path === '/api/v1/announcements') {
      throw err;
    }
  }
};

/**
 * ===== ROUTES =====
 */
safeRoute('/api/v1/auth', require('./src/routes/authRoutes'));
safeRoute('/api/v1/users', require('./src/routes/userRoutes'));
safeRoute('/api/v1/vendors', require('./src/routes/vendorRoutes'));
safeRoute('/api/v1/vendors', require('./src/routes/vendorRegisterRoutes'));

safeRoute('/api/v1/services', require('./src/routes/serviceRoutes'));
safeRoute('/api/v1/requests', require('./src/routes/requestRoutes'));
safeRoute('/api/v1/bookings', require('./src/routes/bookingRoutes'));
safeRoute('/api/v1/payments', require('./src/routes/paymentRoutes'));
safeRoute('/api/v1/reviews', require('./src/routes/reviewRoutes'));
safeRoute('/api/v1/messages', require('./src/routes/messageRoutes'));
safeRoute('/api/v1/admin', require('./src/routes/adminRegisterRoutes'));

safeRoute('/api/v1/admin', require('./src/routes/adminRoutes'));

// Dashboard analytics (user/vendor)
safeRoute('/api/v1/dashboard', require('./src/routes/dashboardRoutes'));

// Platform/widget endpoints (match spec URLs)
safeRoute('/api/v1', require('./src/routes/widgetsRoutes'));


safeRoute('/api/v1/announcements', require('./src/routes/announcementRoutes'));


safeRoute('/api/v1/uploads', require('./src/routes/uploadRoutes'));


// USER MVP: activity, announcements read/unread, tickets
safeRoute('/api/v1/users', require('./src/routes/userActivityRoutes'));
safeRoute('/api/v1/announcements', require('./src/routes/announcementReadRoutes'));

// VENDOR MVP: analytics/sla/tickets/promotions
safeRoute('/api/v1/vendors', require('./src/routes/vendorAnalyticsRoutes'));

safeRoute('/api/v1/tickets', require('./src/routes/ticketRoutes'));

// ADMIN MVP: fraud signals
safeRoute('/api/v1/fraud', require('./src/routes/fraudSignalsRoutes'));

// ADMIN MVP: audit log
safeRoute('/api/v1/admin', require('./src/routes/adminAuditRoutes'));


// Admin audit immutable log readers (separate prefix kept for future granularity)
// (No additional routes here)







/**
 * ===== 404 HANDLER (SAFE) =====
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
});


/**
 * ===== ERROR HANDLER =====
 */
app.use(errorHandler);

module.exports = app;