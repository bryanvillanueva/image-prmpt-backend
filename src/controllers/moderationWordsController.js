'use strict';

const { query } = require('../config/database');
const { normalizeText } = require('../utils/textNormalize');
const { NotFound } = require('../utils/httpErrors');

async function list(_req, res) {
  const rows = await query(
    `SELECT id, term, normalized_term, language, category, severity,
            match_type, action, is_active, created_at, updated_at
       FROM moderation_words
       ORDER BY id DESC`
  );
  return res.json({ data: rows });
}

async function create(req, res) {
  const {
    term,
    language = 'es',
    category,
    severity,
    match_type,
    action,
    is_active = true,
  } = req.body;

  const normalized = normalizeText(term);
  const result = await query(
    `INSERT INTO moderation_words
       (term, normalized_term, language, category, severity, match_type, action, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [term, normalized, language, category, severity, match_type, action, is_active ? 1 : 0]
  );
  const rows = await query(
    'SELECT * FROM moderation_words WHERE id = ?',
    [result.insertId]
  );
  return res.status(201).json({ data: rows[0] });
}

async function update(req, res) {
  const id = req.params.id;
  const existingRows = await query(
    'SELECT * FROM moderation_words WHERE id = ? LIMIT 1',
    [id]
  );
  const existing = existingRows[0];
  if (!existing) throw NotFound('Regla no encontrada');

  const merged = { ...existing, ...req.body };
  if (req.body.term) merged.normalized_term = normalizeText(req.body.term);

  await query(
    `UPDATE moderation_words
        SET term = ?, normalized_term = ?, language = ?, category = ?,
            severity = ?, match_type = ?, action = ?, is_active = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      merged.term,
      merged.normalized_term,
      merged.language,
      merged.category,
      merged.severity,
      merged.match_type,
      merged.action,
      merged.is_active ? 1 : 0,
      id,
    ]
  );
  const rows = await query('SELECT * FROM moderation_words WHERE id = ?', [id]);
  return res.json({ data: rows[0] });
}

async function remove(req, res) {
  const id = req.params.id;
  const existingRows = await query(
    'SELECT id FROM moderation_words WHERE id = ? LIMIT 1',
    [id]
  );
  if (existingRows.length === 0) throw NotFound('Regla no encontrada');
  await query('DELETE FROM moderation_words WHERE id = ?', [id]);
  return res.json({ data: { ok: true, deleted_id: Number(id) } });
}

module.exports = { list, create, update, remove };
