-- ResumeFit AI - Database Schema
-- Run this script to initialize the database

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS resume_fit_ai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE resume_fit_ai;

-- ============================================================
-- users table
-- Stores user credentials for authentication.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)     NOT NULL,             -- UUID v4
  name          VARCHAR(255)    NOT NULL,
  email         VARCHAR(255)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- analyses table
-- Stores each resume analysis report associated with a user.
-- ============================================================
CREATE TABLE IF NOT EXISTS analyses (
  id              VARCHAR(36)     NOT NULL,             -- UUID v4
  user_id         VARCHAR(36)     DEFAULT NULL,         -- UUID v4 (FK users.id)
  job_title       VARCHAR(255)    DEFAULT NULL,
  company_name    VARCHAR(255)    DEFAULT NULL,
  job_description MEDIUMTEXT      NOT NULL,
  resume_filename VARCHAR(255)    NOT NULL,

  -- Scoring (0-100)
  match_score         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  skills_score        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  experience_score    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  projects_score      TINYINT UNSIGNED NOT NULL DEFAULT 0,

  -- Skill counts for transparency
  required_skills_total   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  required_skills_matched SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  preferred_skills_total  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  preferred_skills_matched SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  -- Full structured analysis from Gemini (validated on backend)
  analysis_json   JSON            NOT NULL,

  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_match_score (match_score DESC),
  CONSTRAINT fk_analyses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- feedback table
-- Stores feedback submissions from authenticated users and guests.
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id            VARCHAR(36)     NOT NULL,             -- UUID v4
  user_id       VARCHAR(36)     DEFAULT NULL,         -- UUID v4 (FK users.id, NULL for guests)
  type          VARCHAR(50)     NOT NULL,             -- 'Bug Report', 'Suggestion', 'General Feedback'
  subject       VARCHAR(255)    DEFAULT NULL,
  message       TEXT            NOT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_feedback_user (user_id),
  INDEX idx_feedback_created (created_at DESC),
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

