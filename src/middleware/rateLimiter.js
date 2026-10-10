'use strict';
/**
 * src/middleware/rateLimiter.js
 * Express-rate-limit configuration.
 * The /api/analyze endpoint is expensive (Gemini API call + parsing),
 * so it gets its own stricter limiter.
 */

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * General API rate limiter – applied to all /api routes.
 */
const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,  // default: 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS * 5, // 5x the analysis limit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});

/**
 * Strict limiter for the /api/analyze endpoint.
 * Calling Gemini repeatedly is expensive and rate-limited upstream.
 */
const analyzeLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,  // default: 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS,    // default: 10 per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    error: `Too many analysis requests. Maximum ${env.RATE_LIMIT_MAX_REQUESTS} analyses per ${env.RATE_LIMIT_WINDOW_MS / 60000} minutes.`,
  },
});

/**
 * Limiter for feedback submissions to prevent spam.
 */
const feedbackLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,  // 15 minutes
  max: 15,                             // 15 feedback submissions per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many feedback submissions. Please try again later.',
  },
});

module.exports = { generalLimiter, analyzeLimiter, feedbackLimiter };

