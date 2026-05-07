'use strict';

const { query } = require('../config/database');
const promptService = require('../services/promptService');
const { PROMPT_STATUS } = require('../config/constants');
const { NotFound, BadRequest } = require('../utils/httpErrors');

async function listPending(req, res) {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;

  const status = req.query.status || null;
  const where = [];
  const params = [];
  if (status) {
    where.push('p.status = ?');
    params.push(status);
  } else {
    where.push('p.status IN (?, ?)');
    params.push(PROMPT_STATUS.PENDING, PROMPT_STATUS.BLOCKED);
  }

  const rows = await query(
    `SELECT p.*, u.username AS author_username, u.name AS author_name, u.avatar_url AS author_avatar_url
       FROM prompts p
       JOIN users u ON u.id = p.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at ASC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await query(
    `SELECT COUNT(*) AS total FROM prompts p WHERE ${where.join(' AND ')}`,
    params
  );

  const ids = rows.map((r) => r.id);
  const imagesById = {};
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const images = await query(
      `SELECT * FROM prompt_images WHERE prompt_id IN (${placeholders})`,
      ids
    );
    for (const img of images) {
      if (!imagesById[img.prompt_id]) imagesById[img.prompt_id] = img;
    }
  }

  const data = rows.map((r) =>
    promptService.buildPromptResponse(r, imagesById[r.id], [], promptService.publicAuthor(r))
  );

  return res.json({
    data,
    meta: {
      page,
      limit,
      total: Number(totalRows[0].total),
      pages: Math.ceil(Number(totalRows[0].total) / limit),
    },
  });
}

async function setStatus(promptId, status, reviewerId, extras = {}) {
  const fields = ['status = ?', 'reviewed_by = ?', 'reviewed_at = CURRENT_TIMESTAMP'];
  const params = [status, reviewerId];
  if (Object.prototype.hasOwnProperty.call(extras, 'rejection_reason')) {
    fields.push('rejection_reason = ?');
    params.push(extras.rejection_reason);
  }
  params.push(promptId);
  await query(`UPDATE prompts SET ${fields.join(', ')} WHERE id = ?`, params);
}

async function approve(req, res) {
  const id = req.params.id;
  const prompt = await promptService.findById(id);
  if (!prompt) throw NotFound('Prompt no encontrado');
  await setStatus(id, PROMPT_STATUS.APPROVED, req.user.id, { rejection_reason: null });
  const fresh = await promptService.findById(id);
  return res.json({ data: fresh });
}

async function reject(req, res) {
  const id = req.params.id;
  const prompt = await promptService.findById(id);
  if (!prompt) throw NotFound('Prompt no encontrado');
  await setStatus(id, PROMPT_STATUS.REJECTED, req.user.id, {
    rejection_reason: req.body.rejection_reason,
  });
  const fresh = await promptService.findById(id);
  return res.json({ data: fresh });
}

async function block(req, res) {
  const id = req.params.id;
  const prompt = await promptService.findById(id);
  if (!prompt) throw NotFound('Prompt no encontrado');
  await setStatus(id, PROMPT_STATUS.BLOCKED, req.user.id);
  const fresh = await promptService.findById(id);
  return res.json({ data: fresh });
}

async function hide(req, res) {
  const id = req.params.id;
  const prompt = await promptService.findById(id);
  if (!prompt) throw NotFound('Prompt no encontrado');
  if (prompt.status !== PROMPT_STATUS.APPROVED && prompt.status !== PROMPT_STATUS.HIDDEN) {
    throw BadRequest('Solo se pueden ocultar prompts en estado approved');
  }
  await setStatus(id, PROMPT_STATUS.HIDDEN, req.user.id);
  const fresh = await promptService.findById(id);
  return res.json({ data: fresh });
}

module.exports = { listPending, approve, reject, block, hide };
