const helmet = require('helmet');

const securityHeaders = [
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Allow your frontend to load its own assets.
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "https:"],
        'style-src': ["'self'", "'unsafe-inline'", "https:"],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", "https:", "http://localhost:3000", "http://localhost:5173"],
        'frame-src': ["'self'", 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
  // You can add more header middleware here if needed.
];

module.exports = { securityHeaders };

