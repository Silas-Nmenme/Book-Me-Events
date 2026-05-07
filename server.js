const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const app = require('./app');

// Load env file (try multiple common locations to avoid silent misconfiguration)
const candidatePaths = [
  process.env.ENV_PATH, // explicit override
  './src/.env',
  './.env',
  './backend/.env',
].filter(Boolean);

let loaded = false;
for (const p of candidatePaths) {
  const res = dotenv.config({ path: p });
  if (res && res.parsed) {
    loaded = true;
    console.log(`ENV loaded from: ${p}`);
    break;
  }
}

// Debug (non-secret) - confirm the critical email vars exist after dotenv load
const emailEnvKeys = ['EMAIL_HOST', 'EMAIL_PORT', 'MAIL_USER', 'EMAIL_PASS'];
const emailEnvMissing = emailEnvKeys.filter((k) => {
  const v = process.env[k];
  return v === undefined || v === null || v === '';
});
if (emailEnvMissing.length) {
  console.warn('Email env missing after dotenv load:', emailEnvMissing);
}


if (!loaded) {
  console.warn('ENV not found. Email and other services may be disabled. Look for .env in src/.env, ./.env, or set ENV_PATH.');
}


// Connect after env is loaded
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});