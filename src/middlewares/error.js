'use strict';

const { AppError } = require('../utils/httpErrors');
const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'La imagen excede el tamaño máximo permitido (3 MB)' });
  }

  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'El recurso ya existe (clave duplicada)' });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
  }

  console.error('[unhandled error]', err);
  return res.status(500).json({
    error: 'Error interno del servidor',
    ...(env.isProduction ? {} : { debug: err && err.message }),
  });
}

module.exports = { errorHandler, notFound };
