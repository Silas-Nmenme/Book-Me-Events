const connectDB = require('../src/config/db');
const app = require('../app');

let dbPromise;

async function ensureDB() {
  // Connect once per serverless instance
  if (!dbPromise) dbPromise = connectDB();
  return dbPromise;
}

module.exports = async (req, res) => {
  try {
    // Attempt DB connection, but never crash the process.
    await ensureDB();
  } catch (e) {
    // Let the request fail gracefully via Express error handling if desired.
    // For now, return a 500.
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }

  return app(req, res);
};


