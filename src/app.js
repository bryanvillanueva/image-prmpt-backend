'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middlewares/error');
const { generalLimiter } = require('./middlewares/rateLimit');

function buildApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());

  const corsOrigins = [env.FRONTEND_URL]
    .filter(Boolean)
    .map((u) => u.replace(/\/$/, ''));
  console.log('[cors] allowed origins:', corsOrigins);
  app.use(
    cors({
      origin(origin, cb) {
        // allow requests with no origin (curl, mobile, server-to-server)
        if (!origin) return cb(null, true);
        const normalized = origin.replace(/\/$/, '');
        if (corsOrigins.includes(normalized)) return cb(null, true);
        return cb(new Error(`Origin ${origin} no permitido por CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (!env.isProduction) app.use(morgan('dev'));
  else app.use(morgan('combined'));

  app.use('/api', generalLimiter, routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = buildApp;
