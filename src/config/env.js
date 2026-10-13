'use strict';
/**
 * src/config/env.js
 * Centralised environment variable loader and validator.
 * Called once at startup; throws early if required vars are missing.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(name) {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val.trim();
}

function optionalEnv(name, defaultValue = '') {
  const val = process.env[name];
  return val && val.trim() !== '' ? val.trim() : defaultValue;
}

const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(process.env.PORT || optionalEnv('PORT', '3000'), 10),

  // Database
  DB_HOST: optionalEnv('DB_HOST', 'localhost'),
  DB_PORT: parseInt(optionalEnv('DB_PORT', '3306'), 10),
  DB_USER: optionalEnv('DB_USER', 'root'),
  DB_PASSWORD: optionalEnv('DB_PASSWORD', ''),
  DB_NAME: optionalEnv('DB_NAME', 'resumefit_ai'),
  DB_SSL: optionalEnv('DB_SSL', ''),
  DB_CA_PATH: optionalEnv('DB_CA_PATH', ''),
  DB_CA_CERT: optionalEnv('DB_CA_CERT', ''),

  // Gemini
  GEMINI_API_KEY: optionalEnv('GEMINI_API_KEY', ''),   // validated lazily in gemini service
  GEMINI_MODEL: optionalEnv('GEMINI_MODEL', 'gemini-3.8-flash'),

  // Upload
  MAX_FILE_SIZE_MB: parseInt(optionalEnv('MAX_FILE_SIZE_MB', '5'), 10),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(optionalEnv('RATE_LIMIT_MAX_REQUESTS', '10'), 10),

  // CORS
  ALLOWED_ORIGINS: optionalEnv(
    'ALLOWED_ORIGINS',
    'http://localhost:3000,https://resume-fit-ai-nine.vercel.app'
  )
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  // Auth
  JWT_SECRET: optionalEnv('JWT_SECRET', 'resumefit_ai_jwt_secret_key_2026'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),
};

module.exports = env;
