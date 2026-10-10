'use strict';
/**
 * src/validators/feedback.validator.js
 * Validates feedback submission inputs.
 */

const VALID_TYPES = ['Bug Report', 'Suggestion', 'General Feedback'];

function normalizeType(type) {
  if (!type || typeof type !== 'string') return null;
  const match = VALID_TYPES.find(t => t.toLowerCase() === type.trim().toLowerCase());
  return match || null;
}

function validateFeedbackInput(body = {}) {
  const errors = [];
  const normalizedType = normalizeType(body.type);

  if (!normalizedType) {
    errors.push('Feedback type must be one of: Bug Report, Suggestion, General Feedback.');
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length < 5) {
    errors.push('Message must be at least 5 characters long.');
  } else if (message.length > 3000) {
    errors.push('Message must not exceed 3000 characters.');
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (subject.length > 255) {
    errors.push('Subject must not exceed 255 characters.');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      type: normalizedType,
      subject: subject || null,
      message,
    },
  };
}

module.exports = {
  validateFeedbackInput,
  VALID_TYPES,
};
