const mongoose = require('mongoose');

// Optional future extension. For now, 2FA is stored on User.
// Keeping this placeholder file so future migrations are less disruptive.

module.exports = mongoose.model('TwoFactorSecret', new mongoose.Schema({}, { timestamps: true }));

