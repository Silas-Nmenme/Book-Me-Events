const dotenv = require('dotenv');
const connectDB = require('./config/db');
const app = require('./app');

const envPath = process.env.ENV_PATH || './src/.env';
dotenv.config({ path: envPath });

// Connect after env is loaded
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
