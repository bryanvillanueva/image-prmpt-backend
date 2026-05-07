'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');
const { ROLES } = require('../config/constants');
const promptCtrl = require('../controllers/adminPromptController');
const reportCtrl = require('../controllers/adminReportController');
const userCtrl = require('../controllers/adminUserController');
const moderationWordsRoutes = require('./moderationWordsRoutes');
const {
  idParam,
  paginationValidators,
  adminListPromptsValidators,
  adminRejectValidators,
  adminResolveReportValidators,
  adminChangeRoleValidators,
  adminUploadLimitValidators,
} = require('../utils/validators');

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN, ROLES.MODERATOR));

router.get(
  '/prompts/pending',
  adminListPromptsValidators,
  validate,
  asyncHandler(promptCtrl.listPending)
);
router.patch('/prompts/:id/approve', idParam, validate, asyncHandler(promptCtrl.approve));
router.patch(
  '/prompts/:id/reject',
  idParam,
  adminRejectValidators,
  validate,
  asyncHandler(promptCtrl.reject)
);
router.patch('/prompts/:id/block', idParam, validate, asyncHandler(promptCtrl.block));
router.patch('/prompts/:id/hide', idParam, validate, asyncHandler(promptCtrl.hide));

router.get('/reports', paginationValidators, validate, asyncHandler(reportCtrl.listReports));
router.patch(
  '/reports/:id/resolve',
  idParam,
  adminResolveReportValidators,
  validate,
  asyncHandler(reportCtrl.resolveReport)
);

router.get('/users', paginationValidators, validate, asyncHandler(userCtrl.listUsers));
router.patch('/users/:id/suspend', idParam, validate, asyncHandler(userCtrl.suspendUser));
router.patch('/users/:id/reactivate', idParam, validate, asyncHandler(userCtrl.reactivateUser));
router.patch('/users/:id/role', idParam, adminChangeRoleValidators, validate, asyncHandler(userCtrl.changeRole));
router.patch('/users/:id/upload-limit', idParam, adminUploadLimitValidators, validate, asyncHandler(userCtrl.setUploadLimit));

router.use('/moderation-words', moderationWordsRoutes);

module.exports = router;
