/**
 * Password Strength Validation Utility
 * Enforces secure password requirements
 */

const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (typeof password !== 'string') {
    errors.push('Password must be a string');
    return { isValid: false, errors };
  }

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
  }

  if (password.length > PASSWORD_RULES.maxLength) {
    errors.push(`Password cannot exceed ${PASSWORD_RULES.maxLength} characters`);
  }

  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_RULES.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_RULES.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)')
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get password rules for frontend display
 */
function getPasswordRules() {
  return {
    minLength: PASSWORD_RULES.minLength,
    maxLength: PASSWORD_RULES.maxLength,
    requireUppercase: PASSWORD_RULES.requireUppercase,
    requireLowercase: PASSWORD_RULES.requireLowercase,
    requireNumbers: PASSWORD_RULES.requireNumbers,
    requireSpecialChars: PASSWORD_RULES.requireSpecialChars,
    example: 'SecurePass123!',
  };
}

module.exports = {
  validatePassword,
  getPasswordRules,
};
