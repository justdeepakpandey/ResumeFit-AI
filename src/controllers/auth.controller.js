'use strict';
/**
 * src/controllers/auth.controller.js
 * Handles HTTP requests for signup, login, logout, and current user checking.
 */

const { validateSignupInput, validateLoginInput } = require('../validators/auth.validator');
const { registerUser, loginUser, getUserById } = require('../services/auth.service');
const env = require('../config/env');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * POST /api/auth/signup
 */
async function signup(req, res, next) {
  try {
    const validation = validateSignupInput(req.body || {});
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const { user, token } = await registerUser(req.body);

    res.cookie('auth_token', token, COOKIE_OPTIONS);
    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user,
      token,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    return next(err);
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const validation = validateLoginInput(req.body || {});
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const { user, token } = await loginUser(req.body);

    res.cookie('auth_token', token, COOKIE_OPTIONS);
    return res.json({
      success: true,
      message: 'Logged in successfully.',
      user,
      token,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    return next(err);
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(_req, res) {
  res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax' });
  return res.json({ success: true, message: 'Logged out successfully.' });
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    return res.json({ success: true, user });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  signup,
  login,
  logout,
  getMe,
};
