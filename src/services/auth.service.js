'use strict';
/**
 * src/services/auth.service.js
 * User registration, authentication, password hashing, and token generation.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');
const env = require('../config/env');

/**
 * Generate a signed JWT for a user.
 * @param {object} user - { id, name, email }
 * @returns {string} Signed JWT
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Register a new user.
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ user: object, token: string }>}
 */
async function registerUser({ name, email, password }) {
  const pool = getPool();
  const normalizedEmail = email.trim().toLowerCase();

  // Check if email already registered
  const [existing] = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = ?',
    [normalizedEmail]
  );

  if (existing.length > 0) {
    throw Object.assign(new Error('Email address is already registered.'), {
      status: 409,
    });
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
    [id, name.trim(), normalizedEmail, passwordHash]
  );

  const user = { id, name: name.trim(), email: normalizedEmail };
  const token = generateToken(user);

  return { user, token };
}

/**
 * Authenticate an existing user with email and password.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ user: object, token: string }>}
 */
async function loginUser({ email, password }) {
  const pool = getPool();
  const normalizedEmail = email.trim().toLowerCase();

  const [rows] = await pool.query(
    'SELECT id, name, email, password_hash FROM users WHERE LOWER(email) = ?',
    [normalizedEmail]
  );

  if (rows.length === 0) {
    throw Object.assign(new Error('Invalid email or password.'), { status: 401 });
  }

  const userRow = rows[0];
  const isMatch = await bcrypt.compare(password, userRow.password_hash);

  if (!isMatch) {
    throw Object.assign(new Error('Invalid email or password.'), { status: 401 });
  }

  const user = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
  };
  const token = generateToken(user);

  return { user, token };
}

/**
 * Find user by ID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getUserById(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, name, email, created_at FROM users WHERE id = ?',
    [id]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  generateToken,
};
