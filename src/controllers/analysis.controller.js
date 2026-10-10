'use strict';
/**
 * src/controllers/analysis.controller.js
 * Handles HTTP request/response for all analysis endpoints.
 */

const { validateAnalyzeInput } = require('../validators/analysis.validator');
const {
  runAnalysis,
  getRecentAnalyses,
  getAnalysisById,
  deleteAnalysis,
} = require('../services/analysis.service');
const { safeDeleteFile } = require('../utils/fileUtils');

/**
 * POST /api/analyze
 * Upload a resume and run AI analysis against a job description.
 */
async function analyze(req, res, next) {
  // If multer threw, req.file is undefined; the error was already forwarded
  const validation = validateAnalyzeInput(req.body, req.file);
  if (!validation.valid) {
    // Clean up the temp file if it was uploaded
    if (req.file) safeDeleteFile(req.file.path);
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  try {
    const userId = req.user ? req.user.id : null;
    const report = await runAnalysis({
      filePath: req.file.path,
      originalName: req.file.originalname,
      jobDescription: req.body.jobDescription.trim(),
      jobTitle: (req.body.jobTitle || '').trim(),
      companyName: (req.body.companyName || '').trim(),
      userId,
    });

    return res.status(201).json({ success: true, data: report });
  } catch (err) {
    // runAnalysis cleans up the temp file internally
    return next(err);
  }
}

/**
 * GET /api/analyses
 * Returns the 20 most recent analyses for the authenticated user.
 */
async function listAnalyses(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const userId = req.user ? req.user.id : null;
    const analyses = await getRecentAnalyses(userId, limit);
    return res.json({ success: true, data: analyses });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/analyses/:id
 * Returns a single full analysis report if owned by the authenticated user.
 */
async function getAnalysis(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const report = await getAnalysisById(req.params.id, userId);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Analysis not found.' });
    }
    return res.json({ success: true, data: report });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/analyses/:id
 * Deletes a specific analysis report owned by the authenticated user.
 */
async function removeAnalysis(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const deleted = await deleteAnalysis(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Analysis not found.' });
    }
    return res.json({ success: true, message: 'Analysis deleted.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { analyze, listAnalyses, getAnalysis, removeAnalysis };
