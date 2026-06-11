const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const Request = require('../models/Request');

// MVP derived SLA metrics for vendor.
// Uses Vendor.responseTimeHours as the SLA threshold.
// Approximates breach by comparing request age to threshold for PENDING requests.
exports.getVendorSla = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: missing user id' });
    }

    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) {
      return res.status(403).json({ success: false, message: 'Vendor profile not found' });
    }

    const responseTimeHours = Number(vendor.responseTimeHours || 24);
    const breachCutoffMs = responseTimeHours * 60 * 60 * 1000;
    const now = Date.now();

    // Fetch recent requests for approximation window (last 30 days, max 200)
    const since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const recent = await Request.find({
      vendor: vendor._id,
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const pending = recent.filter((r) => (r.status || '').toString() === 'PENDING');
    const accepted = recent.filter((r) => (r.status || '').toString() === 'ACCEPTED');
    const declined = recent.filter((r) => (r.status || '').toString() === 'DECLINED');
    const cancelled = recent.filter((r) => (r.status || '').toString() === 'CANCELLED');

    // Breach if createdAt older than cutoff while still PENDING.
    const breachedPending = pending.filter((r) => {
      const createdAtMs = new Date(r.createdAt).getTime();
      if (!Number.isFinite(createdAtMs)) return false;
      return createdAtMs + breachCutoffMs < now;
    });

    return res.status(200).json({
      success: true,
      data: {
        responseTimeHours,
        pendingCount: pending.length,
        breachedPendingCount: breachedPending.length,
        breachRate: pending.length ? breachedPending.length / pending.length : 0,
        acceptedCount: accepted.length,
        declinedCount: declined.length,
        cancelledCount: cancelled.length,
      },
    });
  } catch (err) {
    console.error('[vendorSla] getVendorSla failed:', {
      message: err?.message,
      stack: err?.stack,
      userId: req?.user?._id || req?.user?.id,
    });

    return res.status(500).json({ success: false, message: 'Failed to load vendor SLA' });
  }
});

