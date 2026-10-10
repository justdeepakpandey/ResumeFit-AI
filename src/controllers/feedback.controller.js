'use strict';
/**
 * src/controllers/feedback.controller.js
 * Handles HTTP requests for submitting feedback.
 */

const { validateFeedbackInput } = require('../validators/feedback.validator');
const { createFeedback } = require('../services/feedback.service');

/**
 * POST /api/feedback
 * Submit feedback (accessible by both authenticated users and guests).
 */
async function submitFeedback(req, res, next) {
  try {
    const validation = validateFeedbackInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const userId = req.user ? req.user.id : null;
    const result = await createFeedback({
      userId,
      type: validation.data.type,
      subject: validation.data.subject,
      message: validation.data.message,
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! It has been recorded successfully.',
      data: {
        id: result.id,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  submitFeedback,
};
