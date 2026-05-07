'use strict';

const express = require('express');

const authRoutes = require('./authRoutes');
const publicRoutes = require('./publicRoutes');
const promptRoutes = require('./promptRoutes');
const meRoutes = require('./meRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/admin', adminRoutes);

// IMPORTANT: publicRoutes (GET only) must be registered BEFORE promptRoutes
// so unauthenticated GET /prompts and GET /prompts/:slug don't hit the
// global `requireAuth` declared in promptRoutes.
router.use('/', publicRoutes);
router.use('/prompts', promptRoutes);

module.exports = router;
