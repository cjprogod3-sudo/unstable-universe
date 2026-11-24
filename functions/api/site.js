// Site settings (featured video, announcement, hidden videos), the admin API,
// and web push notifications for new playlist uploads.
//
// Push uses VAPID with an EMPTY payload, so no message encryption is needed:
// the service worker fetches /api/push/latest to learn what to show.
// The VAPID key pair is generated once and kept in D1, so there are no secrets to set up.

import { ensureSchema, json, sameOrigin, readBody, currentUser, sha256 } from './account.js';
import { handleCatalog } from './catalog.js';

const PLAYLIST_ID = 'PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg';
const VIDEO_ID = /^[\w-]{11}$/;
const NOTIFY_WITHIN_DAYS = 7;

/* ---------- small helpers ---------- */
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = text => b64url(new TextEncoder().encode(text));
async function getConfig(db, key, fallback = null) {
  const row = await db.prepare('SELECT value FROM config WHERE key = ?').bind(key).first();
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}
async function setConfig(db, key, value) {
  await db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, JSON.stringify(value)).run();
}
function adminNames(env) {
  return String(env.ADMIN_USERNAMES || '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
}
async function requireAdmin(db, request, env) {
  const user = await currentUser(db, request);
  if (!user) return {error: json({error: 'Please sign in.'}, 401)};
  if (!adminNames(env).includes(user.username.toLowerCase())) return {error: json({error: 'This page is only for the site admin.'}, 403)};
  return {user};
}
const DEFAULT_SITE = {featured: null, announcement: null, hidden: []};
function cleanSite(input) {
  const site = {...DEFAULT_SITE};
  if (input && typeof input === 'object') {
    if (input.featured && VIDEO_ID.test(input.featured.videoId || '')) site.featured = {videoId: input.featured.videoId, note: String(input.featured.note || '').slice(0, 160)};
    if (input.announcement && String(input.announcement.text || '').trim()) {
      const tone = ['info', 'hype', 'warning'].includes(input.announcement.tone) ? input.announcement.tone : 'info';
      const link = /^https:\/\/[^\s"'<>]{1,300}$/.test(input.announcement.link || '') ? input.announcement.link : '';
      site.announcement = {text: String(input.announcement.text).trim().slice(0, 240), tone, link, id: String(input.announcement.id || Date.now())};
    }
    if (Array.isArray(input.hidden)) site.hidden = [...new Set(input.hidden.filter(id => VIDEO_ID.test(id)))].slice(0, 500);
  }
  return site;
}

/* ---------- VAPID ---------- */
let vapidCache = null;
async function vapidKeys(db) {
  if (vapidCache) return vapidCache;
  const stored = await getConfig(db, 'vapid');
  if (stored) {
    const privateKey = await crypto.subtle.importKey('jwk', stored.privateJwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
    vapidCache = {privateKey, publicKey: stored.publicKey};
    return vapidCache;
  }
  const pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  await db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)').bind('vapid', JSON.stringify({publicKey, privateJwk})).run();
  return vapidKeys(db);
}
async function vapidHeader(db, endpoint, subject) {
  const {privateKey, publicKey} = await vapidKeys(db);
  const header = b64urlText(JSON.stringify({typ: 'JWT', alg: 'ES256'}));
  const claims = b64urlText(JSON.stringify({aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject}));
  const signature = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, privateKey, new TextEncoder().encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${publicKey}`;
}
async function pushTo(db, endpoint, subject, _key) {
  const response = await fetch(endpoint, {method: 'POST', headers: {Authorization: await vapidHeader(db, endpoint, subject), TTL: '86400', Urgency: 'normal', 'Content-Length': '0'}});
  return response.status;
}
export async function sendPushToAll(env, payload) {
  const db = env.DB;
  await ensureSchema(db);
  await setConfig(db, 'last_push', {...payload, sentAt: Date.now()});
  const origin = (await getConfig(db, 'site_origin')) || 'https://example.com';
  const {results} = await db.prepare('SELECT endpoint_hash, endpoint FROM push_subs').all();
  let sent = 0;
  const gone = [];
  const {privateKey} = await vapidKeys(db);
  for (const sub of results || []) {
    try {
      const status = await pushTo(db, sub.endpoint, origin, privateKey);
      if (status === 404 || status === 410) gone.push(sub.endpoint_hash);
      else if (status >= 200 && status < 300) sent += 1;
    } catch { /* one bad endpoint never stops the rest */ }
  }
  for (let index = 0; index < gone.length; index += 90) {
    const chunk = gone.slice(index, index + 90);
    await db.prepare(`DELETE FROM push_subs WHERE endpoint_hash IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).run();
  }
  return {sent, removed: gone.length, total: (results || []).length};
}

