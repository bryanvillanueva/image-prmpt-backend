'use strict';

const { query, getConnection } = require('../config/database');
const promptService = require('../services/promptService');
const userService = require('../services/userService');
const cloudinaryService = require('../services/cloudinaryService');
const moderationService = require('../services/moderationService');
const { detectImageMime } = require('../middlewares/upload');
const {
  PROMPT_STATUS,
  PROMPT_VISIBILITY,
  ALLOWED_IMAGE_MIME,
  MODERATION_ACTIONS,
  ROLES,
} = require('../config/constants');
const {
  BadRequest,
  Forbidden,
  NotFound,
  TooManyRequests,
  UnsupportedMediaType,
} = require('../utils/httpErrors');

async function ensureCategoryExists(categoryId) {
  const rows = await query(
    'SELECT id FROM categories WHERE id = ? AND is_active = 1 LIMIT 1',
    [categoryId]
  );
  if (rows.length === 0) throw BadRequest('La categoría no existe o está inactiva');
}

async function createPrompt(req, res) {
  if (!req.file) throw BadRequest('Debes enviar una imagen en el campo "image"');
  const detectedMime = detectImageMime(req.file.buffer);
  if (!detectedMime || !ALLOWED_IMAGE_MIME.includes(detectedMime)) {
    throw UnsupportedMediaType('El contenido del archivo no corresponde a una imagen JPG/PNG/WEBP válida');
  }

  await ensureCategoryExists(req.body.category_id);

  const limit = await userService.getUploadLimit(req.user.id);
  const today = await userService.countPromptsToday(req.user.id);
  if (today >= limit) {
    throw TooManyRequests(`Alcanzaste tu límite diario de subidas (${limit}). Intenta de nuevo mañana.`);
  }

  const slug = await promptService.ensureUniqueSlug(req.body.title);
  const visibility = req.body.visibility || PROMPT_VISIBILITY.PUBLIC;

  const moderation = await moderationService.runModeration({
    title: req.body.title,
    prompt_text: req.body.prompt_text,
    negative_prompt: req.body.negative_prompt,
    style: req.body.style,
    model_name: req.body.model_name,
    description: req.body.description,
    tags: req.body.tags,
  });

  const willBlock = moderation.action === MODERATION_ACTIONS.BLOCK;
  const initialStatus = willBlock ? PROMPT_STATUS.BLOCKED : PROMPT_STATUS.PENDING;

  let uploadResult;
  try {
    uploadResult = await cloudinaryService.uploadImage(req.file.buffer, {
      folder: `prompts/user-${req.user.id}`,
    });
  } catch (err) {
    console.error('[cloudinary upload]', err);
    throw BadRequest('No se pudo subir la imagen al almacenamiento');
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [insertResult] = await conn.execute(
      `INSERT INTO prompts
         (user_id, category_id, title, slug, prompt_text, negative_prompt,
          model_name, aspect_ratio, style, description, visibility, status,
          moderation_score, moderation_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        req.body.category_id,
        req.body.title,
        slug,
        req.body.prompt_text,
        req.body.negative_prompt || null,
        req.body.model_name,
        req.body.aspect_ratio || null,
        req.body.style || null,
        req.body.description || null,
        visibility,
        initialStatus,
        moderation.score,
        moderation.reason,
      ]
    );
    const promptId = insertResult.insertId;

    await conn.execute(
      `INSERT INTO prompt_images
         (prompt_id, image_url, storage_key, alt_text, is_main, width, height, file_size_bytes, mime_type)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        promptId,
        uploadResult.secure_url,
        uploadResult.public_id,
        req.body.alt_text || null,
        uploadResult.width || null,
        uploadResult.height || null,
        uploadResult.bytes || null,
        `image/${uploadResult.format || 'webp'}`,
      ]
    );

    if (Array.isArray(req.body.tags) && req.body.tags.length > 0) {
      const tagIds = await promptService.resolveTagIds(conn, req.body.tags);
      for (const tagId of tagIds) {
        await conn.execute(
          'INSERT IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)',
          [promptId, tagId]
        );
      }
    }

    await conn.commit();

    if (moderation.matches.length > 0) {
      await moderationService.persistLogs({
        promptId,
        userId: req.user.id,
        textHash: moderation.textHash,
        matches: moderation.matches,
      });
    }

    const fresh = await promptService.findById(promptId);
    const [image, tags] = await Promise.all([
      promptService.getMainImage(promptId),
      promptService.getTagsForPrompt(promptId),
    ]);
    return res.status(201).json({
      data: promptService.buildPromptResponse(fresh, image, tags, {
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
        avatar_url: req.user.avatar_url,
      }),
      meta: {
        moderation: {
          action: moderation.action,
          score: moderation.score,
          reason: moderation.reason,
        },
      },
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (uploadResult && uploadResult.public_id) {
      await cloudinaryService.deleteImage(uploadResult.public_id);
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function updatePrompt(req, res) {
  const id = req.prompt.id;
  const isStaff = req.isStaff;
  const isOwner = req.isOwner;

  if (!isOwner && req.user.role_name !== ROLES.ADMIN && req.user.role_name !== ROLES.MODERATOR) {
    throw Forbidden('No puedes editar este prompt');
  }

  if (req.body.category_id) await ensureCategoryExists(req.body.category_id);

  const current = await promptService.findById(id);
  if (!current) throw NotFound('Prompt no encontrado');

  const newSlug = req.body.title && req.body.title.trim() !== current.title
    ? await promptService.ensureUniqueSlug(req.body.title)
    : current.slug;

  const moderationInput = {
    title: req.body.title || current.title,
    prompt_text: req.body.prompt_text || current.prompt_text,
    negative_prompt: req.body.negative_prompt ?? current.negative_prompt,
    style: req.body.style ?? current.style,
    model_name: req.body.model_name || current.model_name,
    description: req.body.description ?? current.description,
    tags: req.body.tags || [],
  };
  const moderation = await moderationService.runModeration(moderationInput);
  const willBlock = moderation.action === MODERATION_ACTIONS.BLOCK;

  // Owner edits always reset to pending (or blocked). Staff can edit without forcing pending.
  let nextStatus = current.status;
  if (!isStaff) {
    nextStatus = willBlock ? PROMPT_STATUS.BLOCKED : PROMPT_STATUS.PENDING;
  } else if (willBlock) {
    nextStatus = PROMPT_STATUS.BLOCKED;
  }

  let uploadResult = null;
  let oldStorageKey = null;
  if (req.file) {
    const detectedMime = detectImageMime(req.file.buffer);
    if (!detectedMime || !ALLOWED_IMAGE_MIME.includes(detectedMime)) {
      throw UnsupportedMediaType('El contenido del archivo no corresponde a una imagen válida');
    }
    uploadResult = await cloudinaryService.uploadImage(req.file.buffer, {
      folder: `prompts/user-${current.user_id}`,
    });
    const oldImage = await promptService.getMainImage(id);
    if (oldImage) oldStorageKey = oldImage.storage_key;
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE prompts
          SET title = ?, slug = ?, prompt_text = ?, negative_prompt = ?,
              model_name = ?, aspect_ratio = ?, style = ?, description = ?,
              category_id = ?, visibility = ?, status = ?,
              moderation_score = ?, moderation_reason = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        req.body.title || current.title,
        newSlug,
        req.body.prompt_text || current.prompt_text,
        req.body.negative_prompt ?? current.negative_prompt,
        req.body.model_name || current.model_name,
        req.body.aspect_ratio ?? current.aspect_ratio,
        req.body.style ?? current.style,
        req.body.description ?? current.description,
        req.body.category_id || current.category_id,
        req.body.visibility || current.visibility,
        nextStatus,
        moderation.score,
        moderation.reason,
        id,
      ]
    );

    if (uploadResult) {
      await conn.execute('DELETE FROM prompt_images WHERE prompt_id = ?', [id]);
      await conn.execute(
        `INSERT INTO prompt_images
           (prompt_id, image_url, storage_key, alt_text, is_main, width, height, file_size_bytes, mime_type)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [
          id,
          uploadResult.secure_url,
          uploadResult.public_id,
          req.body.alt_text || null,
          uploadResult.width || null,
          uploadResult.height || null,
          uploadResult.bytes || null,
          `image/${uploadResult.format || 'webp'}`,
        ]
      );
    }

    if (Array.isArray(req.body.tags)) {
      await conn.execute('DELETE FROM prompt_tags WHERE prompt_id = ?', [id]);
      const tagIds = await promptService.resolveTagIds(conn, req.body.tags);
      for (const tagId of tagIds) {
        await conn.execute(
          'INSERT IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)',
          [id, tagId]
        );
      }
    }

    await conn.commit();

    if (oldStorageKey) await cloudinaryService.deleteImage(oldStorageKey);

    if (moderation.matches.length > 0) {
      await moderationService.persistLogs({
        promptId: id,
        userId: req.user.id,
        textHash: moderation.textHash,
        matches: moderation.matches,
      });
    }

    const fresh = await promptService.findById(id);
    const [image, tags] = await Promise.all([
      promptService.getMainImage(id),
      promptService.getTagsForPrompt(id),
    ]);
    return res.json({
      data: promptService.buildPromptResponse(fresh, image, tags, null),
      meta: {
        moderation: {
          action: moderation.action,
          score: moderation.score,
          reason: moderation.reason,
        },
      },
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (uploadResult && uploadResult.public_id) {
      await cloudinaryService.deleteImage(uploadResult.public_id);
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function deletePrompt(req, res) {
  const id = req.prompt.id;
  const image = await promptService.getMainImage(id);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM moderation_logs WHERE prompt_id = ?', [id]);
    await conn.execute('DELETE FROM reports WHERE prompt_id = ?', [id]);
    await conn.execute('DELETE FROM saved_prompts WHERE prompt_id = ?', [id]);
    await conn.execute('DELETE FROM prompt_likes WHERE prompt_id = ?', [id]);
    await conn.execute('DELETE FROM prompt_tags WHERE prompt_id = ?', [id]);
    await conn.execute('DELETE FROM prompt_images WHERE prompt_id = ?', [id]);
    await conn.execute('DELETE FROM prompts WHERE id = ?', [id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  if (image && image.storage_key) {
    await cloudinaryService.deleteImage(image.storage_key);
  }

  return res.json({ data: { ok: true, deleted_id: id } });
}

module.exports = { createPrompt, updatePrompt, deletePrompt };
