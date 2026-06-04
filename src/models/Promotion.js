const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },

    serviceCategory: { type: String, trim: true },

    // Either discountPercent OR fixedAmount is used
    discountPercent: { type: Number, min: 0, max: 100 },
    fixedAmount: { type: Number, min: 0 },
    currency: { type: String, default: 'NGN' },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    isActive: { type: Boolean, default: true, index: true },

    // Light audit trail fields
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

promotionSchema.index({ vendor: 1, startDate: -1 });

module.exports = mongoose.model('Promotion', promotionSchema);

