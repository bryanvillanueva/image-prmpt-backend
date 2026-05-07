'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const SALT_ROUNDS = 10;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

function signToken(userId, extras = {}) {
  return jwt.sign({ sub: userId, ...extras }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar_url: user.avatar_url,
    bio: user.bio,
    role: user.role_name,
    status: user.status,
    email_verified: !!user.email_verified,
    upload_limit_per_day: user.upload_limit_per_day,
    trust_level: user.trust_level,
    created_at: user.created_at,
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  publicUser,
};
