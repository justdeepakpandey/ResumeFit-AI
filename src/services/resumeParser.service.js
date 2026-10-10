'use strict';
/**
 * src/services/resumeParser.service.js
 * Extracts plain text from PDF and DOCX resume files.
 *
 * Supports:
 *  - PDF  → pdf-parse
 *  - DOCX → mammoth
 *
 * Returns { text: string, pageCount?: number }
 * Throws a descriptive Error on failure.
 */

const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const MIN_TEXT_LENGTH = 30; // characters; below this we treat as empty

/**
 * Extracts text from a resume file.
 * @param {string} filePath - Absolute path to the uploaded file.
 * @returns {Promise<{ text: string, pageCount?: number }>}
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error('Uploaded file not found.'), { status: 400 });
  }

  const buffer = fs.readFileSync(filePath);

  if (buffer.length === 0) {
    throw Object.assign(new Error('The uploaded file is empty.'), { status: 400 });
  }

  let result;

  if (ext === '.pdf') {
    result = await parsePdf(buffer);
  } else if (ext === '.docx') {
    result = await parseDocx(buffer);
  } else {
    throw Object.assign(
      new Error('Unsupported file type. Only PDF and DOCX are supported.'),
      { status: 400 }
    );
  }

  const cleaned = cleanText(result.text);

  if (cleaned.length < MIN_TEXT_LENGTH) {
    throw Object.assign(
      new Error(
        'Could not extract meaningful text from the resume. ' +
          'The file may be scanned/image-based or password protected.'
      ),
      { status: 422 }
    );
  }

  return { text: cleaned, pageCount: result.pageCount };
}

async function parsePdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    return { text: data.text || '', pageCount: data.numpages };
  } catch (err) {
    // Fallback for hand-crafted test PDFs or legacy files with non-standard XRef tables
    const raw = buffer.toString('binary');
    const textMatches = [];
    const regex = /\(([^)]+)\)\s*Tj/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      if (match[1] && match[1].trim()) {
        textMatches.push(match[1].replace(/\\([()\\])/g, '$1'));
      }
    }

    if (textMatches.length > 0) {
      const fallbackText = textMatches.join(' ');
      if (fallbackText.length >= MIN_TEXT_LENGTH) {
        return { text: fallbackText, pageCount: 1 };
      }
    }

    throw Object.assign(
      new Error(`Failed to parse PDF: ${err.message}`),
      { status: 422 }
    );
  }
}

async function parseDocx(buffer) {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: value || '' };
  } catch (err) {
    throw Object.assign(
      new Error(`Failed to parse DOCX: ${err.message}`),
      { status: 422 }
    );
  }
}

/**
 * Normalises whitespace and removes non-printable characters.
 */
function cleanText(raw) {
  return raw
    .replace(/[\r\n]+/g, '\n')       // normalise line endings
    .replace(/[^\S\n]+/g, ' ')       // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')      // max two consecutive blank lines
    .replace(/[^\x20-\x7E\n\t]/g, ' ') // strip non-ASCII control chars (keep printable)
    .trim();
}

module.exports = { extractText };
