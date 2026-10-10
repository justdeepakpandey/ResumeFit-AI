'use strict';
/**
 * src/validators/auth.validator.js
 * Input validation routines for Signup and Login requests.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

/**
 * Validate Signup input fields.
 */
function validateSignupInput({ name, email, password, confirmPassword }) {
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long.');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address.');
  }

  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Login input fields.
 */
function validateLoginInput({ email, password }) {
  const errors = [];

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address.');
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateSignupInput,
  validateLoginInput,
};
