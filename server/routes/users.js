// Admin-only: manage Data Entry users. (Mounted behind requireAuth in server.js.)
const express = require('express');
const router = express.Router();
const { db, nextId } = require('../db');
const A = require('../auth');

router.use(A.requireAdmin);

router.get('/', (req, res) => {
  res.json(db.data.users.map(A.publicUser).sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === 'admin' ? -1 : 1)));
});

router.post('/', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return res.status(400).json({ error: 'Username: 3-30 letters/numbers (a-z, 0-9, . _ -), no spaces' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (db.data.users.some(u => u.username === username)) return res.status(409).json({ error: 'This username already exists' });
  const user = {
    id: nextId('users'), username, role: A.ROLES.DATA_ENTRY, active: true,
    password_hash: await A.hashPassword(password), token_version: 0, must_change: false,
    created_at: new Date().toISOString(), created_by: req.user.username,
  };
  db.data.users.push(user);
  await db.write();
  res.status(201).json(A.publicUser(user));
});

// Reset password and/or enable/disable a Data Entry user
router.put('/:id', async (req, res) => {
  const user = db.data.users.find(u => String(u.id) === String(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === A.ROLES.ADMIN) return res.status(400).json({ error: 'Admin account can only be changed by Admin from Change Password' });
  const { password, active } = req.body || {};
  if (password !== undefined) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    user.password_hash = await A.hashPassword(String(password));
    user.token_version = (user.token_version || 0) + 1;
  }
  if (active !== undefined) {
    user.active = !!active;
    if (!user.active) user.token_version = (user.token_version || 0) + 1;
  }
  await db.write();
  res.json(A.publicUser(user));
});

router.delete('/:id', async (req, res) => {
  const i = db.data.users.findIndex(u => String(u.id) === String(req.params.id));
  if (i === -1) return res.status(404).json({ error: 'User not found' });
  if (db.data.users[i].role === A.ROLES.ADMIN) return res.status(400).json({ error: 'Admin cannot be deleted' });
  db.data.users.splice(i, 1);
  await db.write();
  res.status(204).end();
});

module.exports = router;