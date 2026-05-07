'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { uploadSingleImage } = require('../middlewares/upload');
const { loadPromptOwnership } = require('../middlewares/ownerOrAdmin');
const promptCtrl = require('../controllers/promptController');
const interactionCtrl = require('../controllers/interactionController');
const {
  idParam,
  promptCreateValidators,
  promptUpdateValidators,
  reportCreateValidators,
} = require('../utils/validators');

const router = express.Router();

// All prompt-mutation routes require auth
router.use(requireAuth);

router.post(
  '/',
  uploadSingleImage,
  promptCreateValidators,
  validate,
  asyncHandler(promptCtrl.createPrompt)
);

router.put(
  '/:id',
  idParam,
  validate,
  loadPromptOwnership(),
  uploadSingleImage,
  promptUpdateValidators,
  validate,
  asyncHandler(promptCtrl.updatePrompt)
);

router.delete(
  '/:id',
  idParam,
  validate,
  loadPromptOwnership(),
  asyncHandler(promptCtrl.deletePrompt)
);

router.post('/:id/like', idParam, validate, asyncHandler(interactionCtrl.like));
router.delete('/:id/like', idParam, validate, asyncHandler(interactionCtrl.unlike));
router.post('/:id/save', idParam, validate, asyncHandler(interactionCtrl.save));
router.delete('/:id/save', idParam, validate, asyncHandler(interactionCtrl.unsave));
router.post(
  '/:id/report',
  idParam,
  reportCreateValidators,
  validate,
  asyncHandler(interactionCtrl.report)
);

module.exports = router;
