// Accounts + cross-device profile sync, stored in Cloudflare D1 (binding: DB).
// Passwords: PBKDF2-SHA256 with a per-user salt. Sessions: random token in an
// HttpOnly cookie; only its SHA-256 hash is stored. Mutating requests must come
// from this site's own origin.

const COOKIE = 'uu_session';
const SESSION_DAYS = 60;
const PBKDF2_ITERATIONS = 100000;
const MAX_PROFILE_BYTES = 300_000;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, iterations INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)`
];
let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) schemaReady = db.batch(SCHEMA.map(sql => db.prepare(sql))).catch(error => { schemaReady = null; throw error; });
  return schemaReady;
}

const encoder = new TextEncoder();
const toHex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const fromHex = hex => new Uint8Array(hex.match(/../g).map(pair => parseInt(pair, 16)));
const randomHex = bytes => toHex(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256 = async text => toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));

async function hashPassword(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations}, key, 256);
  return toHex(bits);
}
function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders}});
}
function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return token
    ? `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`
    : `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
function readCookie(request) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return match ? match[1] : '';
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}
async function readBody(request, limit) {
  const text = await request.text();
  if (text.length > limit) throw Object.assign(new Error('Request is too large.'), {status: 413});
  try { return JSON.parse(text || '{}'); } catch { throw Object.assign(new Error('Invalid JSON.'), {status: 400}); }
}
function validateCredentials(body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!USERNAME.test(username)) return {error: 'Usernames are 3–20 letters, numbers, or underscores.'};
  if (password.length < 8) return {error: 'Passwords need at least 8 characters.'};
  if (password.length > 200) return {error: 'That password is too long.'};
  return {username, password};
}

async function rateLimited(db, key) {
  const now = Date.now();
  const row = await db.prepare('SELECT count, window_start FROM login_attempts WHERE key = ?').bind(key).first();
  if (!row || now - row.window_start > LOGIN_WINDOW_MS) return false;
  return row.count >= LOGIN_LIMIT;
}
async function recordFailure(db, key) {
  const now = Date.now();
  await db.prepare(`INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN ? - window_start > ? THEN 1 ELSE count + 1 END,
    window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END`).bind(key, now, now, LOGIN_WINDOW_MS, now, LOGIN_WINDOW_MS, now).run();
}

