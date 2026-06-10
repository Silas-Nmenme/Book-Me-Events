const asyncHandler = require('express-async-handler');

const ActivityLog = require('../models/ActivityLog');

function sanitizeForPublic(ev) {
  // No PII; return a safe message.
  return {
    type: ev.actionType,
    message: ev.metadata?.publicText || ev.actionType,
    timestamp: ev.occurredAt,
    entityType: ev.entityType,
    entityId: ev.entityId,
  };
}

exports.getActivityFeed = asyncHandler(async (req, res) => {
  const isPublic = req.query.public === 'true';

  const query = isPublic
    ? { }
    : { user: req.user.id };

  const items = await ActivityLog.find(query)
    .sort({ occurredAt: -1 })
    .limit(10)
    .lean();

  const mapped = items.map((ev) => {
    const base = {
      type: ev.actionType,
      message: ev.metadata?.label || ev.actionType,
      timestamp: ev.occurredAt,
    };
    return isPublic ? sanitizeForPublic(base) : base;
  });

  return res.status(200).json({ success: true, data: mapped, message: 'Activity feed fetched' });
});

