const mongoose = require('mongoose');

const userReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedRole: { type: String, enum: ['USER', 'VENDOR'], required: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'], default: 'OPEN', index: true },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserReport', userReportSchema);
