const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is missing');
      throw new Error('MongoDB connection failed');
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
    console.error('MongoDB Error:', error.message);
    throw new Error('MongoDB connection failed');
  }
};

module.exports = connectDB;