/**
 * Input Validation Middleware & Utilities
 * Centralized validation logic for common endpoints
 */

const { body, param, query, validationResult } = require('express-validator');
const { validatePassword } = require('./passwordValidator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Password validator (for use in chains)
 */
const validatePasswordField = () => {
  return body('password')
    .notEmpty().withMessage('Password is required')
    .isString().withMessage('Password must be a string')
    .custom((value) => {
      const { isValid, errors } = validatePassword(value);
      if (!isValid) {
        throw new Error(errors[0]);
      }
      return true;
    });
};

/**
 * Password confirmation validator
 */
const validatePasswordConfirmation = () => {
  return [
    body('passwordConfirm')
      .notEmpty().withMessage('Password confirmation is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ];
};

/**
 * Email validator
 */
const validateEmail = (fieldName = 'email') => {
  return body(fieldName)
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
    .toLowerCase();
};

/**
 * Phone validator (basic)
 */
const validatePhone = (fieldName = 'phone') => {
  return body(fieldName)
    .notEmpty().withMessage('Phone number is required')
    .isMobilePhone().withMessage('Invalid phone number format');
};

/**
 * MongoDB ObjectId validator
 */
const validateMongoId = (paramName = 'id') => {
  return param(paramName)
    .isMongoId().withMessage(`${paramName} must be a valid ID`);
};

/**
 * Pagination validator
 */
const validatePagination = () => {
  return [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be at least 1'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ];
};

/**
 * Common auth validators
 */
const authValidationChain = {
  register: () => [
    validateEmail('email'),
    body('firstName')
      .notEmpty().withMessage('First name is required')
      .isString().withMessage('First name must be a string')
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
    body('lastName')
      .notEmpty().withMessage('Last name is required')
      .isString().withMessage('Last name must be a string')
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
    validatePhone('phone'),
    validatePasswordField(),
    validatePasswordConfirmation(),
  ],

  login: () => [
    validateEmail('email'),
    body('password')
      .notEmpty().withMessage('Password is required'),
  ],

  resetPassword: () => [
    validatePasswordField(),
    validatePasswordConfirmation(),
  ],
};

module.exports = {
  handleValidationErrors,
  validatePasswordField,
  validatePasswordConfirmation,
  validateEmail,
  validatePhone,
  validateMongoId,
  validatePagination,
  authValidationChain,
};
