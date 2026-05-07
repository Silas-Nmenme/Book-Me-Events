const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    serviceName: { type: String, required: true },
    serviceCategory: { type: String, required: true },
    description: { type: String, required: true },
    basePrice: { type: Number, required: true },
    priceCurrency: { type: String, default: 'NGN' },
    images: [{ type: String }],
    availabilityStatus: { type: String, enum: ['AVAILABLE', 'UNAVAILABLE'], default: 'AVAILABLE' },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
