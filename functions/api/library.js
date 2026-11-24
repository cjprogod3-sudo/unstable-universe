// The Library: a copy of the Unstable Universe Wiki (Fandom, CC BY-SA 3.0).
//
// The wiki is read and parsed in the admin's browser (see dist/library.js), which
// has no CPU or request limits, and the finished pages are uploaded here in small
// batches. This Worker only stores and serves them:
//   GET  /api/library                 → the index (every page's title, type, summary, image)
//   GET  /api/library/page?t=Title    → one full page (infobox + sections)
//   POST /api/admin/library/pages     → admin: store up to 20 parsed pages {run, pages}
//   POST /api/admin/library/commit    → admin: publish the index for that run, drop old pages
//   GET  /api/admin/wiki?…            → admin: relay to the wiki's API, used only when the
//                                       browser can't reach the wiki directly
import { ensureSchema, json, sameOrigin, readBody, currentUser } from './account.js';

const WIKI_API = 'https://unstable-universe-mc.fandom.com/api.php';
const INDEX_KEY = 'library_v2';
const MAX_PAGES_PER_UPLOAD = 20;
const MAX_PAGE_BYTES = 1_500_000;
const MAX_INDEX_BYTES = 1_800_000;
const USER_AGENT = 'UnstableUniverseExperience/2.0 (unofficial fan site; library import)';

let tableReady = null;
function ensureTable(db) {
  if (!tableReady) {
    tableReady = db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS wiki_pages (title TEXT PRIMARY KEY COLLATE NOCASE, data TEXT NOT NULL, run TEXT NOT NULL, updated INTEGER NOT NULL)'),
      db.prepare('CREATE INDEX IF NOT EXISTS wiki_pages_run ON wiki_pages (run)')
    ]).catch(error => { tableReady = null; throw error; });
  }
  return tableReady;
}
async function requireAdmin(db, request, env) {
  const user = await currentUser(db, request);
  const admins = String(env.ADMIN_USERNAMES || '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
  if (!user || !admins.includes(user.username.toLowerCase())) throw Object.assign(new Error('Admins only.'), {status: 403});
  return user;
}
const RUN = /^[a-z0-9-]{6,40}$/;

export async function handleLibrary(request, env) {
  if (!env.DB) return json({error: 'The library needs the site database.'}, 503);
  const db = env.DB;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  try {
    await ensureSchema(db);
    await ensureTable(db);

    if (path === '/api/library' && request.method === 'GET') {
      const row = await db.prepare('SELECT value FROM config WHERE key = ?').bind(INDEX_KEY).first();
      if (!row) return json({empty: true}, 200, {'Cache-Control': 'no-store'});
      return new Response(row.value, {headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=120'}});
    }

    if (path === '/api/library/page' && request.method === 'GET') {
      const title = String(url.searchParams.get('t') || '').slice(0, 300);
      if (!title) return json({error: 'Which page?'}, 400);
      const row = await db.prepare('SELECT data FROM wiki_pages WHERE title = ?').bind(title).first();
      if (!row) return json({error: 'That page is not in the library.'}, 404);
      return new Response(row.data, {headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300'}});
    }

    if (path === '/api/admin/library/pages' && request.method === 'POST') {
      if (!sameOrigin(request)) return json({error: 'Cross-site request blocked.'}, 403);
      await requireAdmin(db, request, env);
      const body = await readBody(request, 12_000_000);
      const run = String(body.run || '');
      if (!RUN.test(run)) return json({error: 'Bad import id.'}, 400);
      const pages = Array.isArray(body.pages) ? body.pages.slice(0, MAX_PAGES_PER_UPLOAD) : [];
      const now = Date.now();
      const statements = [];
      for (const page of pages) {
        const title = String(page?.t || '').slice(0, 300);
        if (!title) continue;
        let data = JSON.stringify(page);
        if (data.length > MAX_PAGE_BYTES) {
          // Very long pages keep their infobox and as many sections as fit.
          const trimmed = {...page, sections: [], trimmed: true};
          for (const section of page.sections || []) {
            if (JSON.stringify(trimmed).length + JSON.stringify(section).length > MAX_PAGE_BYTES) break;
            trimmed.sections.push(section);
          }
          data = JSON.stringify(trimmed);
        }
        statements.push(db.prepare('INSERT INTO wiki_pages (title, data, run, updated) VALUES (?, ?, ?, ?) ON CONFLICT(title) DO UPDATE SET data = excluded.data, run = excluded.run, updated = excluded.updated').bind(title, data, run, now));
      }
      if (statements.length) await db.batch(statements);
      return json({ok: true, stored: statements.length});
    }

    if (path === '/api/admin/library/commit' && request.method === 'POST') {
      if (!sameOrigin(request)) return json({error: 'Cross-site request blocked.'}, 403);
      await requireAdmin(db, request, env);
      const body = await readBody(request, 4_000_000);
      const run = String(body.run || '');
      if (!RUN.test(run)) return json({error: 'Bad import id.'}, 400);
      const index = body.index;
      if (!index || !Array.isArray(index.pages) || index.pages.length < 1) return json({error: 'The import came back empty, so the current library was kept.'}, 400);
      const stored = await db.prepare('SELECT COUNT(*) AS n FROM wiki_pages WHERE run = ?').bind(run).first();
      // Refuse a half-finished import instead of publishing a broken library.
      if ((stored?.n || 0) < Math.floor(index.pages.length * 0.9)) return json({error: `Only ${stored?.n || 0} of ${index.pages.length} pages were saved. Try the update again.`}, 409);
      const value = JSON.stringify({...index, version: 2, run, publishedAt: new Date().toISOString()});
      if (value.length > MAX_INDEX_BYTES) return json({error: 'The library index is too large to store.'}, 413);
      await db.batch([
        db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(INDEX_KEY, value),
        db.prepare('DELETE FROM wiki_pages WHERE run != ?').bind(run),
        db.prepare("DELETE FROM config WHERE key IN ('library', 'library_status')")
      ]);
      return json({ok: true, pages: index.pages.length});
    }

    if (path === '/api/admin/wiki' && request.method === 'GET') {
      await requireAdmin(db, request, env);
      const params = new URLSearchParams(url.search);
      if (!['query', 'parse'].includes(params.get('action'))) return json({error: 'Only read requests are relayed.'}, 400);
      params.set('format', 'json');
      params.delete('origin');
      const response = await fetch(`${WIKI_API}?${params}`, {headers: {'User-Agent': USER_AGENT, Accept: 'application/json'}});
      return new Response(response.body, {status: response.status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
    }

    return json({error: 'Not found.'}, 404);
  } catch (error) {
    return json({error: error.message || 'Library error.'}, error.status || 500);
  }
}
