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

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};