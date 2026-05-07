'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { COOKIE_NAME, USER_STATUS } = require('../config/constants');
const { query } = require('../config/database');
const { Unauthorized } = require('../utils/httpErrors');

function readToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function loadUser(userId) {
  const rows = await query(
    `SELECT u.id, u.role_id, u.name, u.username, u.email, u.avatar_url, u.bio,
            u.status, u.email_verified, u.upload_limit_per_day, u.trust_level,
            u.created_at, u.updated_at, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function requireAuth(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) return next(Unauthorized('Token de autenticación faltante'));

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (_) {
      return next(Unauthorized('Token de autenticación inválido o expirado'));
    }

    const user = await loadUser(payload.sub);
    if (!user) return next(Unauthorized('Usuario no encontrado'));
    if (user.status !== USER_STATUS.ACTIVE) {
      return next(Unauthorized('La cuenta no está activa'));
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function optionalAuth(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) return next();
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      const user = await loadUser(payload.sub);
      if (user && user.status === USER_STATUS.ACTIVE) req.user = user;
    } catch (_) {
      /* ignore — anon */
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth, optionalAuth };
