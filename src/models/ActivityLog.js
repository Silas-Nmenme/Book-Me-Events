const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    actionType: {
      type: String,
      required: true,
      index: true,
    },

    entityType: {
      type: String,
      required: true,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      index: true,
    },

    metadata: {
      type: Object,
      default: {},
    },

    severity: {
      type: String,
      enum: ['INFO', 'WARN', 'ACTION', 'SUCCESS', 'ERROR'],
      default: 'INFO',
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);

