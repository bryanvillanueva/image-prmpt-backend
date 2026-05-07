'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');
const { ROLES } = require('../config/constants');
const ctrl = require('../controllers/moderationWordsController');
const {
  idParam,
  moderationWordValidators,
} = require('../utils/validators');

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/', asyncHandler(ctrl.list));
router.post('/', moderationWordValidators, validate, asyncHandler(ctrl.create));
router.put('/:id', idParam, moderationWordValidators, validate, asyncHandler(ctrl.update));
router.delete('/:id', idParam, validate, asyncHandler(ctrl.remove));

module.exports = router;
