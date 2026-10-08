const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const payoutSchema = new mongoose.Schema(
  {
    payoutId: { type: String, unique: true, default: () => `PAY-${randomUUID()}` },
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'CompletionReport', required: true, unique: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    grossAmount: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, default: null, min: 0 },
    feeAmount: { type: Number, default: null, min: 0 },
    netAmount: { type: Number, default: null, min: 0 },
    netAmountSource: { type: String, enum: ['PENDING_CONFIGURATION', 'MANUAL_ADMIN'], default: 'PENDING_CONFIGURATION' },
    currency: { type: String, required: true, uppercase: true },
    payoutStatus: { type: String, enum: ['ON_HOLD', 'ELIGIBLE', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'], default: 'ON_HOLD', index: true },
    executionMode: { type: String, enum: ['MANUAL'], default: 'MANUAL' },
    idempotencyKey: { type: String, required: true, unique: true, default: () => randomUUID() },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    transferReference: { type: String, trim: true, unique: true, sparse: true },
    transferredAt: { type: Date },
    manualProof: [{
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      resourceType: { type: String, enum: ['image', 'raw'], required: true },
      mimeType: { type: String, required: true },
      originalName: { type: String, required: true, maxlength: 255 },
      size: { type: Number, required: true },
    }],
    attempts: [{
      admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      action: { type: String, enum: ['APPROVED', 'TRANSFER_INITIATED', 'TRANSFER_RECORDED', 'FAILED', 'CANCELLED', 'REOPENED_FOR_RETRY'], required: true },
      reference: { type: String },
      reason: { type: String, trim: true, maxlength: 2000 },
      amount: { type: Number },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

payoutSchema.index({ payoutStatus: 1, createdAt: -1 });
payoutSchema.index({ vendor: 1, createdAt: -1 });

module.exports = mongoose.model('VendorPayout', payoutSchema);
