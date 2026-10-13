'use strict';
/**
 * src/app.js
 * Express application factory.
 * Separated from server.js so it can be required in tests without binding a port.
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const env = require('./config/env');
const { testConnection } = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const analysisRoutes = require('./routes/analysis.routes');
const authRoutes = require('./routes/auth.routes');
const feedbackRoutes = require('./routes/feedback.routes');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = new Set(
  env.ALLOWED_ORIGINS.map((origin) => origin.trim().replace(/\/+$/, '').toLowerCase())
);

if (process.env.FRONTEND_URL) {
  allowedOrigins.add(process.env.FRONTEND_URL.trim().replace(/\/+$/, '').toLowerCase());
}
if (process.env.VERCEL_URL) {
  const vUrl = process.env.VERCEL_URL.trim().replace(/\/+$/, '').toLowerCase();
  allowedOrigins.add(vUrl.startsWith('http') ? vUrl : `https://${vUrl}`);
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '').toLowerCase();

  // Check exact configured origins (production Vercel origin, localhost, etc.)
  if (allowedOrigins.has(normalized)) return true;

  // Allow Vercel preview and production deployment subdomains (*.vercel.app)
  if (/^https:\/\/[a-z0-9-]+(\.vercel\.app)$/i.test(normalized)) return true;

  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      const err = new Error(`CORS: origin "${origin}" is not allowed.`);
      err.status = 403;
      callback(err);
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  })
);

// ── Body & Cookie parsers ──────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── General rate limiting ─────────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ── Health endpoint ───────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const db = await testConnection();
  const status = db.ok ? 'ok' : 'degraded';
  res.status(db.ok ? 200 : 503).json({
    status,
    app: 'ResumeFit AI',
    version: '1.0.0',
    environment: env.NODE_ENV,
    database: db.ok ? 'connected' : `disconnected — ${db.error}`,
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', analysisRoutes);
app.use('/api', feedbackRoutes);

// ── 404 for unknown API routes (before static, so we don't serve index.html) ──
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found.' });
});

// ── Static frontend ───────────────────────────────────────────────────────────
const PUBLIC_DIR = path.resolve(__dirname, '../public');
app.use(express.static(PUBLIC_DIR));

// SPA fallback — serve index.html for any non-API route
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
