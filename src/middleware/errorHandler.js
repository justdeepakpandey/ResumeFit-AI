'use strict';
/**
 * src/middleware/errorHandler.js
 * Global Express error-handling middleware.
 * Must be the last middleware registered in app.js.
 */

const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Log full error internally
  console.error(`[ERROR] ${req.method} ${req.path}`, {
    message: err.message,
    code: err.code,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Multer-specific errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: `File too large. Maximum size is ${require('../config/env').MAX_FILE_SIZE_MB} MB.`,
    });
  }

  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field. Use the field name "resume".',
    });
  }

  // Validation errors (set status manually)
  const status = err.status || err.statusCode || 500;
  const message =
    status < 500
      ? err.message
      : env.NODE_ENV === 'development'
      ? err.message
      : 'An internal server error occurred. Please try again.';

  return res.status(status).json({
    success: false,
    error: message,
    ...(err.code ? { code: err.code } : {}),
    ...(env.NODE_ENV === 'development' && status >= 500
      ? { stack: err.stack }
      : {}),
  });
}

module.exports = { errorHandler };
