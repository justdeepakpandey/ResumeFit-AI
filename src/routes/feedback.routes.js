'use strict';
/**
 * src/routes/feedback.routes.js
 * Express router for feedback submission endpoint.
 */

const express = require('express');
const { submitFeedback } = require('../controllers/feedback.controller');
const { optionalAuth } = require('../middleware/auth');
const { feedbackLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/feedback
router.post('/feedback', optionalAuth, feedbackLimiter, submitFeedback);

module.exports = router;
