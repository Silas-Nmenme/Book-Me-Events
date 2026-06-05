const speakeasy = require('speakeasy');

function normalizeSecret(secret) {
  if (!secret) return '';
  return secret.toString();
}

function buildIssuer(appName) {
  return appName || process.env.APP_NAME || 'Book Me Events';
}

/**
 * Create an otpauth:// URI for a user.
 *
 * NOTE: speakeasy can generate TOTP secrets. It does not directly build an otpauth URI for us.
 * We compose the URI using the standard otpauth format.
 */
function buildOtpAuthUrl({ secret, issuer, accountName }) {
  const s = normalizeSecret(secret);
  const i = encodeURIComponent(issuer);
  const a = encodeURIComponent(accountName);

  // otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&digits=6&period=30&algorithm=SHA1
  return `otpauth://totp/${i}:${a}?secret=${encodeURIComponent(s)}&issuer=${i}&digits=6&period=30`;
}

function generateAdminTotpSecret({ issuer, accountName }) {
  // speakeasy generates a base32 secret by default.
  const secret = speakeasy.generateSecret({
    name: `${accountName}`,
    issuer,
  });

  return {
    base32: secret.base32,
    otpauth_url: secret.otpauth_url,
  };
}

function verifyTotp({ secret, token, window = 1 }) {
  return speakeasy.totp.verify({
    secret: normalizeSecret(secret),
    encoding: 'base32',
    token: token.toString(),
    window,
  });
}

module.exports = {
  buildIssuer,
  buildOtpAuthUrl,
  generateAdminTotpSecret,
  verifyTotp,
};

