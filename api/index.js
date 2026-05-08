const app = require('./app');
const connectDB = require('./src/config/db');

let connected = false;

module.exports = async (req, res) => {
  try {
    if (!connected) {
      await connectDB();
      connected = true;
    }

    return app(req, res);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};