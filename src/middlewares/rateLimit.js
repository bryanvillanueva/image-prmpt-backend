'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const skipInDev = () => !env.isProduction;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: { error: 'Demasiados intentos de inicio de sesión desde esta IP. Intenta más tarde.' },
});

const loginEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipInDev() || !req.body || typeof req.body.email !== 'string',
  keyGenerator: (req) => `email:${String(req.body.email).trim().toLowerCase()}`,
  message: { error: 'Demasiados intentos de inicio de sesión para esta cuenta. Intenta más tarde.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: { error: 'Demasiados intentos de registro desde esta IP. Intenta más tarde.' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Reduce el ritmo.' },
});

module.exports = { loginLimiter, loginEmailLimiter, registerLimiter, generalLimiter };
