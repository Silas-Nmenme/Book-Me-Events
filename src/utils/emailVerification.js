const jwt = require('jsonwebtoken');

// Creates a signed verification token (no DB storage).
// Payload is intentionally minimal.
function createEmailVerificationToken({ userId, type = 'email_verify' }) {
  if (!process.env.JWT_SECRET) {
    throw new Error('Server misconfiguration: JWT_SECRET is missing');
  }

  const expiresIn = process.env.JWT_EMAIL_VERIFY_EXPIRE || '1d';

  return jwt.sign(
    { id: userId, type },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

function verifyEmailVerificationToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('Server misconfiguration: JWT_SECRET is missing');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (!decoded?.id || decoded.type !== 'email_verify') {
    throw new Error('Invalid verification token');
  }

  return decoded;
}

module.exports = { createEmailVerificationToken, verifyEmailVerificationToken };