async function startSession(db, userId, request) {
  const token = randomHex(32);
  const now = Date.now();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), userId, now, now + SESSION_DAYS * 86400000).run();
  return sessionCookie(token, request);
}
async function currentUser(db, request) {
  const token = readCookie(request);
  if (!token) return null;
  const row = await db.prepare(`SELECT users.id, users.username, sessions.token_hash FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).bind(await sha256(token), Date.now()).first();
  return row || null;
}
async function profilePayload(db, user) {
  const row = await db.prepare('SELECT data, updated_at FROM profiles WHERE user_id = ?').bind(user.id).first();
  return {user: {username: user.username}, profile: row ? JSON.parse(row.data) : null, updatedAt: row ? row.updated_at : 0};
}

export async function handleAccount(request, env) {
  if (!env.DB) return json({error: 'Accounts are not set up on this site yet.', setup: false}, 503);
  const db = env.DB;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const method = request.method;
  try {
    await ensureSchema(db);
    if (method !== 'GET' && !sameOrigin(request)) return json({error: 'Cross-site request blocked.'}, 403);

    if (path === '/api/account/me' && method === 'GET') {
      const user = await currentUser(db, request);
      if (!user) return json({user: null}, 200);
      return json(await profilePayload(db, user));
    }

    if (path === '/api/account/register' && method === 'POST') {
      const credentials = validateCredentials(await readBody(request, 2000));
      if (credentials.error) return json({error: credentials.error}, 400);
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      if (await rateLimited(db, `register:${ip}`)) return json({error: 'Too many new accounts from this network. Try again in 15 minutes.'}, 429);
      const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(credentials.username).first();
      if (existing) return json({error: 'That username is taken.'}, 409);
      const id = randomHex(16);
      const salt = randomHex(16);
      const hash = await hashPassword(credentials.password, salt);
      try {
        await db.prepare('INSERT INTO users (id, username, pass_hash, salt, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, credentials.username, hash, salt, PBKDF2_ITERATIONS, Date.now()).run();
      } catch {
        return json({error: 'That username is taken.'}, 409);
      }
      await recordFailure(db, `register:${ip}`);
      const cookie = await startSession(db, id, request);
      return json({user: {username: credentials.username}, profile: null, updatedAt: 0}, 201, {'Set-Cookie': cookie});
    }

    if (path === '/api/account/login' && method === 'POST') {
      const body = await readBody(request, 2000);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      const limitKey = `login:${username.toLowerCase()}:${ip}`;
      if (await rateLimited(db, limitKey)) return json({error: 'Too many attempts. Try again in 15 minutes.'}, 429);
      const user = USERNAME.test(username) ? await db.prepare('SELECT id, username, pass_hash, salt, iterations FROM users WHERE username = ?').bind(username).first() : null;
      const hash = await hashPassword(password.slice(0, 200), user ? user.salt : randomHex(16), user ? user.iterations : PBKDF2_ITERATIONS);
      if (!user || !sameString(hash, user.pass_hash)) {
        await recordFailure(db, limitKey);
        return json({error: 'Wrong username or password.'}, 401);
      }
      await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(limitKey).run();
      await db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(user.id, Date.now()).run();
      const cookie = await startSession(db, user.id, request);
      return json(await profilePayload(db, user), 200, {'Set-Cookie': cookie});
    }

    if (path === '/api/account/logout' && method === 'POST') {
      const token = readCookie(request);
      if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
      return json({ok: true}, 200, {'Set-Cookie': sessionCookie('', request)});
    }

    if (path === '/api/account/profile' && method === 'PUT') {
      const user = await currentUser(db, request);
      if (!user) return json({error: 'Please sign in again.'}, 401);
      const body = await readBody(request, MAX_PROFILE_BYTES + 1000);
      if (!body.profile || typeof body.profile !== 'object' || Array.isArray(body.profile)) return json({error: 'Profile must be an object.'}, 400);
      const data = JSON.stringify(body.profile);
      if (data.length > MAX_PROFILE_BYTES) return json({error: 'Profile is too large to sync.'}, 413);
      const base = Number(body.baseUpdatedAt) || 0;
      const row = await db.prepare('SELECT updated_at, data FROM profiles WHERE user_id = ?').bind(user.id).first();
      if (row && row.updated_at !== base) return json({error: 'conflict', profile: JSON.parse(row.data), updatedAt: row.updated_at}, 409);
      const updatedAt = Math.max(Date.now(), (row?.updated_at || 0) + 1);
      const result = row
        ? await db.prepare('UPDATE profiles SET data = ?, updated_at = ? WHERE user_id = ? AND updated_at = ?').bind(data, updatedAt, user.id, base).run()
        : await db.prepare('INSERT OR IGNORE INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)').bind(user.id, data, updatedAt).run();
      if (!result.meta || result.meta.changes !== 1) {
        const latest = await db.prepare('SELECT updated_at, data FROM profiles WHERE user_id = ?').bind(user.id).first();
        return json({error: 'conflict', profile: latest ? JSON.parse(latest.data) : null, updatedAt: latest ? latest.updated_at : 0}, 409);
      }
      return json({ok: true, updatedAt});
    }

    if (path === '/api/account' && method === 'DELETE') {
      const user = await currentUser(db, request);
      if (!user) return json({error: 'Please sign in again.'}, 401);
      const body = await readBody(request, 2000);
      const record = await db.prepare('SELECT pass_hash, salt, iterations FROM users WHERE id = ?').bind(user.id).first();
      const hash = await hashPassword(String(body.password || '').slice(0, 200), record.salt, record.iterations);
      if (!sameString(hash, record.pass_hash)) return json({error: 'That password is not right.'}, 401);
      await db.batch([
        db.prepare('DELETE FROM profiles WHERE user_id = ?').bind(user.id),
        db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
        db.prepare('DELETE FROM users WHERE id = ?').bind(user.id)
      ]);
      return json({ok: true}, 200, {'Set-Cookie': sessionCookie('', request)});
    }

    return json({error: 'Not found.'}, 404);
  } catch (error) {
    return json({error: error.status ? error.message : 'Account service error. Please try again.'}, error.status || 500);
  }
}
