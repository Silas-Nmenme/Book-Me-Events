const helmet = require('helmet');

const securityHeaders = [
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Strict: only self, no unsafe-inline to prevent XSS
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", "https:", "https://api.cloudinary.com", "http://localhost:3000", "http://localhost:5173"],
        'frame-src': ["'self'", 'https:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    // HSTS: Enforce HTTPS for 1 year
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // Prevent clickjacking
    frameguard: {
      action: 'deny',
    },
    // XSS protection header
    xssFilter: true,
    // Referrer policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  }),
];

module.exports = { securityHeaders };

