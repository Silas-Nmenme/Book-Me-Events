require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { errorHandler } = require('./src/middlewares/errorMiddleware');

const app = express();

/**
 * ===== CORE MIDDLEWARE =====
 */
// CORS is configured in server.js (including FRONTEND_URL). Avoid double/undefined CORS here.
// app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(morgan('dev'));

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
    console.error(`Failed to load route ${path}:`, err.message);
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


safeRoute('/api/v1/uploads', require('./src/routes/uploadRoutes'));


/**
 * ===== 404 HANDLER (SAFE) =====
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
});


// CORS for frontend
app.use(cors({
  origin: ['https://bookmeevent.netlify.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


/**
 * ===== ERROR HANDLER =====
 */
app.use(errorHandler);

module.exports = app;