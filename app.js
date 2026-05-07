const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('./src/middlewares/errorMiddleware');

const authRoutes = require('./src/routes/authRoutes.js');
const userRoutes = require('./src/routes/userRoutes.js');
const vendorRoutes = require('./src/routes/vendorRoutes.js');
const serviceRoutes = require('./src/routes/serviceRoutes.js');
const requestRoutes = require('./src/routes/requestRoutes.js');
const bookingRoutes = require('./src/routes/bookingRoutes.js');
const paymentRoutes = require('./src/routes/paymentRoutes.js');
const reviewRoutes = require('./src/routes/reviewRoutes.js');
const messageRoutes = require('./src/routes/messageRoutes.js');
const adminRoutes = require('./src/routes/adminRoutes.js');

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Book Me Events API is running' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use((req, res, next) => {
  res.status(404);
  const error = new Error(`Not Found - ${req.originalUrl}`);
  next(error);
});

app.use(errorHandler);

module.exports = app;
