const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];

      if (!process.env.JWT_SECRET) {
        return res.status(500).json({
          success: false,
          message: 'JWT_SECRET not configured'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // decoded.id should be a Mongo ObjectId string; guard to avoid CastError (e.g. accidental "activity")
      if (!decoded?.id || !User.schema.path('id')) {
        // noop; keep structure
      }

      const userId = decoded?.id;
      if (!userId || !User.base?.caster?.path) {
        // fallback validation using mongoose directly
      }

      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        return res.status(401).json({
          success: false,
          message: 'Invalid user token'
        });
      }

      const user = await User.findById(userId).select('-password');


      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const now = new Date();
      if (user.suspendedUntil && user.suspendedUntil <= now && !user.isActive) {
        user.isActive = true;
        user.suspendedUntil = undefined;
        await user.save();
      }

      const supportOrReportPath = ['/api/v1/tickets', '/api/v1/reports', '/api/v1/vendors/tickets']
        .some((path) => req.originalUrl.split('?')[0].startsWith(path));
      if (!user.isActive && !supportOrReportPath) {
        return res.status(403).json({
          success: false,
          message: user.suspendedUntil
            ? `Account temporarily suspended until ${user.suspendedUntil.toISOString()}`
            : 'Account has been suspended',
        });
      }
      if (user.accountRestricted && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !supportOrReportPath) {
        return res.status(403).json({
          success: false,
          message: 'Account actions are restricted. Contact support for assistance.',
        });
      }

      req.user = user;
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });

  } catch (error) {
    console.error('Auth middleware error:', error.message);

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient privileges'
      });
    }

    next();
  };
};

module.exports = { protect, authorize };