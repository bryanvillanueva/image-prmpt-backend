'use strict';

class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }
}

const BadRequest = (message = 'Petición inválida', details) =>
  new AppError(400, message, details);
const Unauthorized = (message = 'No autenticado') => new AppError(401, message);
const Forbidden = (message = 'Sin permisos para esta acción') =>
  new AppError(403, message);
const NotFound = (message = 'Recurso no encontrado') =>
  new AppError(404, message);
const Conflict = (message = 'Conflicto con el estado actual') =>
  new AppError(409, message);
const PayloadTooLarge = (message = 'Archivo demasiado grande') =>
  new AppError(413, message);
const UnsupportedMediaType = (message = 'Formato de archivo no soportado') =>
  new AppError(415, message);
const Unprocessable = (message = 'Datos inválidos', details) =>
  new AppError(422, message, details);
const TooManyRequests = (message = 'Demasiadas peticiones') =>
  new AppError(429, message);

module.exports = {
  AppError,
  BadRequest,
  Unauthorized,
  Forbidden,
  NotFound,
  Conflict,
  PayloadTooLarge,
  UnsupportedMediaType,
  Unprocessable,
  TooManyRequests,
};
