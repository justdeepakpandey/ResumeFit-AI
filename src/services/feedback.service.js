'use strict';
/**
 * src/services/feedback.service.js
 * Handles persistence of user and guest feedback.
 */

const crypto = require('crypto');
const { getPool } = require('../config/db');

/**
 * Save a feedback submission to the database.
 * @param {object} params
 * @param {string|number|null} params.userId
 * @param {string} params.type
 * @param {string|null} params.subject
 * @param {string} params.message
 * @returns {Promise<{ id: string, type: string, createdAt: Date }>}
 */
async function createFeedback({ userId = null, type, subject = null, message }) {
  const pool = getPool();
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO resumefit_feedback (id, user_id, type, subject, message)
    VALUES (?, ?, ?, ?, ?)
  `;

  await pool.query(sql, [id, userId ? Number(userId) : null, type, subject || null, message]);

  return {
    id,
    type,
    createdAt: new Date(),
  };
}

module.exports = {
  createFeedback,
};