/* ---------- new-upload check (cron + admin button) ---------- */
export async function checkForNewUploads(env) {
  if (!env.DB || !env.YOUTUBE_API_KEY) return {skipped: true};
  const db = env.DB;
  await ensureSchema(db);
  const all = [];
  let pageToken = '';
  do {
    const url = new URL('https://internal/api/catalog');
    url.searchParams.set('playlistId', PLAYLIST_ID);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await (await handleCatalog(new Request(url), env)).json();
    if (page.error) throw new Error(page.error);
    all.push(...(page.videos || []).filter(video => !video.unavailable));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  // Known IDs live in ONE config row: the free plan allows only 50 D1 queries per invocation.
  let knownList = await getConfig(db, 'known_ids', null);
  if (!Array.isArray(knownList)) knownList = ((await db.prepare('SELECT id FROM known_videos').all()).results || []).map(row => row.id);
  const known = new Set(knownList);
  const firstRun = known.size === 0;
  const site = cleanSite(await getConfig(db, 'site', DEFAULT_SITE));
  const fresh = all.filter(video => !known.has(video.id));
  const now = Date.now();
  if (fresh.length || !knownList.length) await setConfig(db, 'known_ids', [...known, ...fresh.map(video => video.id)]);
  await setConfig(db, 'last_check', {at: now, total: all.length, added: fresh.length});
  if (firstRun) return {seeded: all.length, videos: all};
  const notify = fresh.filter(video => !site.hidden.includes(video.id) && now - new Date(video.publishedAt).getTime() <= NOTIFY_WITHIN_DAYS * 86400000);
  if (!notify.length) return {added: fresh.length, notified: 0, videos: all};
  notify.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const lead = notify[0];
  const payload = notify.length === 1
    ? {title: `New ${lead.creator} video!`, body: lead.title, url: `/?v=${lead.id}`, image: lead.thumbnail, tag: `upload-${lead.id}`}
    : {title: `${notify.length} new Unstable videos!`, body: notify.slice(0, 3).map(video => `${video.creator}: ${video.title}`).join('\n'), url: '/?list=New+uploads', image: lead.thumbnail, tag: 'uploads'};
  const result = await sendPushToAll(env, payload);
  return {added: fresh.length, notified: notify.length, ...result, videos: all};
}

/* ---------- HTTP ---------- */
export async function handleSite(request, env, ctx) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const method = request.method;
  if (!env.DB) {
    if (path === '/api/site') return json(DEFAULT_SITE);
    return json({error: 'This feature needs the site database.'}, 503);
  }
  const db = env.DB;
  try {
    await ensureSchema(db);
    if (method !== 'GET' && !sameOrigin(request)) return json({error: 'Cross-site request blocked.'}, 403);

    if (path === '/api/site' && method === 'GET') {
      return json(cleanSite(await getConfig(db, 'site', DEFAULT_SITE)), 200, {'Cache-Control': 'public, max-age=30'});
    }

    if (path === '/api/push/key' && method === 'GET') {
      return json({publicKey: (await vapidKeys(db)).publicKey});
    }
    if (path === '/api/push/latest' && method === 'GET') {
      return json((await getConfig(db, 'last_push')) || {title: 'New Unstable video!', body: 'Open the site to watch.', url: '/'});
    }
    if (path === '/api/push/subscribe' && (method === 'POST' || method === 'DELETE')) {
      const body = await readBody(request, 4000);
      const endpoint = String(body.endpoint || body.subscription?.endpoint || '');
      if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint)) return json({error: 'Invalid push subscription.'}, 400);
      const hash = await sha256(endpoint);
      if (method === 'DELETE') {
        await db.prepare('DELETE FROM push_subs WHERE endpoint_hash = ?').bind(hash).run();
        return json({ok: true});
      }
      const user = await currentUser(db, request);
      await db.prepare(`INSERT INTO push_subs (endpoint_hash, endpoint, user_id, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(endpoint_hash) DO UPDATE SET user_id = COALESCE(excluded.user_id, push_subs.user_id)`).bind(hash, endpoint, user ? user.id : null, Date.now()).run();
      await setConfig(db, 'site_origin', new URL(request.url).origin);
      return json({ok: true});
    }

    if (path === '/api/admin/me' && method === 'GET') {
      const user = await currentUser(db, request);
      return json({admin: Boolean(user && adminNames(env).includes(user.username.toLowerCase()))});
    }
    if (path.startsWith('/api/admin/')) {
      const check = await requireAdmin(db, request, env);
      if (check.error) return check.error;
      await setConfig(db, 'site_origin', new URL(request.url).origin);
      if (path === '/api/admin/site' && method === 'PUT') {
        const site = cleanSite(await readBody(request, 40000));
        await setConfig(db, 'site', site);
        return json(site);
      }
      if (path === '/api/admin/stats' && method === 'GET') {
        const users = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
        const subs = await db.prepare('SELECT COUNT(*) AS n FROM push_subs').first();
        const known = await db.prepare('SELECT COUNT(*) AS n FROM known_videos').first();
        return json({users: users.n, subscribers: subs.n, knownVideos: known.n, lastCheck: await getConfig(db, 'last_check'), lastPush: await getConfig(db, 'last_push'), youtubeKey: Boolean(env.YOUTUBE_API_KEY)});
      }
      if (path === '/api/admin/test-push' && method === 'POST') {
        const body = await readBody(request, 4000);
        const endpoint = String(body.endpoint || '');
        const row = endpoint ? await db.prepare('SELECT endpoint FROM push_subs WHERE endpoint_hash = ?').bind(await sha256(endpoint)).first() : null;
        if (!row) return json({error: 'Turn on notifications on this device first.'}, 400);
        await setConfig(db, 'last_push', {title: 'Test notification', body: 'Notifications are working on this device.', url: '/', tag: 'test', sentAt: Date.now()});
        const status = await pushTo(db, row.endpoint, new URL(request.url).origin);
        return json({ok: status >= 200 && status < 300, status});
      }
      if (path === '/api/admin/check-now' && method === 'POST') {
        const {videos: _videos, ...summary} = await checkForNewUploads(env);
        return json(summary);
      }
    }
    return json({error: 'Not found.'}, 404);
  } catch (error) {
    return json({error: error.status ? error.message : `Server error: ${error.message || 'unknown'}`}, error.status || 500);
  }
}
