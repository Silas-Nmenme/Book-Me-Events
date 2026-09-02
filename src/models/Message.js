const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    subject: { type: String },
    messageContent: { type: String, required: true },
    attachments: [{ type: String }],
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    conversationId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
