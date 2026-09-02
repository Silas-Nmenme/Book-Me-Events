/**
 * Environment variable validation and configuration
 * Ensures all required secrets are set and validates them at startup
 */

/**
 * Validate and load environment variables
 * Throws error if critical vars missing
 */
function validateEnvironment() {
  const required = [
    'MONGO_URI',
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'MAIL_USER',
    'EMAIL_PASS',
    'FRONTEND_URL',
  ];

  const optional = [
    'FLW_SECRET_KEY',
    'FLW_WEBHOOK_SECRET',
    'FLW_PUBLIC_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLIC_KEY',
    'PORT',
    'NODE_ENV',
  ];

  const missing = [];
  const warnings = [];

  // Check required variables
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check optional with warnings
  for (const key of optional) {
    if (!process.env[key] && key !== 'PORT' && key !== 'NODE_ENV') {
      warnings.push(`Optional: ${key} not configured`);
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    const message = 'JWT_SECRET is weak (less than 32 chars). Use a longer, random string.';
    if (process.env.NODE_ENV === 'production') {
      missing.push('JWT_SECRET (must be at least 32 characters in production)');
    } else {
      warnings.push(message);
    }
  }

  // Validate test keys usage in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.FLW_SECRET_KEY?.includes('TEST')) {
      warnings.push('WARNING: Using Flutterwave TEST keys in production');
    }
    if (process.env.STRIPE_SECRET_KEY?.includes('test')) {
      warnings.push('WARNING: Using Stripe test keys in production');
    }
  }

  // Report missing vars (fatal)
  if (missing.length > 0) {
    console.error('\nCRITICAL: Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these variables in .env file\n');
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  // Report warnings (non-fatal)
  if (warnings.length > 0) {
    console.warn('\nEnvironment warnings:');
    warnings.forEach(msg => console.warn(`   - ${msg}`));
    console.warn('\n');
  }

  console.log('Environment variables validated successfully\n');
}

/**
 * Get safe environment config
 * Returns only non-sensitive values (no secrets)
 */
function getSafeConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 5000,
    frontendUrl: process.env.FRONTEND_URL,
    mongoUri: process.env.MONGO_URI ? 'mongodb://***' : undefined,
    cloudinaryCloud: process.env.CLOUDINARY_CLOUD_NAME,
    emailHost: process.env.EMAIL_HOST,
    emailPort: process.env.EMAIL_PORT,
  };
}

/**
 * Check if running in production
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
function isDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

module.exports = {
  validateEnvironment,
  getSafeConfig,
  isProduction,
  isDevelopment,
};
