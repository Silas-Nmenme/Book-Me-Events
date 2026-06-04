const ActivityLog = require('../models/ActivityLog');

// Best-effort logger: never fail the main request/flow.
exports.logActivity = async ({ userId, actorId, actionType, entityType, entityId, metadata, severity }) => {
  if (!userId || !actionType || !entityType) return;

  try {
    await ActivityLog.create({
      user: userId,
      actor: actorId,
      actionType,
      entityType,
      entityId: entityId || undefined,
      metadata: metadata || {},
      severity: severity || 'INFO',
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('ActivityLog write failed:', e.message);
  }
};

