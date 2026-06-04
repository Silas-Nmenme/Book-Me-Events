const asyncHandler = require('express-async-handler');
const ActivityLog = require('../models/ActivityLog');

// Admin-only: read audit events (append-only writer is ActivityLog model + activityLog util)
exports.getAuditEvents = asyncHandler(async (req, res) => {
  const {
    userId,
    actionType,
    actorId,
    entityType,
    entityId,
    severity,
    page = 1,
    limit = 20,
  } = req.query;

  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (userId) filter.user = userId;
  if (actorId) filter.actor = actorId;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (actionType) filter.actionType = actionType;
  if (severity) filter.severity = severity;

  const [items, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ occurredAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    ActivityLog.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: items.length,
    total,
    pages: Math.ceil(total / safeLimit),
    currentPage: safePage,
    data: items,
  });
});

