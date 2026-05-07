const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    businessName: { type: String, required: true },
    businessRegistrationNumber: { type: String, unique: true, sparse: true },
    taxId: { type: String },
    bankAccountNumber: { type: String },
    bankCode: { type: String },
    businessDescription: { type: String },
    serviceCategories: [{ type: String }],
    coverageAreas: [{ type: String }],
    responseTimeHours: { type: Number, default: 24 },
    isVerified: { type: Boolean, default: false },
    verificationDate: { type: Date },
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    profileCompletionPercentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);
