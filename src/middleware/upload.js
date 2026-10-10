'use strict';
/**
 * src/middleware/upload.js
 * Multer configuration for resume file uploads.
 * Accepts only PDF and DOCX files up to MAX_FILE_SIZE_MB.
 * Stores uploads in /uploads/ as temporary files.
 * The analysis controller is responsible for deleting the file after use.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    // Sanitise filename; prefix with timestamp to avoid collisions
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 64);
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error('Only PDF and DOCX files are supported.'), {
        code: 'UNSUPPORTED_FILE_TYPE',
        status: 400,
      }),
      false
    );
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

module.exports = { upload, UPLOADS_DIR };
