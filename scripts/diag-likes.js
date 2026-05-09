'use strict';

// Test: insert real (revierte al final). Borrar al terminar.
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [users] = await conn.query('SELECT id, username FROM users LIMIT 5');
  const [prompts] = await conn.query('SELECT id, slug, status, visibility, likes_count FROM prompts ORDER BY id DESC LIMIT 3');
  console.log('Users:', users);
  console.log('Prompts:', prompts);

  if (users.length === 0 || prompts.length === 0) {
    console.log('No hay datos suficientes.');
    await conn.end();
    return;
  }

  const userId = users[0].id;
  const promptId = prompts[0].id;
  console.log(`\nIntentando INSERT IGNORE prompt_likes (user_id=${userId}, prompt_id=${promptId})`);

  // Replicate exactly what the controller does, but with .execute() (prepared)
  try {
    const [result] = await conn.execute(
      'INSERT IGNORE INTO prompt_likes (user_id, prompt_id) VALUES (?, ?)',
      [userId, promptId]
    );
    console.log('Result:', result);
    const [warns] = await conn.query('SHOW WARNINGS');
    console.log('Warnings:', warns);

    const [after] = await conn.query(
      'SELECT * FROM prompt_likes WHERE user_id = ? AND prompt_id = ?',
      [userId, promptId]
    );
    console.log('Filas tras INSERT:', after);

    // Recount como hace el servicio
    await conn.execute(
      `UPDATE prompts SET likes_count = (SELECT COUNT(*) FROM prompt_likes WHERE prompt_id = ?) WHERE id = ?`,
      [promptId, promptId]
    );
    const [fresh] = await conn.query('SELECT id, likes_count FROM prompts WHERE id = ?', [promptId]);
    console.log('Después de recount:', fresh);

    // Cleanup — restore to original state
    await conn.execute('DELETE FROM prompt_likes WHERE user_id = ? AND prompt_id = ?', [userId, promptId]);
    await conn.execute(
      `UPDATE prompts SET likes_count = (SELECT COUNT(*) FROM prompt_likes WHERE prompt_id = ?) WHERE id = ?`,
      [promptId, promptId]
    );
    console.log('Cleanup hecho.');
  } catch (e) {
    console.log('ERROR:', e.code, e.errno, e.message);
  }

  await conn.end();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
