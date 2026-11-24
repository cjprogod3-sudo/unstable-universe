// The Unstable Library: a searchable copy of the Unstable Universe wiki's
// History page plus the item / character / location pages it links to.
//
// Source: https://unstable-universe-mc.fandom.com (text licensed CC BY-SA 3.0).
// We use the official MediaWiki API, keep attribution and links to every
// source page, and store the result in ONE D1 config row (free plan: 50
// queries per invocation). Refreshed daily by the cron or on demand by the admin.

import { ensureSchema, json, sameOrigin, currentUser } from './account.js';

export const WIKI_ORIGIN = 'https://unstable-universe-mc.fandom.com';
export const HISTORY_PAGE = 'Unstable_Universe/History';
const EXTRA_CATEGORIES = ['Category:Items', 'Category:Weapons'];
const MAX_LINKED_PAGES = 100;
const USER_AGENT = 'UnstableUniverseExperience/1.0 (unofficial fan site; library sync; contact via site admin)';
const LIBRARY_KEY = 'library';
const REFRESH_EVERY_MS = 24 * 3600 * 1000;
const RETRY_AFTER_FAIL_MS = 15 * 60 * 1000;

/* ---------- wikitext → plain text ---------- */
const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“'};
function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') { const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : match; }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}
// Short inline templates ({{Date|2025}}, {{Tooltip|Density V|...}}) keep their first
// plain argument; block templates (quotes, infoboxes, navboxes, notices) are dropped.
const BLOCK_TEMPLATE = /^(quote|infobox|nav|main|see ?also|cite|ref|stub|cleanup|spoiler|gallery|clear|toc|tabber|about|for|other|distinguish|delete|disambig|character|item|weapon|location|armou?r|series|season)/i;
export function removeTemplates(text) {
  let previous;
  let output = text;
  let guard = 0;
  do {
    previous = output;
    output = output.replace(/\{\{((?:[^{}]|\{(?!\{)|\}(?!\}))*)\}\}/g, (all, inner) => {
      if (inner.includes('\n') || inner.length > 160) return '';
      const parts = inner.split('|').map(part => part.trim());
      const name = parts.shift() || '';
      if (BLOCK_TEMPLATE.test(name)) return '';
      const positional = parts.find(part => part && !/^[\w ]+=/.test(part));
      return positional || '';
    });
    guard += 1;
  } while (output !== previous && guard < 25);
  return output;
}
function removeTables(text) {
  let previous;
  let output = text;
  let guard = 0;
  do { previous = output; output = output.replace(/\{\|(?:(?!\{\|)[\s\S])*?\|\}/g, ''); guard += 1; } while (output !== previous && guard < 15);
  return output;
}
const SKIP_NAMESPACES = /^(file|image|category|template|user|user talk|talk|special|help|media|mediawiki|wikipedia|w|message wall|thread|board|blog|forum|module):/i;
export function normalizeTitle(raw) {
  const title = decodeEntities(String(raw || '')).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return title ? title[0].toUpperCase() + title.slice(1) : '';
}
export function linksIn(wikitext) {
  const found = [];
  const pattern = /\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|[^\[\]]*)?\]\]/g;
  let match;
  while ((match = pattern.exec(wikitext))) {
    const title = normalizeTitle(match[1]);
    if (title && !SKIP_NAMESPACES.test(title) && !title.startsWith(':')) found.push(title);
  }
  return found;
}
export function plainText(wikitext) {
  let text = String(wikitext || '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  text = text.replace(/<(gallery|tabber|tabview|mainpage-[a-z-]+|div class="?toc[^>]*)[^>]*>[\s\S]*?<\/\1>/gi, '');
  text = removeTables(removeTemplates(text));
  text = text.replace(/\[\[([^\[\]|]+)\|([^\[\]]*)\]\]/g, (all, target, label) => (SKIP_NAMESPACES.test(target.trim()) ? all : label));
  text = text.replace(/\[\[([^\[\]|]+)\]\]/g, (all, target) => (SKIP_NAMESPACES.test(target.trim()) ? all : target.replace(/#.*/, '')));
  let previous;
  do { previous = text; text = text.replace(/\[\[(?:file|image|category|media):[^\[\]]*\]\]/gi, ''); } while (text !== previous);
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/[^\]]+\]/g, '');
  text = text.replace(/'{2,5}/g, '').replace(/__[A-Z]+__/g, '');
  text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  return decodeEntities(text);
}
function cleanLine(line) {
  return plainText(line).replace(/^[*#:;]+\s*/, '').replace(/\s+/g, ' ').trim();
}
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';

// Split a page into sections by == headings ==, keeping paragraphs and bullets.
export function parseSections(wikitext) {
  const source = removeTables(removeTemplates(String(wikitext || '').replace(/<!--[\s\S]*?-->/g, '')));
  const lines = source.split(/\r?\n/);
  const sections = [];
  const stack = [];
  const used = new Map();
  let current = {id: 'intro', title: 'Overview', level: 1, path: [], blocks: [], links: []};
  let paragraph = [];
  const flush = () => {
    const text = paragraph.map(cleanLine).filter(Boolean).join(' ').trim();
    if (text) current.blocks.push({type: 'p', text: text.slice(0, 1600)});
    paragraph = [];
  };
  const close = () => { flush(); if (current.blocks.length || current.level > 1) sections.push(current); };
  for (const raw of lines) {
    const heading = raw.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
    if (heading) {
      close();
      const level = heading[1].length;
      const title = cleanLine(heading[2]) || 'Untitled';
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      let id = slug(title);
      const count = used.get(id) || 0;
      used.set(id, count + 1);
      if (count) id = `${id}-${count + 1}`;
      current = {id, title, level, path: stack.map(entry => entry.title), blocks: [], links: []};
      stack.push({level, title});
      continue;
    }
    current.links.push(...linksIn(raw));
    if (/^\s*[*#]/.test(raw)) { flush(); const text = cleanLine(raw); if (text) current.blocks.push({type: 'li', text: text.slice(0, 800), depth: (raw.match(/^\s*([*#]+)/)?.[1].length || 1)}); continue; }
    if (!raw.trim()) { flush(); continue; }
    if (/^\s*\[\[(file|image):/i.test(raw)) continue;
    paragraph.push(raw);
  }
  close();
  for (const section of sections) section.links = [...new Set(section.links)].slice(0, 40);
  return sections.filter(section => section.blocks.length || sections.some(other => other.path.includes(section.title)));
}

// Infobox fields from the first {{...}} template that has named parameters.
export function infoboxFields(wikitext) {
  const text = String(wikitext || '');
  const start = text.search(/\{\{\s*[^{}|]*(infobox|item|character|weapon|location|armor)[^{}|]*\|/i);
  if (start < 0) return {};
  let depth = 0;
  let end = start;
  for (let index = start; index < text.length - 1; index += 1) {
    if (text[index] === '{' && text[index + 1] === '{') { depth += 1; index += 1; }
    else if (text[index] === '}' && text[index + 1] === '}') { depth -= 1; index += 1; if (depth === 0) { end = index + 1; break; } }
  }
  const body = text.slice(start + 2, end - 2);
  const fields = {};
  let level = 0;
  let piece = '';
  const parts = [];
  for (let index = 0; index < body.length; index += 1) {
    const two = body.slice(index, index + 2);
    if (two === '{{' || two === '[[') { level += 1; piece += two; index += 1; continue; }
    if (two === '}}' || two === ']]') { level -= 1; piece += two; index += 1; continue; }
    if (body[index] === '|' && level === 0) { parts.push(piece); piece = ''; continue; }
    piece += body[index];
  }
  parts.push(piece);
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    if (!key || /^(image|caption|title|imagewidth|image_size|align|width|name)$/.test(key)) continue;
    const value = plainText(part.slice(eq + 1)).replace(/\s+/g, ' ').trim();
    if (value && value.length <= 200) fields[key.replace(/_/g, ' ')] = value;
    if (Object.keys(fields).length >= 10) break;
  }
  return fields;
}
export function classify(title, categories, wikitext) {
  const haystack = `${categories.join(' ')} ${(String(wikitext).match(/\{\{\s*([^|}\n]+)/) || [])[1] || ''}`.toLowerCase();
  if (/item|weapon|armou?r|artifact|artefact|tool|enchant|relic|mace|sword|totem/.test(haystack)) return 'item';
  if (/character|player|people|member|villain|protagonist|antagonist/.test(haystack)) return 'character';
  if (/location|place|base|structure|build|city|town|island|dimension|vault/.test(haystack)) return 'location';
  if (/event|battle|war|arc|conflict|history|season|episode/.test(haystack)) return 'event';
  if (/faction|group|organi[sz]ation|nation|empire|mafia|team|alliance/.test(haystack)) return 'faction';
  if (/^(the )?(battle|war|siege|trial|fall|attack) /i.test(title)) return 'event';
  return 'other';
}
export function pageSummary(wikitext) {
  const sections = parseSections(wikitext);
  const intro = sections.find(section => section.id === 'intro') || sections[0];
  const paragraphs = (intro?.blocks || []).filter(block => block.type === 'p').map(block => block.text);
  const summary = paragraphs.join(' ').slice(0, 700);
  const more = sections.filter(section => section.id !== 'intro').slice(0, 6).map(section => ({title: section.title, text: section.blocks.map(block => block.text).join(' ').slice(0, 500)})).filter(section => section.text);
  return {summary, more};
}

/* ---------- MediaWiki API ---------- */
async function wikiApi(params) {
  const url = new URL(`${WIKI_ORIGIN}/api.php`);
  url.search = new URLSearchParams({format: 'json', formatversion: '2', ...params});
  const response = await fetch(url, {headers: {'User-Agent': USER_AGENT, Accept: 'application/json'}});
  if (!response.ok) throw Object.assign(new Error(`The wiki answered ${response.status}`), {status: 502, wikiStatus: response.status});
  const data = await response.json().catch(() => null);
  if (!data) throw Object.assign(new Error('The wiki did not return JSON'), {status: 502});
  if (data.error) throw Object.assign(new Error(`Wiki error: ${data.error.info || data.error.code}`), {status: 502});
  return data;
}
async function fetchPages(titles) {
  const data = await wikiApi({action: 'query', prop: 'revisions|categories', rvprop: 'content|timestamp|ids', rvslots: 'main', titles: titles.join('|'), redirects: '1', cllimit: 'max', clshow: '!hidden'});
  return (data.query?.pages || []).filter(page => !page.missing && page.revisions?.length).map(page => ({
    title: page.title,
    content: page.revisions[0].slots?.main?.content ?? page.revisions[0].content ?? '',
    timestamp: page.revisions[0].timestamp,
    revid: page.revisions[0].revid,
    categories: (page.categories || []).map(category => category.title.replace(/^Category:/, ''))
  }));
}
export const pageUrl = title => `${WIKI_ORIGIN}/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`;

export async function buildLibrary() {
  const [history] = await fetchPages([HISTORY_PAGE]);
  if (!history) throw Object.assign(new Error(`The page "${HISTORY_PAGE}" was not found on the wiki.`), {status: 404});
  const sections = parseSections(history.content);
  const mentions = new Map();
  for (const section of sections) for (const link of section.links) mentions.set(link, (mentions.get(link) || 0) + 1);
  for (const category of EXTRA_CATEGORIES) {
    try {
      const data = await wikiApi({action: 'query', list: 'categorymembers', cmtitle: category, cmlimit: '100', cmnamespace: '0'});
      for (const member of data.query?.categorymembers || []) if (!mentions.has(member.title)) mentions.set(member.title, 0);
    } catch { /* the category may not exist on this wiki */ }
  }
  const wanted = [...mentions.entries()].sort((a, b) => b[1] - a[1]).map(([title]) => title).filter(title => title !== normalizeTitle(HISTORY_PAGE)).slice(0, MAX_LINKED_PAGES);
  const pages = [];
  for (let index = 0; index < wanted.length; index += 50) {
    try { pages.push(...await fetchPages(wanted.slice(index, index + 50))); } catch { /* keep what we have */ }
  }
  const seen = new Set();
  const records = pages.filter(page => !/^#redirect/i.test(page.content) && !seen.has(page.title) && seen.add(page.title)).map(page => {
    const {summary, more} = pageSummary(page.content);
    return {title: page.title, type: classify(page.title, page.categories, page.content), summary, more, fields: infoboxFields(page.content), categories: page.categories.slice(0, 8), url: pageUrl(page.title), updated: page.timestamp, mentions: mentions.get(page.title) || 0};
  }).filter(page => page.summary || Object.keys(page.fields).length);
  const library = {
    source: {site: WIKI_ORIGIN, page: HISTORY_PAGE, url: pageUrl(HISTORY_PAGE), revid: history.revid, updated: history.timestamp},
    license: {name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/'},
    fetchedAt: Date.now(),
    sections: sections.map(section => ({...section, url: `${pageUrl(HISTORY_PAGE)}#${encodeURIComponent(section.title.replace(/ /g, '_'))}`})),
    pages: records
  };
  let payload = JSON.stringify(library);
  while (payload.length > 1_800_000 && library.pages.length) { library.pages.pop(); payload = JSON.stringify(library); }
  return library;
}

async function getConfigRaw(db, key) {
  const row = await db.prepare('SELECT value FROM config WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}
async function setConfigRaw(db, key, value) {
  await db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}
export async function refreshLibrary(env) {
  const db = env.DB;
  await ensureSchema(db);
  try {
    const library = await buildLibrary();
    await setConfigRaw(db, LIBRARY_KEY, JSON.stringify(library));
    await setConfigRaw(db, 'library_status', JSON.stringify({ok: true, at: Date.now(), sections: library.sections.length, pages: library.pages.length}));
    return {ok: true, sections: library.sections.length, pages: library.pages.length, revid: library.source.revid};
  } catch (error) {
    await setConfigRaw(db, 'library_status', JSON.stringify({ok: false, at: Date.now(), error: error.message}));
    return {ok: false, error: error.message};
  }
}
export async function libraryIsStale(env) {
  const raw = await getConfigRaw(env.DB, 'library_status');
  const status = raw ? JSON.parse(raw) : null;
  if (!status) return true;
  return Date.now() - status.at > (status.ok ? REFRESH_EVERY_MS : RETRY_AFTER_FAIL_MS);
}

export async function handleLibrary(request, env) {
  if (!env.DB) return json({error: 'The library needs the site database.'}, 503);
  const db = env.DB;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  try {
    await ensureSchema(db);
    if (path === '/api/library' && request.method === 'GET') {
      let raw = await getConfigRaw(db, LIBRARY_KEY);
      if (!raw && await libraryIsStale(env)) { await refreshLibrary(env); raw = await getConfigRaw(db, LIBRARY_KEY); }
      const statusRaw = await getConfigRaw(db, 'library_status');
      if (!raw) return json({empty: true, status: statusRaw ? JSON.parse(statusRaw) : null, source: {url: pageUrl(HISTORY_PAGE)}}, 200, {'Cache-Control': 'no-store'});
      return new Response(raw.replace(/}$/, `,"status":${statusRaw || 'null'}}`), {headers: {'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300'}});
    }
    if (path === '/api/admin/library/refresh' && request.method === 'POST') {
      if (!sameOrigin(request)) return json({error: 'Cross-site request blocked.'}, 403);
      const user = await currentUser(db, request);
      const admins = String(env.ADMIN_USERNAMES || '').split(',').map(name => name.trim().toLowerCase());
      if (!user || !admins.includes(user.username.toLowerCase())) return json({error: 'Admins only.'}, 403);
      return json(await refreshLibrary(env));
    }
    return json({error: 'Not found.'}, 404);
  } catch (error) {
    return json({error: error.message || 'Library error.'}, error.status || 500);
  }
}
