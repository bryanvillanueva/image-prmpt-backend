'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { optionalAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/publicController');
const {
  publicListValidators,
  slugParam,
  usernameParam,
} = require('../utils/validators');

const router = express.Router();

router.get('/prompts', publicListValidators, validate, optionalAuth, asyncHandler(ctrl.listPrompts));
router.get('/prompts/:slug', slugParam, validate, optionalAuth, asyncHandler(ctrl.getPromptBySlug));
router.post('/prompts/:slug/copy', slugParam, validate, optionalAuth, asyncHandler(ctrl.copyPrompt));
router.get('/categories', asyncHandler(ctrl.listCategories));
router.get('/tags', asyncHandler(ctrl.listTags));
router.get('/users/:username', usernameParam, validate, asyncHandler(ctrl.getUserProfile));

module.exports = router;
