const app = require('./app');
const connectDB = require('./src/config/db');

let isConnected = false;

module.exports = async (req, res) => {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
      console.log('MongoDB Connected');
    }

    app.handle(req, res);

  } catch (error) {
    console.error('Vercel Function Error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};