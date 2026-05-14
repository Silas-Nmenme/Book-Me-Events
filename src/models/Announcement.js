const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    // USER | VENDOR
    recipientType: {
      type: String,
      required: true,
      enum: ['USER', 'VENDOR'],
    },
  },
  {
    timestamps: true, // createdAt/updatedAt
  }
);

module.exports = mongoose.model('Announcement', AnnouncementSchema);

