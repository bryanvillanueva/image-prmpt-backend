'use strict';

const { query } = require('../config/database');
const promptService = require('../services/promptService');
const reportService = require('../services/reportService');
const { NotFound } = require('../utils/httpErrors');
const { PROMPT_STATUS } = require('../config/constants');

async function ensurePromptVisible(promptId) {
  const rows = await query(
    'SELECT id, status, visibility FROM prompts WHERE id = ? LIMIT 1',
    [promptId]
  );
  const p = rows[0];
  if (!p) throw NotFound('Prompt no encontrado');
  return p;
}

async function like(req, res) {
  const id = req.params.id;
  await ensurePromptVisible(id);
  await query(
    'INSERT IGNORE INTO prompt_likes (user_id, prompt_id) VALUES (?, ?)',
    [req.user.id, id]
  );
  await promptService.recountLikes(id);
  const fresh = await promptService.findById(id);
  return res.status(201).json({ data: { ok: true, likes_count: fresh.likes_count } });
}

async function unlike(req, res) {
  const id = req.params.id;
  await query(
    'DELETE FROM prompt_likes WHERE user_id = ? AND prompt_id = ?',
    [req.user.id, id]
  );
  await promptService.recountLikes(id);
  const fresh = await promptService.findById(id);
  return res.json({ data: { ok: true, likes_count: fresh ? fresh.likes_count : 0 } });
}

async function save(req, res) {
  const id = req.params.id;
  await ensurePromptVisible(id);
  await query(
    'INSERT IGNORE INTO saved_prompts (user_id, prompt_id) VALUES (?, ?)',
    [req.user.id, id]
  );
  await promptService.recountSaves(id);
  const fresh = await promptService.findById(id);
  return res.status(201).json({ data: { ok: true, saves_count: fresh.saves_count } });
}

async function unsave(req, res) {
  const id = req.params.id;
  await query(
    'DELETE FROM saved_prompts WHERE user_id = ? AND prompt_id = ?',
    [req.user.id, id]
  );
  await promptService.recountSaves(id);
  const fresh = await promptService.findById(id);
  return res.json({ data: { ok: true, saves_count: fresh ? fresh.saves_count : 0 } });
}

async function report(req, res) {
  const id = req.params.id;
  const promptRow = await ensurePromptVisible(id);
  if (promptRow.status === PROMPT_STATUS.BLOCKED) {
    // OK to report blocked content too — moderators can still review history
  }
  const reportId = await reportService.createReport({
    reporterUserId: req.user.id,
    promptId: id,
    reason: req.body.reason,
    description: req.body.description,
  });
  return res.status(201).json({ data: { ok: true, report_id: reportId } });
}

module.exports = { like, unlike, save, unsave, report };
