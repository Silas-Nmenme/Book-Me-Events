require('dotenv').config();

const app = require('../app.js');
const connectDB = require('../src/config/db');

let dbReady = false;

// Explicit CORS/preflight handling for serverless.
// This ensures Access-Control-Allow-Origin is present for OPTIONS requests,
// and helps browsers complete CORS handshakes reliably on Vercel.
function setCorsHeaders(req, res) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://bookmeevent.netlify.app';
  const allowedOrigins = [frontendUrl, 'https://bookmeevent.netlify.app'];

  const origin = req.headers.origin;
  const isAllowed = origin && allowedOrigins.includes(origin);

  res.setHeader(
    'Access-Control-Allow-Origin',
    isAllowed ? origin : frontendUrl
  );
  res.setHeader('Vary', 'Origin');

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
}

module.exports = async (req, res) => {
  try {
    // Handle CORS preflight before any other work.
    if (req.method === 'OPTIONS') {
      setCorsHeaders(req, res);
      return res.status(204).end();
    }

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

    // Run Express app (which also has CORS middleware).
    // Extra safety: ensure headers exist even if CORS middleware is bypassed.
    setCorsHeaders(req, res);

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
