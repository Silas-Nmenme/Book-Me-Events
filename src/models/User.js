const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['USER', 'VENDOR', 'ADMIN', 'admin'], default: 'USER' },

    // Keep compatibility with existing code; admin two-step expects role === 'admin' / 'ADMIN'
    // Frontend/backends should treat both as admin.

    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    profilePicture: { type: String },
    bio: { type: String },
    refreshToken: { type: String },

    // OTP verification (numeric 6-digit, DB-backed)
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
    otpPurpose: { type: String },
    otpVerifiedAt: { type: Date },

    // TOTP 2FA (Admin enforced)
    totpSecret: { type: String, required: true },
    isTotpEnabled: { type: Boolean, default: true },
    tempToken: { type: String, default: null },
    tempTokenExpiry: { type: Date, default: null },
  },

  { timestamps: true }
);


userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
