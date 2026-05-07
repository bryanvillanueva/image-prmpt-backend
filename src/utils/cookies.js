'use strict';

const env = require('../config/env');
const { COOKIE_NAME } = require('../config/constants');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: SEVEN_DAYS_MS,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

module.exports = { setAuthCookie, clearAuthCookie };
