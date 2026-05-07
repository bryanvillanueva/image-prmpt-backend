'use strict';

const { query } = require('../config/database');
const { REPORT_STATUS } = require('../config/constants');

async function createReport({ reporterUserId, promptId, reason, description }) {
  const result = await query(
    `INSERT INTO reports
       (reporter_user_id, prompt_id, reason, description, status)
     VALUES (?, ?, ?, ?, ?)`,
    [reporterUserId, promptId, reason, description || null, REPORT_STATUS.PENDING]
  );
  return result.insertId;
}

async function listReports({ status, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];
  if (status) {
    where.push('r.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT r.*, p.title AS prompt_title, p.slug AS prompt_slug,
            u.username AS reporter_username
       FROM reports r
       JOIN prompts p ON p.id = r.prompt_id
       JOIN users u ON u.id = r.reporter_user_id
       ${whereSql}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const totalRows = await query(
    `SELECT COUNT(*) AS total FROM reports r ${whereSql}`,
    params
  );
  return { rows, total: Number(totalRows[0].total) };
}

async function findReportById(id) {
  const rows = await query(
    'SELECT * FROM reports WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function resolveReport({ id, status, reviewerUserId }) {
  await query(
    `UPDATE reports
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [status, reviewerUserId, id]
  );
}

module.exports = {
  createReport,
  listReports,
  findReportById,
  resolveReport,
};
