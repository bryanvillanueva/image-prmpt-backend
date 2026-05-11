'use strict';

const { query } = require('../config/database');
const { PROMPT_STATUS, PROMPT_VISIBILITY, ROLES } = require('../config/constants');
const promptService = require('../services/promptService');
const { NotFound } = require('../utils/httpErrors');

function stripInternalFields(prompt) {
  const { moderation_score, ...pub } = prompt;
  if (!pub.status) pub.status = PROMPT_STATUS.APPROVED;
  return pub;
}

async function listPrompts(req, res) {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;

  const where = ['p.status = ?', 'p.visibility = ?'];
  const params = [PROMPT_STATUS.APPROVED, PROMPT_VISIBILITY.PUBLIC];

  const joins = [
    'LEFT JOIN categories c ON c.id = p.category_id',
    'JOIN users u ON u.id = p.user_id',
  ];

  if (req.query.category) {
    joins.push('');
    where.push('c.slug = ?');
    params.push(req.query.category);
  }

  if (req.query.model) {
    where.push('p.model_name = ?');
    params.push(req.query.model);
  }

  if (req.query.q) {
    where.push('(p.title LIKE ? OR p.prompt_text LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like);
  }

  if (req.query.tag) {
    joins.push(
      'JOIN prompt_tags pt ON pt.prompt_id = p.id',
      'JOIN tags t ON t.id = pt.tag_id'
    );
    where.push('t.slug = ?');
    params.push(req.query.tag);
  }

  let order = 'p.created_at DESC';
  if (req.query.sort === 'popular') order = 'p.views_count DESC, p.created_at DESC';
  if (req.query.sort === 'most_liked') order = 'p.likes_count DESC, p.created_at DESC';

  const sql = `
    SELECT p.*, u.username AS author_username, u.name AS author_name, u.avatar_url AS author_avatar_url,
           c.name AS category_name, c.slug AS category_slug
      FROM prompts p
      ${joins.join('\n      ')}
     WHERE ${where.join(' AND ')}
     GROUP BY p.id
     ORDER BY ${order}
     LIMIT ? OFFSET ?`;
  const rows = await query(sql, [...params, limit, offset]);

  const totalRows = await query(
    `SELECT COUNT(DISTINCT p.id) AS total
       FROM prompts p
       ${joins.join('\n       ')}
      WHERE ${where.join(' AND ')}`,
    params
  );

  const ids = rows.map((r) => r.id);
  const imagesById = {};
  const tagsById = {};
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
    const tagRows = await query(
      `SELECT pt.prompt_id, t.id, t.name, t.slug
         FROM prompt_tags pt
         JOIN tags t ON t.id = pt.tag_id
        WHERE pt.prompt_id IN (${placeholders})`,
      ids
    );
    for (const t of tagRows) {
      if (!tagsById[t.prompt_id]) tagsById[t.prompt_id] = [];
      tagsById[t.prompt_id].push({ id: t.id, name: t.name, slug: t.slug });
    }
  }

  let likedSet = null;
  let savedSet = null;
  if (req.user && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const [likedRows, savedRows] = await Promise.all([
      query(
        `SELECT prompt_id FROM prompt_likes
          WHERE user_id = ? AND prompt_id IN (${placeholders})`,
        [req.user.id, ...ids]
      ),
      query(
        `SELECT prompt_id FROM saved_prompts
          WHERE user_id = ? AND prompt_id IN (${placeholders})`,
        [req.user.id, ...ids]
      ),
    ]);
    likedSet = new Set(likedRows.map((r) => r.prompt_id));
    savedSet = new Set(savedRows.map((r) => r.prompt_id));
  }

  const data = rows.map((r) => {
    const item = stripInternalFields(promptService.buildPromptResponse(
      r,
      imagesById[r.id],
      tagsById[r.id] || [],
      promptService.publicAuthor(r)
    ));
    item.is_liked = likedSet ? likedSet.has(r.id) : false;
    item.is_saved = savedSet ? savedSet.has(r.id) : false;
    return item;
  });

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

async function getPromptBySlug(req, res) {
  const rows = await query(
    `SELECT p.*, u.username AS author_username, u.name AS author_name, u.avatar_url AS author_avatar_url,
            c.name AS category_name, c.slug AS category_slug
       FROM prompts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? LIMIT 1`,
    [req.params.slug]
  );
  const row = rows[0];
  if (!row) throw NotFound('Prompt no encontrado');

  const isOwner = req.user && req.user.id === row.user_id;
  const isStaff = req.user && (
    req.user.role_name === ROLES.ADMIN || req.user.role_name === ROLES.MODERATOR
  );

  if (!isOwner && !isStaff) {
    if (row.status !== PROMPT_STATUS.APPROVED || row.visibility !== PROMPT_VISIBILITY.PUBLIC) {
      throw NotFound('Prompt no encontrado');
    }
  }

  if (!isOwner && !isStaff) {
    await promptService.incrementViews(row.id);
  }

  const [image, tags] = await Promise.all([
    promptService.getMainImage(row.id),
    promptService.getTagsForPrompt(row.id),
  ]);

  const built = promptService.buildPromptResponse(row, image, tags, promptService.publicAuthor(row));
  const response = isOwner || isStaff ? built : stripInternalFields(built);
  response.category = row.category_id
    ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
    : null;

  if (req.user) {
    const [likedRows, savedRows] = await Promise.all([
      query(
        'SELECT 1 FROM prompt_likes WHERE user_id = ? AND prompt_id = ? LIMIT 1',
        [req.user.id, row.id]
      ),
      query(
        'SELECT 1 FROM saved_prompts WHERE user_id = ? AND prompt_id = ? LIMIT 1',
        [req.user.id, row.id]
      ),
    ]);
    response.is_liked = likedRows.length > 0;
    response.is_saved = savedRows.length > 0;
  } else {
    response.is_liked = false;
    response.is_saved = false;
  }

  return res.json({ data: response });
}

async function listCategories(_req, res) {
  const rows = await query(
    `SELECT id, name, slug, description FROM categories
      WHERE is_active = 1 ORDER BY name ASC`
  );
  return res.json({ data: rows });
}

async function listTags(_req, res) {
  const rows = await query(
    `SELECT id, name, slug FROM tags WHERE is_active = 1 ORDER BY name ASC LIMIT 500`
  );
  return res.json({ data: rows });
}

async function getUserProfile(req, res) {
  const userRows = await query(
    `SELECT id, username, name, avatar_url, bio, created_at
       FROM users WHERE username = ? AND status = 'active' LIMIT 1`,
    [req.params.username]
  );
  const user = userRows[0];
  if (!user) throw NotFound('Usuario no encontrado');

  const [prompts, countRows] = await Promise.all([
    query(
      `SELECT p.* FROM prompts p
        WHERE p.user_id = ? AND p.status = ? AND p.visibility = ?
        ORDER BY p.created_at DESC LIMIT 50`,
      [user.id, PROMPT_STATUS.APPROVED, PROMPT_VISIBILITY.PUBLIC]
    ),
    query(
      `SELECT COUNT(*) AS total FROM prompts
        WHERE user_id = ? AND status = ? AND visibility = ?`,
      [user.id, PROMPT_STATUS.APPROVED, PROMPT_VISIBILITY.PUBLIC]
    ),
  ]);

  const ids = prompts.map((p) => p.id);
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
  const data = {
    user,
    total_prompts: Number(countRows[0].total),
    prompts: prompts.map((p) =>
      stripInternalFields(promptService.buildPromptResponse(p, imagesById[p.id], [], {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar_url: user.avatar_url,
      }))
    ),
  };
  return res.json({ data });
}

async function copyPrompt(req, res) {
  const prompt = await promptService.findBySlug(req.params.slug);
  if (!prompt) throw NotFound('Prompt no encontrado');
  if (prompt.status !== PROMPT_STATUS.APPROVED || prompt.visibility !== PROMPT_VISIBILITY.PUBLIC) {
    throw NotFound('Prompt no encontrado');
  }
  await promptService.incrementCopies(prompt.id);
  return res.json({ data: { ok: true, copied_count: prompt.copied_count + 1 } });
}

module.exports = {
  listPrompts,
  getPromptBySlug,
  listCategories,
  listTags,
  getUserProfile,
  copyPrompt,
};
