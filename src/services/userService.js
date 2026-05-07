'use strict';

const { query } = require('../config/database');
const { ROLES, DEFAULT_UPLOAD_LIMIT_PER_DAY } = require('../config/constants');

async function findById(id) {
  const rows = await query(
    `SELECT u.*, r.name AS role_name FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const rows = await query(
    `SELECT u.*, r.name AS role_name FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE u.email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findByUsername(username) {
  const rows = await query(
    `SELECT u.*, r.name AS role_name FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE u.username = ? LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function getRoleIdByName(name) {
  const rows = await query(
    'SELECT id FROM roles WHERE name = ? LIMIT 1',
    [name]
  );
  return rows[0] ? rows[0].id : null;
}

async function createUser({ name, username, email, password_hash }) {
  const roleId = await getRoleIdByName(ROLES.USER);
  if (!roleId) {
    throw new Error(
      `El rol '${ROLES.USER}' no existe en la tabla roles. Inserta los roles base antes de registrar usuarios.`
    );
  }
  const result = await query(
    `INSERT INTO users
       (role_id, name, username, email, password_hash, status, email_verified, upload_limit_per_day, trust_level)
     VALUES (?, ?, ?, ?, ?, 'active', 0, ?, 'new')`,
    [roleId, name, username, email, password_hash, DEFAULT_UPLOAD_LIMIT_PER_DAY]
  );
  return findById(result.insertId);
}

async function countPromptsToday(userId) {
  const rows = await query(
    `SELECT COUNT(*) AS total FROM prompts
      WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  return rows[0] ? Number(rows[0].total) : 0;
}

async function getUploadLimit(userId) {
  const rows = await query(
    'SELECT upload_limit_per_day FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return rows[0] ? Number(rows[0].upload_limit_per_day) : DEFAULT_UPLOAD_LIMIT_PER_DAY;
}

module.exports = {
  findById,
  findByEmail,
  findByUsername,
  getRoleIdByName,
  createUser,
  countPromptsToday,
  getUploadLimit,
};
