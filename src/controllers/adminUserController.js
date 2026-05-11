'use strict';

const { query } = require('../config/database');
const { USER_STATUS, ROLES } = require('../config/constants');
const { NotFound, Forbidden, BadRequest } = require('../utils/httpErrors');

async function listUsers(req, res) {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(u.username LIKE ? OR u.email LIKE ? OR u.name LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like);
  }
  if (req.query.status) {
    where.push('u.status = ?');
    params.push(req.query.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT u.id, u.name, u.username, u.email, u.status, u.email_verified,
            u.upload_limit_per_day, u.trust_level, u.created_at, r.name AS role_name,
            (SELECT COUNT(*) FROM prompts p WHERE p.user_id = u.id) AS total_prompts
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const totalRows = await query(
    `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
    params
  );
  return res.json({
    data: rows,
    meta: {
      page,
      limit,
      total: Number(totalRows[0].total),
      pages: Math.ceil(Number(totalRows[0].total) / limit),
    },
  });
}

async function suspendUser(req, res) {
  if (req.user.role_name !== ROLES.ADMIN) {
    throw Forbidden('Solo administradores pueden suspender usuarios');
  }
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) throw BadRequest('No puedes suspender tu propia cuenta');

  const rows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) throw NotFound('Usuario no encontrado');

  await query('UPDATE users SET status = ? WHERE id = ?', [USER_STATUS.SUSPENDED, id]);
  return res.json({ data: { ok: true, suspended_user_id: id } });
}

async function reactivateUser(req, res) {
  if (req.user.role_name !== ROLES.ADMIN) {
    throw Forbidden('Solo administradores pueden reactivar usuarios');
  }
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) throw BadRequest('No puedes reactivar tu propia cuenta');

  const rows = await query('SELECT id, status FROM users WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) throw NotFound('Usuario no encontrado');
  if (rows[0].status !== USER_STATUS.SUSPENDED) {
    throw BadRequest('El usuario no está suspendido');
  }

  await query('UPDATE users SET status = ? WHERE id = ?', [USER_STATUS.ACTIVE, id]);
  return res.json({ data: { ok: true, reactivated_user_id: id } });
}

async function changeRole(req, res) {
  if (req.user.role_name !== ROLES.ADMIN) {
    throw Forbidden('Solo administradores pueden cambiar roles');
  }
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) throw BadRequest('No puedes cambiar tu propio rol');

  const rows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) throw NotFound('Usuario no encontrado');

  const roleRows = await query('SELECT id FROM roles WHERE name = ? LIMIT 1', [req.body.role]);
  if (roleRows.length === 0) throw BadRequest('Rol no válido');

  await query('UPDATE users SET role_id = ? WHERE id = ?', [roleRows[0].id, id]);
  return res.json({ data: { ok: true, user_id: id, role: req.body.role } });
}

async function setUploadLimit(req, res) {
  if (req.user.role_name !== ROLES.ADMIN) {
    throw Forbidden('Solo administradores pueden cambiar el límite de subidas');
  }
  const id = parseInt(req.params.id, 10);

  const rows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) throw NotFound('Usuario no encontrado');

  await query('UPDATE users SET upload_limit_per_day = ? WHERE id = ?', [req.body.limit, id]);
  return res.json({ data: { ok: true, user_id: id, upload_limit_per_day: req.body.limit } });
}

module.exports = { listUsers, suspendUser, reactivateUser, changeRole, setUploadLimit };
