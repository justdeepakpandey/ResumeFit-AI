'use strict';
/**
 * src/server.js
 * HTTP server entry point.
 * Loads env, starts Express, and logs startup status.
 */

const env = require('./config/env');
const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : (env.PORT || 3000);

async function start() {
  // Test DB at startup (non-fatal — app works without DB for health checks)
  const db = await testConnection();
  if (db.ok) {
    console.log('[DB] Connected to MySQL successfully.');
  } else {
    console.warn(`[DB] Warning: Could not connect to MySQL — ${db.error}`);
    console.warn('[DB] The application will start but analysis history will not be available.');
    console.warn('[DB] Ensure MySQL is running and your .env credentials are correct.');
  }

  app.listen(PORT, () => {
    console.log(`\n🚀  ResumeFit AI is running`);
    console.log(`    URL:         http://localhost:${PORT}`);
    console.log(`    Health:      http://localhost:${PORT}/api/health`);
    console.log(`    Environment: ${env.NODE_ENV}`);
    console.log(`    DB:          ${db.ok ? '✓ Connected' : '✗ Not connected'}\n`);
  });
}

start().catch((err) => {
  console.error('[FATAL] Failed to start server:', err.message);
  process.exit(1);
});
