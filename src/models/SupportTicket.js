const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true,
    },

    creatorRole: { type: String, enum: ['USER', 'VENDOR', 'ADMIN'], default: 'USER' },

    category: {
      type: String,
      enum: ['GENERAL', 'ACCOUNT', 'BOOKING', 'PAYMENT', 'SERVICE', 'TECHNICAL', 'OTHER'],
      default: 'GENERAL',
      index: true,
    },

    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: false,
      index: true,
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: false,
      index: true,
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },

    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },

    attachments: [{
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      resourceType: { type: String, enum: ['image', 'raw'], required: true },
      mimeType: { type: String, required: true },
      originalName: { type: String, required: true, maxlength: 255 },
      size: { type: Number, required: true },
    }],

    updates: [{
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      authorRole: { type: String, enum: ['USER', 'VENDOR', 'ADMIN'], required: true },
      message: { type: String, required: true, trim: true, maxlength: 5000 },
      attachments: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        resourceType: { type: String, enum: ['image', 'raw'], required: true },
        mimeType: { type: String, required: true },
        originalName: { type: String, required: true, maxlength: 255 },
        size: { type: Number, required: true },
      }],
      status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED', 'CLOSED'] },
      createdAt: { type: Date, default: Date.now },
    }],

    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    adminNotes: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportTicket', supportTicketSchema);

