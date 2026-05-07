'use strict';

const { query } = require('../config/database');
const promptService = require('../services/promptService');

async function myPrompts(req, res) {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;

  const where = ['p.user_id = ?'];
  const params = [req.user.id];
  if (req.query.status) {
    where.push('p.status = ?');
    params.push(req.query.status);
  }

  const rows = await query(
    `SELECT p.* FROM prompts p
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC
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
      `SELECT * FROM prompt_images
        WHERE prompt_id IN (${placeholders})
        ORDER BY is_main DESC, id ASC`,
      ids
    );
    for (const img of images) {
      if (!imagesById[img.prompt_id]) imagesById[img.prompt_id] = img;
    }
  }

  const data = rows.map((r) =>
    promptService.buildPromptResponse(r, imagesById[r.id], [], {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      avatar_url: req.user.avatar_url,
    })
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

async function mySavedPrompts(req, res) {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;

  const rows = await query(
    `SELECT p.*, u.username AS author_username, u.name AS author_name, u.avatar_url AS author_avatar_url,
            sp.created_at AS saved_at
       FROM saved_prompts sp
       JOIN prompts p ON p.id = sp.prompt_id
       JOIN users u ON u.id = p.user_id
      WHERE sp.user_id = ?
      ORDER BY sp.created_at DESC
      LIMIT ? OFFSET ?`,
    [req.user.id, limit, offset]
  );
  const totalRows = await query(
    'SELECT COUNT(*) AS total FROM saved_prompts WHERE user_id = ?',
    [req.user.id]
  );

  const ids = rows.map((r) => r.id);
  const imagesById = {};
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const images = await query(
      `SELECT * FROM prompt_images
        WHERE prompt_id IN (${placeholders})
        ORDER BY is_main DESC, id ASC`,
      ids
    );
    for (const img of images) {
      if (!imagesById[img.prompt_id]) imagesById[img.prompt_id] = img;
    }
  }

  const data = rows.map((r) => ({
    ...promptService.buildPromptResponse(r, imagesById[r.id], [], promptService.publicAuthor(r)),
    saved_at: r.saved_at,
  }));

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

module.exports = { myPrompts, mySavedPrompts };
