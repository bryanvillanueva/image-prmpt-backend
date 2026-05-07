'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { loginLimiter, registerLimiter } = require('../middlewares/rateLimit');
const {
  registerValidators,
  loginValidators,
} = require('../utils/validators');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  registerLimiter,
  registerValidators,
  validate,
  asyncHandler(ctrl.register)
);
router.post(
  '/login',
  loginLimiter,
  loginValidators,
  validate,
  asyncHandler(ctrl.login)
);
router.post('/logout', requireAuth, asyncHandler(ctrl.logout));
router.get('/me', requireAuth, asyncHandler(ctrl.me));

module.exports = router;
