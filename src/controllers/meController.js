'use strict';

const { query } = require('../config/database');
const promptService = require('../services/promptService');
const userService = require('../services/userService');
const authService = require('../services/authService');
const cloudinaryService = require('../services/cloudinaryService');
const { detectImageMime } = require('../middlewares/upload');
const { ALLOWED_IMAGE_MIME } = require('../config/constants');
const { setAuthCookie } = require('../utils/cookies');
const {
  BadRequest,
  Conflict,
  Unauthorized,
  UnsupportedMediaType,
} = require('../utils/httpErrors');

function avatarPublicId(userId) {
  return `avatars/user-${userId}`;
}

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

async function updateMe(req, res) {
  const allowed = ['name', 'username', 'email', 'bio'];
  const fields = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      fields[key] = req.body[key];
    }
  }
  if (Object.keys(fields).length === 0) {
    throw BadRequest('Debes enviar al menos un campo para actualizar');
  }

  if (fields.username && fields.username !== req.user.username) {
    const existing = await userService.findByUsername(fields.username);
    if (existing && existing.id !== req.user.id) {
      throw Conflict('Ese nombre de usuario ya está en uso');
    }
  }
  if (fields.email && fields.email !== req.user.email) {
    const existing = await userService.findByEmail(fields.email);
    if (existing && existing.id !== req.user.id) {
      throw Conflict('Ese correo ya está registrado');
    }
  }

  const updated = await userService.updateProfile(req.user.id, fields);
  return res.json({ data: { user: authService.publicUser(updated) } });
}

async function updatePassword(req, res) {
  const { current_password, new_password } = req.body;

  if (current_password === new_password) {
    throw BadRequest('La nueva contraseña debe ser distinta de la actual');
  }

  const fullUser = await userService.findById(req.user.id);
  if (!fullUser) throw Unauthorized('Usuario no encontrado');

  const ok = await authService.comparePassword(current_password, fullUser.password_hash);
  if (!ok) throw Unauthorized('La contraseña actual es incorrecta');

  const password_hash = await authService.hashPassword(new_password);
  await userService.updatePasswordHash(req.user.id, password_hash);

  const token = authService.signToken(req.user.id, { role: req.user.role_name });
  setAuthCookie(res, token);

  return res.json({ data: { ok: true } });
}

async function uploadAvatar(req, res) {
  if (!req.file) throw BadRequest('Debes enviar una imagen en el campo "avatar"');

  const detectedMime = detectImageMime(req.file.buffer);
  if (!detectedMime || !ALLOWED_IMAGE_MIME.includes(detectedMime)) {
    throw UnsupportedMediaType('El contenido del archivo no corresponde a una imagen JPG/PNG/WEBP válida');
  }

  let uploadResult;
  try {
    uploadResult = await cloudinaryService.uploadImage(req.file.buffer, {
      folder: 'avatars',
      publicId: `user-${req.user.id}`,
    });
  } catch (err) {
    console.error('[cloudinary upload avatar]', err);
    throw BadRequest('No se pudo subir la imagen al almacenamiento');
  }

  const updated = await userService.updateAvatarUrl(req.user.id, uploadResult.secure_url);
  return res.json({ data: { user: authService.publicUser(updated) } });
}

async function deleteAvatar(req, res) {
  await cloudinaryService.deleteImage(avatarPublicId(req.user.id));
  const updated = await userService.updateAvatarUrl(req.user.id, null);
  return res.json({ data: { user: authService.publicUser(updated) } });
}

module.exports = {
  myPrompts,
  mySavedPrompts,
  updateMe,
  updatePassword,
  uploadAvatar,
  deleteAvatar,
};
