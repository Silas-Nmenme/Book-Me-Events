const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

/**
 * MongoDB Connection with Retry Logic
 * Vercel/serverless compatible (graceful fallback)
 */
const connectDB = async (retries = 3) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: Number(process.env.NODE_ENV === 'production' ? 5 : 10),
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB connected`);
    return conn;
  } catch (error) {
    console.error('MongoDB Error:', error.message);
    
    if (retries > 0) {
      console.log(`🔄 Retrying DB connection... (${retries} left)`);
      await new Promise(r => setTimeout(r, 2000));
      return connectDB(retries - 1);
    }
    
    console.error('DB connection failed permanently');
    return null; // Continue without DB for serverless
  }
};

module.exports = connectDB;

