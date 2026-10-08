const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'SERVICE_REQUEST',
        'REQUEST_ACCEPTED',
        'REQUEST_REJECTED',
        'PAYMENT_RECEIVED',
        'PAYMENT_STATUS_CHANGED',
        'NEW_MESSAGE',
        'TICKET_UPDATE',
        'REPORT_SUBMITTED',
        'REPORT_UPDATE',
        'ACCOUNT_WARNING',
        'ACCOUNT_SUSPENSION',
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true, maxlength: 500 },
    entityType: { type: String, trim: true, maxlength: 80 },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
