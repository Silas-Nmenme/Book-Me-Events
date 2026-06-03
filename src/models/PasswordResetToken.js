const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Store only the hash of the reset token (never the raw token)
    tokenHash: { type: String, required: true, unique: true, index: true },

    purpose: { type: String, default: 'password_reset', index: true },

    expiresAt: { type: Date, required: true, index: true },

    usedAt: { type: Date, default: null, index: true },

    revokedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// Helpful indexes for fast lookup
passwordResetTokenSchema.index({ userId: 1, usedAt: 1, revokedAt: 1 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);

