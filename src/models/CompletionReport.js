const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'video'], required: true },
  mimeType: { type: String, required: true },
  originalName: { type: String, required: true, maxlength: 255 },
  size: { type: Number, required: true },
  caption: { type: String, trim: true, maxlength: 300 },
  uploadedAt: { type: Date, default: Date.now },
});

const completionReportSchema = new mongoose.Schema(
  {
    reportId: { type: String, unique: true, default: () => `SCR-${randomUUID()}` },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true, unique: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceSummary: { type: String, trim: true, required: function requiredOnSubmit() { return this.status !== 'DRAFT'; }, maxlength: 10000 },
    completionDate: { type: Date, required: function requiredOnSubmit() { return this.status !== 'DRAFT'; } },
    additionalNotes: { type: String, trim: true, maxlength: 5000 },
    images: { type: [mediaSchema], default: [] },
    videos: { type: [mediaSchema], default: [] },
    status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'DISPUTED', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'DRAFT', index: true },
    submittedAt: { type: Date },
    satisfactionStatus: { type: String, enum: ['PENDING', 'SATISFIED', 'NOT_SATISFIED'], default: 'PENDING', index: true },
    satisfactionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    satisfactionAt: { type: Date },
    clientFeedback: {
      reason: { type: String, enum: ['SERVICE_NOT_COMPLETED', 'POOR_QUALITY', 'INCOMPLETE_DELIVERABLES', 'DIFFERED_FROM_AGREEMENT', 'REQUIREMENTS_NOT_MET', 'LATE_DELIVERY', 'MISREPRESENTATION', 'OTHER'] },
      explanation: { type: String, trim: true, maxlength: 10000 },
      differedFromAgreement: { type: Boolean },
      missingDeliverables: { type: Boolean },
      evidence: { type: [mediaSchema], default: [] },
      submittedAt: { type: Date },
    },
    adminReviewStatus: { type: String, enum: ['PENDING_REVIEW', 'MORE_INFO_REQUESTED', 'UNDER_INVESTIGATION', 'APPROVED', 'REJECTED', 'DISPUTE_RESOLVED'], default: 'PENDING_REVIEW', index: true },
    disputeResolution: {
      outcome: { type: String, enum: ['APPROVE_PAYOUT', 'REJECT_PAYOUT'] },
      reason: { type: String, trim: true, maxlength: 5000 },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      resolvedAt: { type: Date },
    },
    reviewHistory: [{
      admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      action: { type: String, enum: ['APPROVE', 'REQUEST_VENDOR_INFO', 'REQUEST_CLIENT_CLARIFICATION', 'REJECT', 'INVESTIGATE', 'ESCALATE', 'RESOLVE_DISPUTE', 'HOLD'], required: true },
      reason: { type: String, trim: true, maxlength: 5000 },
      details: { type: mongoose.Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now },
    }],
    infoRequestedFrom: { type: String, enum: ['USER', 'VENDOR'] },
    additionalResponses: [{
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      authorRole: { type: String, enum: ['USER', 'VENDOR'], required: true },
      message: { type: String, required: true, trim: true, maxlength: 5000 },
      createdAt: { type: Date, default: Date.now },
    }],
    payoutStatus: { type: String, enum: ['ON_HOLD', 'ELIGIBLE', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'], default: 'ON_HOLD', index: true },
  },
  { timestamps: true }
);

completionReportSchema.index({ status: 1, adminReviewStatus: 1, createdAt: -1 });
completionReportSchema.index({ vendor: 1, createdAt: -1 });
completionReportSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CompletionReport', completionReportSchema);
