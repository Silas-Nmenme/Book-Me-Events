const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },

    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM',
    },

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

