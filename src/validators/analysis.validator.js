'use strict';
/**
 * src/validators/analysis.validator.js
 * Input validation for the /api/analyze endpoint.
 * Returns { valid: boolean, errors: string[] }.
 */

const MIN_JD_LENGTH = 50;
const MAX_JD_LENGTH = 30000;
const MAX_TITLE_LENGTH = 255;
const MAX_COMPANY_LENGTH = 255;

/**
 * Validates the body fields for the analyze endpoint.
 * @param {object} body  - req.body
 * @param {object|null} file  - req.file (multer)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAnalyzeInput(body, file) {
  const errors = [];

  // Resume file
  if (!file) {
    errors.push('A resume file (PDF or DOCX) is required.');
  }

  // Job description
  const jd = (body.jobDescription || '').trim();
  if (!jd) {
    errors.push('Job description is required.');
  } else if (jd.length < MIN_JD_LENGTH) {
    errors.push(`Job description must be at least ${MIN_JD_LENGTH} characters.`);
  } else if (jd.length > MAX_JD_LENGTH) {
    errors.push(`Job description must not exceed ${MAX_JD_LENGTH} characters.`);
  }

  // Optional fields – just length guard
  const title = (body.jobTitle || '').trim();
  if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`Job title must not exceed ${MAX_TITLE_LENGTH} characters.`);
  }

  const company = (body.companyName || '').trim();
  if (company.length > MAX_COMPANY_LENGTH) {
    errors.push(`Company name must not exceed ${MAX_COMPANY_LENGTH} characters.`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateAnalyzeInput };
