'use strict';

const { validationResult } = require('express-validator');
const { Unprocessable } = require('../utils/httpErrors');

function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array({ onlyFirstError: true }).map((e) => ({
    field: e.path || e.param,
    location: e.location,
    message: e.msg,
  }));
  return next(Unprocessable('Datos inválidos', details));
}

module.exports = validate;
