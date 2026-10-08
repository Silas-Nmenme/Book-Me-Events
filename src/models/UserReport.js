const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const userReportSchema = new mongoose.Schema(
  {
    reportId: { type: String, unique: true, default: () => `RPT-${randomUUID()}` },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedRole: { type: String, enum: ['USER', 'VENDOR'], required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    reason: {
      type: String,
      enum: ['FRAUD_SCAM', 'POOR_SERVICE', 'MISREPRESENTATION', 'HARASSMENT', 'NO_SHOW', 'PAYMENT_ISSUE', 'FAKE_PROFILE', 'INAPPROPRIATE_BEHAVIOR', 'ABUSE', 'OTHER'],
      required: true,
    },
    otherReason: { type: String, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    evidence: [{
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      resourceType: { type: String, enum: ['image', 'raw'], required: true },
      mimeType: { type: String, required: true },
      originalName: { type: String, required: true, maxlength: 255 },
      size: { type: Number, required: true },
    }],
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM', index: true },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'UNDER_INVESTIGATION', 'RESOLVED', 'REJECTED', 'ESCALATED', 'OPEN', 'IN_REVIEW', 'DISMISSED'],
      default: 'PENDING_REVIEW',
      index: true,
    },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
    internalNotes: [{
      admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      note: { type: String, required: true, trim: true, maxlength: 2000 },
      createdAt: { type: Date, default: Date.now },
    }],
    moderationActions: [{
      admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      action: { type: String, enum: ['WARNING', 'TEMPORARY_SUSPENSION', 'PERMANENT_SUSPENSION', 'RESTRICTION', 'RESTORE_ACCOUNT'], required: true },
      details: { type: String, trim: true, maxlength: 1000 },
      until: { type: Date },
      createdAt: { type: Date, default: Date.now },
    }],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserReport', userReportSchema);
