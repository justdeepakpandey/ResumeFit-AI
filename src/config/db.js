'use strict';
/**
 * src/config/db.js
 * MySQL connection pool using mysql2/promise.
 * Exposes pool.query() and pool.getConnection() for transactional use.
 */

const mysql = require('mysql2/promise');
const env = require('./env');

let pool = null;

/**
 * Returns the shared connection pool, creating it on the first call.
 * Subsequent calls return the cached pool.
 */
function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // Return JS Date objects for DATETIME columns
    dateStrings: false,
    // Strict mode for safer SQL
    multipleStatements: false,
  });

  return pool;
}

/**
 * Tests the database connection by executing a lightweight ping query.
 * Returns { ok: true } or { ok: false, error: string }.
 */
async function testConnection() {
  try {
    const p = getPool();
    const [rows] = await p.query('SELECT 1 AS ping');
    if (rows[0].ping === 1) {
      await initSchema();
      return { ok: true };
    }
    return { ok: false, error: 'Unexpected ping result' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Automatically applies safe, idempotent schema updates (creating users table
 * and adding user_id column to analyses table if missing) without deleting existing data.
 */
async function initSchema() {
  const p = getPool();

  // 1. Ensure users table exists
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            VARCHAR(36)     NOT NULL,
      name          VARCHAR(255)    NOT NULL,
      email         VARCHAR(255)    NOT NULL,
      password_hash VARCHAR(255)    NOT NULL,
      created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      UNIQUE KEY idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Ensure user_id column exists in analyses table
  const [cols] = await p.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'analyses' AND COLUMN_NAME = 'user_id'
  `, [env.DB_NAME]);

  if (cols.length === 0) {
    await p.query(`
      ALTER TABLE analyses
      ADD COLUMN user_id VARCHAR(36) DEFAULT NULL AFTER id,
      ADD INDEX idx_user_id (user_id)
    `);
  }
}

module.exports = { getPool, testConnection, initSchema };
