'use strict';
/**
 * src/routes/analysis.routes.js
 * Mounts all /api routes.
 */

const express = require('express');
const router = express.Router();

const { upload } = require('../middleware/upload');
const { analyzeLimiter } = require('../middleware/rateLimiter');
const { optionalAuth } = require('../middleware/auth');
const {
  analyze,
  listAnalyses,
  getAnalysis,
  removeAnalysis,
} = require('../controllers/analysis.controller');

// ── Analysis endpoints ────────────────────────────────────────────────────────

// Apply optionalAuth so req.user is set when logged in
router.use(optionalAuth);

// POST /api/analyze — upload + analyze
// Rate-limited; multer handles the file upload
router.post(
  '/analyze',
  analyzeLimiter,
  (req, res, next) => {
    // Run multer, then forward its errors into Express error handling
    upload.single('resume')(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },
  analyze
);

// GET /api/analyses — list recent analyses
router.get('/analyses', listAnalyses);

// GET /api/analyses/:id — get single report
router.get('/analyses/:id', getAnalysis);

// DELETE /api/analyses/:id — delete a report
router.delete('/analyses/:id', removeAnalysis);

module.exports = router;
