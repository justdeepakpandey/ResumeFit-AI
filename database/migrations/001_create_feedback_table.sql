-- Migration: 001_create_feedback_table.sql
-- Description: Creates the feedback table to store user and guest feedback.

CREATE TABLE IF NOT EXISTS feedback (
  id            VARCHAR(36)     NOT NULL,             -- UUID v4
  user_id       VARCHAR(36)     DEFAULT NULL,         -- UUID v4 (FK users.id, NULL for guest)
  type          VARCHAR(50)     NOT NULL,             -- 'Bug Report', 'Suggestion', 'General Feedback'
  subject       VARCHAR(255)    DEFAULT NULL,
  message       TEXT            NOT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_feedback_user (user_id),
  INDEX idx_feedback_created (created_at DESC),
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
