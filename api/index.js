const app = require('./app');
const connectDB = require('./src/config/db');

let dbReady = false;

module.exports = async (req, res) => {
  try {
    if (!dbReady) {
      const conn = await connectDB();

      if (!conn) {
        return res.status(500).json({
          success: false,
          message: 'Database connection failed'
        });
      }

      dbReady = true;
    }

    return app(req, res); //IMPORTANT CHANGE

  } catch (error) {
    console.error('Vercel Error:', error);
    if (error?.stack) console.error(error.stack);

    return res.status(500).json({
      success: false,
      message: error?.message || 'Internal server error',
      // Helps you see the root cause in dev; remove if you prefer less detail.
      debug: error?.stack,
    });
  }
};