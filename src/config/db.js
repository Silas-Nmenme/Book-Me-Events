const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;

    if (!uri || typeof uri !== 'string') {
      throw new Error(
        'Missing or invalid MONGO_URI. Set MONGO_URI in your environment (e.g., .env) as a string.'
      );
    }

    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    // In serverless environments (like Vercel), do NOT terminate the process.
    // Return/throw so the request can fail gracefully and Vercel can report it.
    throw error;

  }
};

module.exports = connectDB;
