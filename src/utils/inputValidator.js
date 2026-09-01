/**
 * Comprehensive input validation utilities
 * Centralized validation for common fields
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d+\-\s()]{10,15}$/;
const PASSWORD_MIN_LENGTH = 8;
const BUSINESS_REG_REGEX = /^[A-Z0-9]{5,20}$/;

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate phone format
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone is required' };
  }
  const trimmed = phone.trim();
  if (trimmed.length < 10 || trimmed.length > 15) {
    return { valid: false, error: 'Phone number must be 10-15 characters' };
  }
  if (!PHONE_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid phone format' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate password strength
 * Requirements: min 8 chars, uppercase, lowercase, number, special char
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

/**
 * Validate name (first name, last name)
 */
function validateName(name, fieldName = 'Name') {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: `${fieldName} is required` };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return { valid: false, error: `${fieldName} must be 2-50 characters` };
  }
  if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) {
    return { valid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate business name
 */
function validateBusinessName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Business name is required' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 100) {
    return { valid: false, error: 'Business name must be 3-100 characters' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate business registration number
 */
function validateBusinessRegNumber(regNum) {
  if (!regNum || typeof regNum !== 'string') {
    return { valid: false, error: 'Business registration number is required' };
  }
  const trimmed = regNum.trim().toUpperCase();
  if (!BUSINESS_REG_REGEX.test(trimmed)) {
    return { valid: false, error: 'Business registration number must be 5-20 alphanumeric characters' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate positive number (for amounts, ratings, etc.)
 */
function validatePositiveNumber(value, fieldName = 'Value', max = null) {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: `${fieldName} must be a positive number` };
  }
  if (max !== null && num > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max}` };
  }
  return { valid: true, value: num };
}

/**
 * Validate rating (1-5)
 */
function validateRating(rating) {
  const result = validatePositiveNumber(rating, 'Rating', 5);
  if (!result.valid) return result;
  const num = result.value;
  if (num < 1 || num > 5 || !Number.isInteger(num)) {
    return { valid: false, error: 'Rating must be a whole number between 1 and 5' };
  }
  return { valid: true, value: num };
}

/**
 * Sanitize string input (remove dangerous characters)
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>\"'`]/g, '') // Remove HTML-like chars
    .substring(0, 5000); // Max length
}

/**
 * Sanitize object - recursively sanitize string values
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      result[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = sanitizeObject(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Validate pagination parameters
 */
function validatePagination(page, limit, maxLimit = 100) {
  const p = parseInt(page) || 1;
  const l = Math.min(parseInt(limit) || 10, maxLimit);
  
  if (p < 1) return { page: 1, limit: l };
  if (l < 1) return { page: p, limit: 10 };
  
  return { page: p, limit: l };
}

/**
 * Validate MongoDB ObjectId
 */
function validateMongoId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'ID is required' };
  }
  // Simple check: MongoDB IDs are 24 hex chars
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return { valid: false, error: 'Invalid ID format' };
  }
  return { valid: true, value: id };
}

module.exports = {
  validateEmail,
  validatePhone,
  validatePasswordStrength,
  validateName,
  validateBusinessName,
  validateBusinessRegNumber,
  validatePositiveNumber,
  validateRating,
  sanitizeString,
  sanitizeObject,
  validatePagination,
  validateMongoId,
};
