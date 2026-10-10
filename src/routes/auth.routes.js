'use strict';
/**
 * src/routes/auth.routes.js
 * Express router for authentication endpoints.
 */

const express = require('express');
const { signup, login, logout, getMe } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/auth/me', requireAuth, getMe);

module.exports = router;
