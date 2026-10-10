'use strict';
/**
 * src/middleware/auth.js
 * Express authentication middleware for protecting routes.
 * Extract JWT from HttpOnly cookie `auth_token` or `Authorization: Bearer <token>` header.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

function extractToken(req) {
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Middleware that enforces authentication.
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to continue.',
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Session expired or invalid token. Please log in again.',
    });
  }
}

/**
 * Middleware that optionally attaches req.user if a valid token is provided.
 */
function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      req.user = decoded;
    } catch {
      // Ignore invalid token in optional auth
    }
  }
  return next();
}

module.exports = { requireAuth, optionalAuth };
