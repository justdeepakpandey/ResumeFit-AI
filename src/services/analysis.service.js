'use strict';
/**
 * src/services/analysis.service.js
 * Orchestrates the full analysis pipeline and database persistence.
 *
 * Pipeline:
 *  1. Extract text from uploaded resume file
 *  2. Call Gemini to analyse resume vs. job description
 *  3. Calculate deterministic score
 *  4. Persist to MySQL (resumefit_analyses table)
 *  5. Clean up temporary upload
 *
 * Returns the full report object.
 */

const crypto = require('crypto');
const fs = require('fs');
const { extractText } = require('./resumeParser.service');
const { analyzeResume } = require('./gemini.service');
const { calculateScore } = require('./matching.service');
const { getPool } = require('../config/db');

/**
 * Run a full analysis and persist it.
 *
 * @param {object} params
 * @param {string} params.filePath        - Absolute path to uploaded file
 * @param {string} params.originalName    - Original filename from client
 * @param {string} params.jobDescription
 * @param {string} [params.jobTitle]
 * @param {string} [params.companyName]
 * @param {string|number|null} [params.userId]
 * @returns {Promise<object>} Full analysis report
 */
async function runAnalysis({
  filePath,
  originalName,
  jobDescription,
  jobTitle = '',
  companyName = '',
  userId = null,
}) {
  let resumeText;

  try {
    // Step 1: Parse resume
    const parsed = await extractText(filePath);
    resumeText = parsed.text;
  } finally {
    // Always clean up temp file, even if parsing fails
    safeDelete(filePath);
  }

  // Step 2: AI analysis
  const analysis = await analyzeResume(resumeText, jobDescription, jobTitle, companyName);

  // Step 3: Deterministic score
  const scores = calculateScore(analysis);

  // Step 4: Persist (only for authenticated users — guest analyses are never saved)
  const id = crypto.randomUUID();
  const now = new Date();
  const parsedUserId = userId ? Number(userId) : null;

  const reportData = {
    id,
    userId: parsedUserId,
    jobTitle: jobTitle || null,
    companyName: companyName || null,
    jobDescription,
    resumeFilename: originalName,
    ...scores,
    analysis,
    createdAt: now,
  };

  if (parsedUserId) {
    await persistReport(reportData);
    const saved = await getAnalysisById(id, parsedUserId);
    return saved || reportData;
  }

  // Guest Mode: Return in-memory report directly without inserting into MySQL
  return reportData;
}

/**
 * Convert JS Date or ISO string to MySQL DATETIME string 'YYYY-MM-DD HH:MM:SS'
 */
function toMySQLDateTime(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function persistReport(report) {
  const pool = getPool();

  if (report.createdAt) {
    const formattedCreatedAt = toMySQLDateTime(report.createdAt);
    const sql = `
      INSERT INTO resumefit_analyses (
        id, user_id, job_title, company_name, job_description, resume_filename,
        match_score, skills_score, experience_score, projects_score,
        required_skills_total, required_skills_matched,
        preferred_skills_total, preferred_skills_matched,
        analysis_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(sql, [
      report.id,
      report.userId || null,
      report.jobTitle,
      report.companyName,
      report.jobDescription,
      report.resumeFilename,
      report.matchScore,
      report.skillsScore,
      report.experienceScore,
      report.projectsScore,
      report.requiredSkillsTotal,
      report.requiredSkillsMatched,
      report.preferredSkillsTotal,
      report.preferredSkillsMatched,
      JSON.stringify(report.analysis),
      formattedCreatedAt,
    ]);
  } else {
    // Omit created_at so MySQL uses DEFAULT CURRENT_TIMESTAMP
    const sql = `
      INSERT INTO resumefit_analyses (
        id, user_id, job_title, company_name, job_description, resume_filename,
        match_score, skills_score, experience_score, projects_score,
        required_skills_total, required_skills_matched,
        preferred_skills_total, preferred_skills_matched,
        analysis_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(sql, [
      report.id,
      report.userId || null,
      report.jobTitle,
      report.companyName,
      report.jobDescription,
      report.resumeFilename,
      report.matchScore,
      report.skillsScore,
      report.experienceScore,
      report.projectsScore,
      report.requiredSkillsTotal,
      report.requiredSkillsMatched,
      report.preferredSkillsTotal,
      report.preferredSkillsMatched,
      JSON.stringify(report.analysis),
    ]);
  }
}

/**
 * Retrieve recent analyses (up to 20).
 * Scoped by userId if provided.
 */
async function getRecentAnalyses(userId = null, limit = 20) {
  // Guest users have no persistent history
  if (!userId) {
    return [];
  }

  const pool = getPool();
  const sql = `SELECT id, user_id, job_title, company_name, resume_filename,
            match_score, skills_score, experience_score, projects_score,
            required_skills_total, required_skills_matched,
            preferred_skills_total, preferred_skills_matched,
            created_at
     FROM resumefit_analyses
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ?`;

  const [rows] = await pool.query(sql, [Number(userId), Math.min(limit, 100)]);
  return rows;
}

/**
 * Retrieve a single analysis by ID, including the full analysis JSON.
 * Scoped strictly by userId to prevent unauthorized access.
 */
async function getAnalysisById(id, userId = null) {
  if (!id || !userId) return null;

  const pool = getPool();
  const sql = `SELECT id, user_id, job_title, company_name, job_description, resume_filename,
            match_score, skills_score, experience_score, projects_score,
            required_skills_total, required_skills_matched,
            preferred_skills_total, preferred_skills_matched,
            analysis_json, created_at
     FROM resumefit_analyses
     WHERE id = ? AND user_id = ?`;
  const params = [id, Number(userId)];

  const [rows] = await pool.query(sql, params);

  if (rows.length === 0) return null;

  const row = rows[0];
  const analysis =
    typeof row.analysis_json === 'string'
      ? JSON.parse(row.analysis_json)
      : row.analysis_json;

  return {
    id: row.id,
    userId: row.user_id,
    jobTitle: row.job_title,
    companyName: row.company_name,
    jobDescription: row.job_description,
    resumeFilename: row.resume_filename,
    matchScore: row.match_score,
    skillsScore: row.skills_score,
    experienceScore: row.experience_score,
    projectsScore: row.projects_score,
    requiredSkillsTotal: row.required_skills_total,
    requiredSkillsMatched: row.required_skills_matched,
    preferredSkillsTotal: row.preferred_skills_total,
    preferredSkillsMatched: row.preferred_skills_matched,
    analysis,
    createdAt: row.created_at,
  };
}

/**
 * Delete an analysis by ID.
 * Returns true if a row was deleted, false if not found.
 */
async function deleteAnalysis(id, userId = null) {
  if (!id || !userId) return false;

  const pool = getPool();
  const sql = 'DELETE FROM resumefit_analyses WHERE id = ? AND user_id = ?';
  const [result] = await pool.query(sql, [id, Number(userId)]);
  return result.affectedRows > 0;
}

function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_e) {
    // Non-fatal – log but continue
    console.warn(`[WARN] Could not delete temp file: ${filePath}`);
  }
}

module.exports = {
  runAnalysis,
  getRecentAnalyses,
  getAnalysisById,
  deleteAnalysis,
};
