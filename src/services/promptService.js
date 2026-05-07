'use strict';

const { query } = require('../config/database');
const slugify = require('../utils/slugify');

async function findById(id) {
  const rows = await query('SELECT * FROM prompts WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function findBySlug(slug) {
  const rows = await query(
    'SELECT * FROM prompts WHERE slug = ? LIMIT 1',
    [slug]
  );
  return rows[0] || null;
}

async function ensureUniqueSlug(baseTitle) {
  const base = slugify(baseTitle) || 'prompt';
  let candidate = base;
  let n = 1;
  // Cap iterations to avoid infinite loop in pathological cases
  while (n < 1000) {
    const rows = await query(
      'SELECT id FROM prompts WHERE slug = ? LIMIT 1',
      [candidate]
    );
    if (rows.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

async function getMainImage(promptId) {
  const rows = await query(
    `SELECT * FROM prompt_images WHERE prompt_id = ? ORDER BY is_main DESC, id ASC LIMIT 1`,
    [promptId]
  );
  return rows[0] || null;
}

async function getTagsForPrompt(promptId) {
  return query(
    `SELECT t.id, t.name, t.slug
       FROM tags t
       JOIN prompt_tags pt ON pt.tag_id = t.id
      WHERE pt.prompt_id = ?
      ORDER BY t.name ASC`,
    [promptId]
  );
}

async function recountLikes(promptId) {
  await query(
    `UPDATE prompts SET likes_count = (
       SELECT COUNT(*) FROM prompt_likes WHERE prompt_id = ?
     ) WHERE id = ?`,
    [promptId, promptId]
  );
}

async function recountSaves(promptId) {
  await query(
    `UPDATE prompts SET saves_count = (
       SELECT COUNT(*) FROM saved_prompts WHERE prompt_id = ?
     ) WHERE id = ?`,
    [promptId, promptId]
  );
}

async function incrementViews(promptId) {
  await query(
    'UPDATE prompts SET views_count = views_count + 1 WHERE id = ?',
    [promptId]
  );
}

async function incrementCopies(promptId) {
  await query(
    'UPDATE prompts SET copied_count = copied_count + 1 WHERE id = ?',
    [promptId]
  );
}

async function resolveTagIds(connection, tagNames) {
  const ids = [];
  for (const raw of tagNames) {
    const name = String(raw).trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug) continue;

    const [existing] = await connection.execute(
      'SELECT id FROM tags WHERE slug = ? LIMIT 1',
      [slug]
    );
    if (existing.length > 0) {
      ids.push(existing[0].id);
      continue;
    }
    const [insertResult] = await connection.execute(
      `INSERT INTO tags (name, slug, is_active) VALUES (?, ?, 1)`,
      [name.slice(0, 80), slug]
    );
    ids.push(insertResult.insertId);
  }
  return Array.from(new Set(ids));
}

function publicAuthor(row) {
  if (!row) return null;
  return {
    id: row.user_id || row.id,
    username: row.author_username || row.username,
    name: row.author_name || row.name,
    avatar_url: row.author_avatar_url || row.avatar_url,
  };
}

function buildPromptResponse(prompt, image, tags, author) {
  return {
    id: prompt.id,
    user_id: prompt.user_id,
    category_id: prompt.category_id,
    title: prompt.title,
    slug: prompt.slug,
    prompt_text: prompt.prompt_text,
    negative_prompt: prompt.negative_prompt,
    model_name: prompt.model_name,
    aspect_ratio: prompt.aspect_ratio,
    style: prompt.style,
    description: prompt.description,
    visibility: prompt.visibility,
    status: prompt.status,
    moderation_score: prompt.moderation_score,
    moderation_reason: prompt.moderation_reason,
    rejection_reason: prompt.rejection_reason,
    copied_count: prompt.copied_count,
    views_count: prompt.views_count,
    likes_count: prompt.likes_count,
    saves_count: prompt.saves_count,
    created_at: prompt.created_at,
    updated_at: prompt.updated_at,
    image: image
      ? {
          url: image.image_url,
          width: image.width,
          height: image.height,
          alt_text: image.alt_text,
          mime_type: image.mime_type,
          file_size_bytes: image.file_size_bytes,
        }
      : null,
    tags: tags || [],
    author: author || null,
  };
}

module.exports = {
  findById,
  findBySlug,
  ensureUniqueSlug,
  getMainImage,
  getTagsForPrompt,
  recountLikes,
  recountSaves,
  incrementViews,
  incrementCopies,
  resolveTagIds,
  publicAuthor,
  buildPromptResponse,
};
