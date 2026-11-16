const express = require('express');
const router = express.Router();
const { db } = require('../db');
const A = require('../auth');

router.post('/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Enter username and password' });

  const key = `${req.ip}|${username}`;
  const wait = A.lockedFor(key);
  if (wait) return res.status(429).json({ error: `Too many wrong attempts. Try again in ${Math.ceil(wait / 60000)} minute(s).` });

  const user = db.data.users.find(u => u.username === username);
  const ok = user && user.active && (await A.verifyPassword(password, user.password_hash));
  if (!ok) {
    A.noteFail(key);
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  A.clearFails(key);
  res.json({ token: A.signToken(user), user: A.publicUser(user) });
});

router.get('/me', A.requireAuth, (req, res) => res.json({ user: A.publicUser(req.user) }));

router.post('/change-password', A.requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!(await A.verifyPassword(String(current_password || ''), req.user.password_hash))) {
    return res.status(400).json({ error: 'Current password is wrong' });
  }
  if (String(new_password || '').length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  req.user.password_hash = await A.hashPassword(String(new_password));
  req.user.token_version = (req.user.token_version || 0) + 1; // logs out every other session
  req.user.must_change = false;
  await db.write();
  res.json({ token: A.signToken(req.user), user: A.publicUser(req.user) });
});

module.exports = router;