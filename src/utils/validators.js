'use strict';

const { body, param, query } = require('express-validator');
const {
  PROMPT_VISIBILITY,
  REPORT_REASONS,
  MODERATION_ACTIONS,
  MODERATION_SEVERITY,
  MODERATION_MATCH_TYPE,
  PROMPT_STATUS,
  ROLES,
} = require('../config/constants');

const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;

const registerValidators = [
  body('name').isString().trim().isLength({ min: 1, max: 80 }),
  body('username')
    .isString()
    .trim()
    .matches(usernameRegex)
    .withMessage('username debe tener 3-30 caracteres alfanuméricos, _, . o -'),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('La contraseña debe tener entre 8 y 128 caracteres'),
];

const loginValidators = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 128 }),
];

const idParam = [param('id').isInt({ min: 1 }).toInt()];
const slugParam = [param('slug').isString().trim().notEmpty().isLength({ max: 200 })];
const usernameParam = [
  param('username').isString().trim().matches(usernameRegex),
];

const promptCreateValidators = [
  body('title').isString().trim().isLength({ min: 3, max: 180 }),
  body('prompt_text').isString().trim().isLength({ min: 5, max: 8000 }),
  body('negative_prompt')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),
  body('model_name').isString().trim().isLength({ min: 1, max: 80 }),
  body('aspect_ratio')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 16 }),
  body('style')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 80 }),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),
  body('category_id').isInt({ min: 1 }).toInt(),
  body('visibility')
    .optional()
    .isIn(Object.values(PROMPT_VISIBILITY)),
  body('tags')
    .optional({ nullable: true })
    .customSanitizer((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim().length > 0) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) {
          /* fallthrough */
        }
        return value.split(',').map((t) => t.trim()).filter(Boolean);
      }
      return [];
    })
    .isArray({ max: 20 })
    .withMessage('tags debe ser un arreglo de hasta 20 elementos'),
  body('alt_text')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 200 }),
];

const promptUpdateValidators = promptCreateValidators.map((v) => v.optional());

const reportCreateValidators = [
  body('reason').isIn(REPORT_REASONS),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 500 }),
];

const adminRejectValidators = [
  body('rejection_reason').isString().trim().isLength({ min: 3, max: 500 }),
];

const adminResolveReportValidators = [
  body('status')
    .isIn(['resolved', 'dismissed'])
    .withMessage('status debe ser resolved o dismissed'),
];

const moderationWordValidators = [
  body('term').isString().trim().isLength({ min: 1, max: 200 }),
  body('language')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 2, max: 8 }),
  body('category').isString().trim().isLength({ min: 1, max: 40 }),
  body('severity').isIn(Object.values(MODERATION_SEVERITY)),
  body('match_type').isIn(Object.values(MODERATION_MATCH_TYPE)),
  body('action').isIn(Object.values(MODERATION_ACTIONS)),
  body('is_active').optional().isBoolean().toBoolean(),
];

const paginationValidators = [
  query('page').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const publicListValidators = [
  ...paginationValidators,
  query('category').optional().isString().trim().isLength({ max: 80 }),
  query('tag').optional().isString().trim().isLength({ max: 80 }),
  query('model').optional().isString().trim().isLength({ max: 80 }),
  query('q').optional().isString().trim().isLength({ max: 120 }),
  query('sort').optional().isIn(['recent', 'popular', 'most_liked']),
];

const adminListPromptsValidators = [
  ...paginationValidators,
  query('status').optional().isIn(Object.values(PROMPT_STATUS)),
];

const adminChangeRoleValidators = [
  body('role').isIn(Object.values(ROLES)).withMessage(`role debe ser uno de: ${Object.values(ROLES).join(', ')}`),
];

const adminUploadLimitValidators = [
  body('limit').isInt({ min: 1, max: 1000 }).toInt().withMessage('limit debe ser un entero entre 1 y 1000'),
];

module.exports = {
  registerValidators,
  loginValidators,
  idParam,
  slugParam,
  usernameParam,
  promptCreateValidators,
  promptUpdateValidators,
  reportCreateValidators,
  adminRejectValidators,
  adminResolveReportValidators,
  adminChangeRoleValidators,
  adminUploadLimitValidators,
  moderationWordValidators,
  paginationValidators,
  publicListValidators,
  adminListPromptsValidators,
};
