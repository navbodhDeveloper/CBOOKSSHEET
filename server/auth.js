// Login / roles for the app. No extra npm packages — uses Node's built-in crypto.
//   admin       : everything + can create / manage Data Entry users
//   data_entry  : everything in the 3 modules (same as admin), but NO user management
const crypto = require('crypto');
const { db, nextId } = require('./db');

const TOKEN_DAYS = 7;
const ROLES = { ADMIN: 'admin', DATA_ENTRY: 'data_entry' };

// ---------- passwords ----------
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(`${salt}:${key.toString('hex')}`)));
  });
}
function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    const [salt, hash] = String(stored || '').split(':');
    if (!salt || !hash) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return resolve(false);
      const a = Buffer.from(hash, 'hex');
      resolve(a.length === key.length && crypto.timingSafeEqual(a, key));
    });
  });
}

// ---------- tokens (signed, stateless) ----------
function secret() { return db.data.auth_secret; }
function b64(buf) { return Buffer.from(buf).toString('base64url'); }
function sign(body) { return crypto.createHmac('sha256', secret()).update(body).digest('base64url'); }

function signToken(user) {
  const body = b64(JSON.stringify({ u: user.id, v: user.token_version || 0, e: Date.now() + TOKEN_DAYS * 86400000 }));
  return `${body}.${sign(body)}`;
}
function readToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.e > Date.now() ? p : null;
  } catch { return null; }
}

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, active: u.active, must_change: !!u.must_change, created_at: u.created_at, created_by: u.created_by || null };
}

// ---------- middleware ----------
function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const p = m && readToken(m[1]);
  const user = p && db.data.users.find(u => u.id === p.u);
  // token_version changes whenever the password is changed/reset, which logs out old sessions
  if (!user || !user.active || (user.token_version || 0) !== p.v) {
    return res.status(401).json({ error: 'Please log in again' });
  }
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== ROLES.ADMIN) return res.status(403).json({ error: 'Only Admin can do this' });
  next();
}

// ---------- first-time setup ----------
// Runs at every start. Adds the users table + signing secret if missing, and if there are
// no users at all, creates the first Admin (username "admin"; password from ADMIN_PASSWORD
// env var, otherwise a random one printed ONCE in the server log).
async function setupAuth() {
  db.data.users ||= [];
  db.data._seq ||= {};
  db.data._seq.users ||= 0;
  let changed = false;
  if (!db.data.auth_secret) { db.data.auth_secret = crypto.randomBytes(48).toString('hex'); changed = true; }
  if (db.data.users.length === 0) {
    const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('hex');
    db.data.users.push({
      id: nextId('users'), username, role: ROLES.ADMIN, active: true,
      password_hash: await hashPassword(password), token_version: 0,
      must_change: !process.env.ADMIN_PASSWORD, created_at: new Date().toISOString(), created_by: null,
    });
    changed = true;
    console.log('==================================================');
    console.log(` FIRST ADMIN CREATED   username: ${username}   password: ${password}`);
    console.log(' Log in and change this password right away.');
    console.log('==================================================');
  }
  if (changed) await db.write();
}

// ---------- login throttling (per IP + username, in memory) ----------
const fails = new Map();
const MAX_FAILS = 5, LOCK_MS = 10 * 60 * 1000;
function lockedFor(key) {
  const f = fails.get(key);
  if (!f || f.count < MAX_FAILS) return 0;
  const left = f.last + LOCK_MS - Date.now();
  if (left <= 0) { fails.delete(key); return 0; }
  return left;
}
function noteFail(key) { const f = fails.get(key) || { count: 0 }; f.count++; f.last = Date.now(); fails.set(key, f); }
function clearFails(key) { fails.delete(key); }

module.exports = { ROLES, hashPassword, verifyPassword, signToken, requireAuth, requireAdmin, setupAuth, publicUser, lockedFor, noteFail, clearFails };