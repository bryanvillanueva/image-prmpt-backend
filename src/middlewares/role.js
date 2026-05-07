'use strict';

const { Forbidden, Unauthorized } = require('../utils/httpErrors');

function requireRole(...allowed) {
  const set = new Set(allowed);
  return function roleGuard(req, _res, next) {
    if (!req.user) return next(Unauthorized());
    if (!set.has(req.user.role_name)) return next(Forbidden());
    return next();
  };
}

module.exports = { requireRole };
