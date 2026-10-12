'use strict';
/**
 * src/config/db.js
 * MySQL connection pool using mysql2/promise.
 * Exposes pool.query() and pool.getConnection() for transactional use.
 * Configured with strict TLS/CA certificate verification for Aiven MySQL.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('./env');

let pool = null;

/**
 * Resolves SSL configuration for secure database connection.
 * Strict TLS certificate verification is enforced when SSL is active.
 * Never disables certificate verification (rejectUnauthorized is always true).
 */
function getSslConfig() {
  if (env.DB_SSL === 'false') {
    return undefined;
  }

  let caContent = null;

  if (env.DB_CA_CERT) {
    caContent = env.DB_CA_CERT;
  } else if (env.DB_CA_PATH) {
    const resolvedPath = path.isAbsolute(env.DB_CA_PATH)
      ? env.DB_CA_PATH
      : path.resolve(__dirname, '../../', env.DB_CA_PATH);
    if (fs.existsSync(resolvedPath)) {
      caContent = fs.readFileSync(resolvedPath, 'utf8');
    } else {
      console.warn(`[DB] Warning: CA cert file not found at ${resolvedPath}`);
    }
  } else {
    // Default fallback if certs/aiven-ca.pem exists
    const defaultCaPath = path.resolve(__dirname, '../../certs/aiven-ca.pem');
    if (fs.existsSync(defaultCaPath)) {
      caContent = fs.readFileSync(defaultCaPath, 'utf8');
    }
  }

  if (caContent) {
    return {
      ca: caContent,
      rejectUnauthorized: true,
    };
  }

  // If host is on Aiven cloud or DB_SSL is requested, enforce TLS
  if (env.DB_HOST.includes('aivencloud.com') || env.DB_SSL === 'true') {
    return {
      rejectUnauthorized: true,
    };
  }

  return undefined;
}

/**
 * Returns the shared connection pool, creating it on the first call.
 * Subsequent calls return the cached pool.
 */
function getPool() {
  if (pool) return pool;

  const poolConfig = {
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
  };

  const sslConfig = getSslConfig();
  if (sslConfig) {
    poolConfig.ssl = sslConfig;
  }

  pool = mysql.createPool(poolConfig);
  return pool;
}

/**
 * Checks whether a given table exists in the current database.
 */
async function tableExists(p, tableName) {
  const [rows] = await p.query(
    'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [env.DB_NAME, tableName]
  );
  return rows.length > 0;
}

/**
 * Tests the database connection by executing a lightweight ping query.
 * Returns { ok: true } or { ok: false, error: string }.
 */
async function testConnection() {
  try {
    const p = getPool();
    const [rows] = await p.query('SELECT 1 AS ping');
    if (rows[0] && rows[0].ping === 1) {
      await initSchema();
      return { ok: true };
    }
    return { ok: false, error: 'Unexpected ping result' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Safely and idempotently initializes ResumeFit AI's specific tables.
 *
 * Rules:
 * 1. Never drops, renames, alters, or overwrites existing shared tables (users, applications, contacts, projects).
 * 2. Creates only namespaced tables needed by ResumeFit AI:
 *    - resumefit_analyses
 *    - resumefit_feedback
 * 3. Never runs unsafe ALTER TABLE without verifying table existence first.
 */
async function initSchema() {
  const p = getPool();

  // 1. Verify existing shared users table is accessible
  const hasUsersTable = await tableExists(p, 'users');
  if (!hasUsersTable) {
    // Only created in a clean non-shared environment if missing
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         INT AUTO_INCREMENT NOT NULL,
        name       VARCHAR(100)       NOT NULL,
        email      VARCHAR(255)       NOT NULL,
        password   VARCHAR(255)       NULL,
        provider   VARCHAR(50)        DEFAULT 'local',
        created_at TIMESTAMP          DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        UNIQUE KEY idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  // 2. Ensure resumefit_analyses exists
  await p.query(`
    CREATE TABLE IF NOT EXISTS resumefit_analyses (
      id                       VARCHAR(36)      NOT NULL,
      user_id                  INT              DEFAULT NULL,
      job_title                VARCHAR(255)     DEFAULT NULL,
      company_name             VARCHAR(255)     DEFAULT NULL,
      job_description          MEDIUMTEXT       NOT NULL,
      resume_filename          VARCHAR(255)     NOT NULL,
      match_score              TINYINT UNSIGNED NOT NULL DEFAULT 0,
      skills_score             TINYINT UNSIGNED NOT NULL DEFAULT 0,
      experience_score         TINYINT UNSIGNED NOT NULL DEFAULT 0,
      projects_score           TINYINT UNSIGNED NOT NULL DEFAULT 0,
      required_skills_total    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      required_skills_matched  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      preferred_skills_total   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      preferred_skills_matched SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      analysis_json            JSON             NOT NULL,
      created_at               DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      INDEX idx_resumefit_analyses_user (user_id),
      INDEX idx_resumefit_analyses_created (created_at DESC),
      INDEX idx_resumefit_analyses_score (match_score DESC),
      CONSTRAINT fk_resumefit_analyses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Ensure resumefit_feedback exists
  await p.query(`
    CREATE TABLE IF NOT EXISTS resumefit_feedback (
      id         VARCHAR(36)     NOT NULL,
      user_id    INT             DEFAULT NULL,
      type       VARCHAR(50)     NOT NULL,
      subject    VARCHAR(255)    DEFAULT NULL,
      message    TEXT            NOT NULL,
      created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      INDEX idx_resumefit_feedback_user (user_id),
      INDEX idx_resumefit_feedback_created (created_at DESC),
      CONSTRAINT fk_resumefit_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

module.exports = { getPool, testConnection, initSchema, tableExists };
