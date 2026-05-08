const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Env check: MONGO_URI present =', !!process.env.MONGO_URI);

    if (!process.env.MONGO_URI) {
      const msg = 'MONGO_URI is missing (required for MongoDB)';
      console.error(msg);
      // Avoid crashing Vercel serverless functions during cold start.
      return null;
    }

    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return mongoose.connection;
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: process.env.NODE_ENV === 'production' ? 5 : 10,
      socketTimeoutMS: 45000,
    });

    console.log('MongoDB connected');

    return conn;

  } catch (error) {
    console.error('MongoDB Error:', error?.message || error);
    // Avoid crashing Vercel serverless functions; caller will handle null.
    return null;
  }
};

module.exports = connectDB;