'use strict';

const userService = require('../services/userService');
const authService = require('../services/authService');
const { setAuthCookie, clearAuthCookie } = require('../utils/cookies');
const { Conflict, Unauthorized } = require('../utils/httpErrors');

async function register(req, res) {
  const { name, username, email, password } = req.body;

  const [existingEmail, existingUsername] = await Promise.all([
    userService.findByEmail(email),
    userService.findByUsername(username),
  ]);
  if (existingEmail) throw Conflict('Ese correo ya está registrado');
  if (existingUsername) throw Conflict('Ese nombre de usuario ya está en uso');

  const password_hash = await authService.hashPassword(password);
  const user = await userService.createUser({ name, username, email, password_hash });

  const token = authService.signToken(user.id, { role: user.role_name });
  setAuthCookie(res, token);

  return res.status(201).json({ data: { user: authService.publicUser(user) } });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await userService.findByEmail(email);
  if (!user) throw Unauthorized('Credenciales inválidas');

  const ok = await authService.comparePassword(password, user.password_hash);
  if (!ok) throw Unauthorized('Credenciales inválidas');

  if (user.status !== 'active') throw Unauthorized('La cuenta no está activa');

  const token = authService.signToken(user.id, { role: user.role_name });
  setAuthCookie(res, token);

  return res.json({ data: { user: authService.publicUser(user) } });
}

async function logout(_req, res) {
  clearAuthCookie(res);
  return res.json({ data: { ok: true } });
}

async function me(req, res) {
  return res.json({ data: { user: authService.publicUser(req.user) } });
}

module.exports = { register, login, logout, me };
