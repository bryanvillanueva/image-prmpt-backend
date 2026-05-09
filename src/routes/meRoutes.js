'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { uploadSingleAvatar } = require('../middlewares/upload');
const { paginationValidators, updateMeValidators, updatePasswordValidators } = require('../utils/validators');
const ctrl = require('../controllers/meController');

const router = express.Router();

router.use(requireAuth);
router.get('/prompts', paginationValidators, validate, asyncHandler(ctrl.myPrompts));
router.get('/saved-prompts', paginationValidators, validate, asyncHandler(ctrl.mySavedPrompts));
router.patch('/', updateMeValidators, validate, asyncHandler(ctrl.updateMe));
router.patch('/password', updatePasswordValidators, validate, asyncHandler(ctrl.updatePassword));
router.post('/avatar', uploadSingleAvatar, asyncHandler(ctrl.uploadAvatar));
router.delete('/avatar', asyncHandler(ctrl.deleteAvatar));

module.exports = router;
