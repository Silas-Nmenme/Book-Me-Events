/**
 * Resource ownership and authorization utilities
 * Prevent IDOR and unauthorized access
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

/**
 * Check if user owns a resource
 * @param {string} userId - User ID from token
 * @param {string} resourceUserId - User ID on resource
 * @returns {boolean}
 */
function isResourceOwner(userId, resourceUserId) {
  if (!userId || !resourceUserId) return false;
  const uId = String(userId);
  const rId = String(resourceUserId);
  return uId === rId;
}

/**
 * Check if user has access to resource (owner OR admin)
 * @param {string} userId - User ID from token
 * @param {string} userRole - User role from token
 * @param {string} resourceUserId - User ID on resource
 * @returns {boolean}
 */
function hasResourceAccess(userId, userRole, resourceUserId) {
  if (userRole === 'ADMIN') return true;
  return isResourceOwner(userId, resourceUserId);
}

/**
 * Check if vendor owns a service
 * Looks up vendor from user, then checks service ownership
 * @async
 * @param {string} userId - User ID from token
 * @param {string} serviceVendorId - Vendor ID on service
 * @returns {Promise<boolean>}
 */
async function isServiceOwner(userId, serviceVendorId) {
  if (!userId || !serviceVendorId) return false;
  
  try {
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) return false;
    
    const vId = String(vendor._id);
    const svId = String(serviceVendorId);
    return vId === svId;
  } catch {
    return false;
  }
}

/**
 * Check if vendor has access to booking
 * Vendor can only access bookings for their services
 * @async
 * @param {string} userId - User ID from token
 * @param {object} booking - Booking document
 * @returns {Promise<boolean>}
 */
async function canAccessBooking(userId, booking) {
  if (!booking) return false;
  
  try {
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) return false;
    
    const vId = String(vendor._id);
    const bVendorId = String(booking.vendor);
    return vId === bVendorId;
  } catch {
    return false;
  }
}

/**
 * Throw 403 error with standard message
 */
function throwForbidden(message = 'Access denied') {
  const error = new Error(message);
  error.statusCode = 403;
  throw error;
}

/**
 * Throw 404 error with standard message
 */
function throwNotFound(resource = 'Resource') {
  const error = new Error(`${resource} not found`);
  error.statusCode = 404;
  throw error;
}

/**
 * Middleware: Check resource ownership
 * Requires: req.user set by auth middleware
 * Requires: req.params.id OR custom getter function
 * @param {object} options
 * @param {function} options.getResourceUserId - Function to get user ID from resource
 * @param {string} options.paramName - Param name for resource ID (default: 'id')
 */
function checkOwnership(options = {}) {
  return async (req, res, next) => {
    try {
      const { getResourceUserId, paramName = 'id' } = options;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
      }

      const resourceId = req.params[paramName];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID is required',
        });
      }

      if (req.user.role === 'ADMIN') {
        return next(); // Admins can access everything
      }

      if (!getResourceUserId || typeof getResourceUserId !== 'function') {
        return res.status(500).json({
          success: false,
          message: 'Resource access check not configured',
        });
      }

      const resourceUserId = await getResourceUserId(resourceId);
      if (!resourceUserId) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found',
        });
      }

      if (!isResourceOwner(req.user.id, resourceUserId)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource',
        });
      }

      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed',
      });
    }
  };
}

module.exports = {
  isResourceOwner,
  hasResourceAccess,
  isServiceOwner,
  canAccessBooking,
  throwForbidden,
  throwNotFound,
  checkOwnership,
};
