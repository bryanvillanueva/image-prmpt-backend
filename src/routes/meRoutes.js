'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { paginationValidators } = require('../utils/validators');
const ctrl = require('../controllers/meController');

const router = express.Router();

router.use(requireAuth);
router.get('/prompts', paginationValidators, validate, asyncHandler(ctrl.myPrompts));
router.get('/saved-prompts', paginationValidators, validate, asyncHandler(ctrl.mySavedPrompts));

module.exports = router;
