const app = require('./app');
const connectDB = require('./src/config/db');

let cachedDb = null;

module.exports = async (req, res) => {
  try {
    // Connect once per cold start
    if (!cachedDb) {
      const conn = await connectDB();

      if (!conn) {
        console.error("DB CONNECTION FAILED");

        return res.status(500).json({
          success: false,
          message: "Database connection failed"
        });
      }

      cachedDb = conn;
    }

    return app(req, res);

  } catch (error) {
    console.error("Vercel Crash:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};