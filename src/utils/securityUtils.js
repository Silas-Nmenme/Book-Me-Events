/**
 * Security Utilities
 * Common security checks and patterns
 */

const mongoose = require('mongoose');

/**
 * Verify user owns resource or is admin
 * @param {string} userId - User ID from JWT
 * @param {string} resourceOwnerId - ID of resource owner
 * @param {string} userRole - User role
 * @returns {boolean}
 */
function userOwnsResource(userId, resourceOwnerId, userRole = null) {
  const userObjectId = mongoose.Types.ObjectId(String(userId));
  const ownerObjectId = mongoose.Types.ObjectId(String(resourceOwnerId));
  return userObjectId.equals(ownerObjectId) || userRole === 'ADMIN';
}

/**
 * Check if user has required role
 * @param {string} userRole - User's role
 * @param {array|string} requiredRoles - Required role(s)
 * @returns {boolean}
 */
function hasRequiredRole(userRole, requiredRoles) {
  if (typeof requiredRoles === 'string') {
    return userRole === requiredRoles;
  }
  return Array.isArray(requiredRoles) && requiredRoles.includes(userRole);
}

/**
 * Validate MongoDB ID format
 * @param {string} id - ID to validate
 * @returns {boolean}
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

/**
 * Safely parse pagination parameters
 * @param {number} page - Requested page
 * @param {number} limit - Requested limit
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {object} { skip, limit }
 */
function parsePagination(page = 1, limit = 10, maxLimit = 100) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(parseInt(limit, 10) || 10, maxLimit);
  const skip = (parsedPage - 1) * parsedLimit;

  return { skip, limit: parsedLimit, page: parsedPage };
}

/**
 * Throw authorization error with proper status
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (403 for forbidden)
 */
function throwAuthorizationError(res, message = 'Unauthorized access', statusCode = 403) {
  res.status(statusCode);
  throw new Error(message);
}

module.exports = {
  userOwnsResource,
  hasRequiredRole,
  isValidObjectId,
  parsePagination,
  throwAuthorizationError,
};
