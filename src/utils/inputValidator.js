/**
 * Comprehensive input validation utilities
 * Centralized validation for common fields
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d+\-\s()]{10,15}$/;
const PASSWORD_MIN_LENGTH = 8;
const BUSINESS_REG_REGEX = /^[A-Z0-9]{5,20}$/;
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
  'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'Abuja', 'Abuja/FCT', 'Rivers', 'Delta', 'Oyo', 'Lagos', 'Ogun'
];

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
function validateVendorBio(bio, maxLength = 1200) {
  if (bio === undefined || bio === null || bio === '') return { valid: true, value: '' };
  const trimmed = sanitizeString(String(bio)).substring(0, maxLength);
  if (trimmed.length < 20) {
    return { valid: false, error: 'Vendor bio must be at least 20 characters.' };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Vendor bio must be ${maxLength} characters or less.` };
  }
  return { valid: true, value: trimmed };
}

function validateVendorUrl(url, fieldName = 'Link') {
  if (url === undefined || url === null || url === '') return { valid: true, value: '' };
  const trimmed = sanitizeString(String(url)).trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { valid: false, error: `${fieldName} must start with http:// or https://` };
  }
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: `${fieldName} must use a valid HTTP/HTTPS URL.` };
    }
  } catch {
    return { valid: false, error: `${fieldName} is not a valid URL.` };
  }
  return { valid: true, value: trimmed };
}

function validateVendorCoverageStates(states, { min = 2, max = 10 } = {}) {
  const arr = Array.isArray(states) ? states : [];
  const normalized = [...new Set(arr.map((state) => sanitizeString(String(state)).trim()).filter(Boolean))];

  if (normalized.length === 0) {
    return { valid: true, value: [] };
  }

  if (normalized.length < min) {
    return { valid: false, error: `Select at least ${min} states you can cover.` };
  }
  if (normalized.length > max) {
    return { valid: false, error: `You can select up to ${max} states.` };
  }

  const invalid = normalized.filter((state) => !NIGERIAN_STATES.map((s) => s.toLowerCase()).includes(String(state).toLowerCase()));
  if (invalid.length > 0) {
    return { valid: false, error: `Invalid state selected: ${invalid[0]}` };
  }

  return { valid: true, value: normalized };
}

function validateVendorLocation(location) {
  if (!location || typeof location !== 'object') {
    return { valid: false, error: 'Current location is required.' };
  }

  const city = sanitizeString(String(location.city || '')).trim();
  const state = sanitizeString(String(location.state || '')).trim();

  if (!city || !state) {
    return { valid: false, error: 'Current location requires both city and state.' };
  }

  if (city.length > 80 || state.length > 80) {
    return { valid: false, error: 'City and state are too long.' };
  }

  return { valid: true, value: { city, state } };
}

function validateVendorReview(review, index = 0) {
  if (!review || typeof review !== 'object') {
    return { valid: false, error: `Review ${index + 1} is invalid.` };
  }
  const reviewerName = sanitizeString(String(review.reviewerName || '')).trim();
  const reviewText = sanitizeString(String(review.reviewText || '')).trim();
  const rating = Number(review.rating);

  if (!reviewerName || reviewerName.length > 120) {
    return { valid: false, error: `Review ${index + 1} requires a valid reviewer name.` };
  }
  if (!reviewText || reviewText.length < 20 || reviewText.length > 800) {
    return { valid: false, error: `Review ${index + 1} must be between 20 and 800 characters.` };
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { valid: false, error: `Review ${index + 1} rating must be between 1 and 5.` };
  }

  return {
    valid: true,
    value: {
      reviewerName,
      reviewText,
      rating: Math.round(rating),
      reviewDate: review.reviewDate ? new Date(review.reviewDate) : undefined,
      image: review.image ? sanitizeString(String(review.image)).trim() : '',
      isVerifiedPlatformReview: Boolean(review.isVerifiedPlatformReview),
    },
  };
}

function validateVendorReviews(reviews) {
  if (!reviews) return { valid: true, value: [] };
  const list = Array.isArray(reviews) ? reviews : [reviews];
  if (list.length > 5) {
    return { valid: false, error: 'Maximum of 5 previous job reviews allowed.' };
  }

  const normalized = [];
  for (let i = 0; i < list.length; i += 1) {
    const result = validateVendorReview(list[i], i);
    if (!result.valid) return result;
    normalized.push(result.value);
  }

  return { valid: true, value: normalized };
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
  validateVendorBio,
  validateVendorUrl,
  validateVendorCoverageStates,
  validateVendorLocation,
  validateVendorReviews,
  NIGERIAN_STATES,
};
