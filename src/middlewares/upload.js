'use strict';

const multer = require('multer');
const {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
} = require('../config/constants');
const { UnsupportedMediaType } = require('../utils/httpErrors');

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
    return cb(UnsupportedMediaType('Solo se aceptan imágenes JPG, PNG o WEBP'));
  }
  cb(null, true);
}

const uploader = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

const uploadSingleImage = uploader.single('image');

const MAGIC_BYTES = [
  { mime: 'image/jpeg', sig: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', sig: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', prefix: [0x52, 0x49, 0x46, 0x46], offsetCheck: { offset: 8, value: [0x57, 0x45, 0x42, 0x50] } },
];

function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  for (const def of MAGIC_BYTES) {
    if (def.sig) {
      const ok = def.sig.every((b, i) => buffer[i] === b);
      if (ok) return def.mime;
    } else if (def.prefix) {
      const ok = def.prefix.every((b, i) => buffer[i] === b);
      if (!ok) continue;
      const off = def.offsetCheck.offset;
      const okSuffix = def.offsetCheck.value.every((b, i) => buffer[off + i] === b);
      if (okSuffix) return def.mime;
    }
  }
  return null;
}

module.exports = { uploadSingleImage, detectImageMime };
