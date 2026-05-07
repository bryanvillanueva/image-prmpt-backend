'use strict';

const env = require('./config/env');
const { ping, pool } = require('./config/database');
const buildApp = require('./app');

async function start() {
  try {
    await ping();
    console.log('[db] pool listo y conectado');
  } catch (err) {
    console.error('[db] no se pudo conectar al iniciar:', err.message);
    process.exit(1);
  }

  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[server] escuchando en puerto ${env.PORT} (env=${env.NODE_ENV})`);
  });

  function shutdown(signal) {
    console.log(`\n[server] recibido ${signal}, cerrando…`);
    server.close(async () => {
      try {
        await pool.end();
      } catch (_) {
        /* ignore */
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err);
  });
}

start();
