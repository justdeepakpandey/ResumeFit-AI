-- ResumeFit AI - Database Schema for Shared Aiven MySQL (defaultdb)
--
-- IMPORTANT SAFETY NOTICE:
-- 1. This database is shared with other projects (applications, contacts, projects, users).
-- 2. DO NOT DROP, RENAME, OR ALTER existing tables.
-- 3. ResumeFit AI uses the existing shared `users` table (id INT AUTO_INCREMENT, password VARCHAR).
-- 4. ResumeFit AI creates only namespaced tables: `resumefit_analyses` and `resumefit_feedback`.

USE defaultdb;

-- ============================================================
-- resumefit_analyses table
-- Stores analysis reports associated with authenticated users.
-- Guest reports are never stored here.
-- ============================================================
CREATE TABLE IF NOT EXISTS resumefit_analyses (
  id                       VARCHAR(36)      NOT NULL,
  user_id                  INT              DEFAULT NULL,
  job_title                VARCHAR(255)     DEFAULT NULL,
  company_name             VARCHAR(255)     DEFAULT NULL,
  job_description          MEDIUMTEXT       NOT NULL,
  resume_filename          VARCHAR(255)     NOT NULL,

  -- Scoring (0-100)
  match_score              TINYINT UNSIGNED NOT NULL DEFAULT 0,
  skills_score             TINYINT UNSIGNED NOT NULL DEFAULT 0,
  experience_score         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  projects_score           TINYINT UNSIGNED NOT NULL DEFAULT 0,

  -- Skill counts for transparency
  required_skills_total    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  required_skills_matched  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  preferred_skills_total   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  preferred_skills_matched SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  -- Full structured analysis from Gemini (validated on backend)
  analysis_json            JSON             NOT NULL,

  created_at               DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_resumefit_analyses_user (user_id),
  INDEX idx_resumefit_analyses_created (created_at DESC),
  INDEX idx_resumefit_analyses_score (match_score DESC),
  CONSTRAINT fk_resumefit_analyses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- resumefit_feedback table
-- Stores feedback submissions from authenticated users and guests.
-- ============================================================
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