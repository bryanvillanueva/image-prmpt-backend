'use strict';

const { query } = require('../config/database');
const { ROLES } = require('../config/constants');
const { NotFound, Forbidden, Unauthorized } = require('../utils/httpErrors');

function loadPromptOwnership(table = 'prompts', idField = 'id') {
  return async function loader(req, _res, next) {
    try {
      if (!req.user) return next(Unauthorized());
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return next(NotFound('Prompt no encontrado'));

      const rows = await query(
        `SELECT id, user_id, status, visibility FROM ${table} WHERE ${idField} = ? LIMIT 1`,
        [id]
      );
      const row = rows[0];
      if (!row) return next(NotFound('Prompt no encontrado'));

      const isOwner = row.user_id === req.user.id;
      const isStaff =
        req.user.role_name === ROLES.ADMIN ||
        req.user.role_name === ROLES.MODERATOR;

      if (!isOwner && !isStaff) return next(Forbidden('No tienes permisos sobre este prompt'));

      req.prompt = row;
      req.isOwner = isOwner;
      req.isStaff = isStaff;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { loadPromptOwnership };
