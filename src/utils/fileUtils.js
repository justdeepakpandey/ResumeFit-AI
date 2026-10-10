'use strict';
/**
 * src/utils/fileUtils.js
 * Shared file utility helpers.
 */

const fs = require('fs');

/**
 * Silently deletes a file. Logs a warning if deletion fails.
 * @param {string} filePath
 */
function safeDeleteFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[WARN] Could not delete file: ${filePath} — ${err.message}`);
  }
}

module.exports = { safeDeleteFile };
