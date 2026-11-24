'use strict';
/* ==========================================================================
   Unstable Universe Experience: the Library (loaded after app.js).

   - The End portal you walk through to get here (real Minecraft textures, 3D).
   - The import: the admin's browser reads every article on the Unstable Universe
     Wiki through the MediaWiki API, parses the rendered HTML with a real DOM
     parser, and uploads the pages to /api/admin/library/*. Everyone else just
     reads /api/library (the index) and /api/library/page?t= (one page).
   - The views: Browse, Timeline (the wiki's History page) and the page reader.

   Wiki text is CC BY-SA 3.0; every page credits and links its source.
   ========================================================================== */

const WIKI_ORIGIN = 'https://unstable-universe-mc.fandom.com';
const WIKI_API = `${WIKI_ORIGIN}/api.php`;
const HISTORY_TITLE = 'Unstable Universe/History';
const BLOCK_ROOT = ITEM_ROOT.replace('/item/', '/block/');
const LIBRARY_STALE_MS = 24 * 60 * 60 * 1000;

const LIB_TYPES = {
  character: {label: 'Characters', one: 'Character', icon: 'name_tag.png'},
  item: {label: 'Items & weapons', one: 'Item', icon: 'mace.png'},
  location: {label: 'Places', one: 'Place', icon: 'filled_map.png'},
  event: {label: 'Events', one: 'Event', icon: 'clock_00.png'},
  group: {label: 'Groups', one: 'Group', icon: 'goat_horn.png'},
  lore: {label: 'Seasons & lore', one: 'Lore', icon: 'written_book.png'},
  other: {label: 'Other pages', one: 'Page', icon: 'paper.png'}
};
const TYPE_ORDER = ['character', 'item', 'location', 'event', 'group', 'lore', 'other'];
const NAME_ICONS = [[/mace/i, 'mace.png'], [/spyglass/i, 'spyglass.png'], [/totem/i, 'totem_of_undying.png'], [/sword/i, 'netherite_sword.png'], [/trident/i, 'trident.png'], [/crossbow/i, 'crossbow_standby.png'], [/\bbow\b/i, 'bow.png'], [/pickaxe/i, 'netherite_pickaxe.png'], [/\baxe\b/i, 'netherite_axe.png'], [/elytra/i, 'elytra.png'], [/helmet|crown/i, 'golden_helmet.png'], [/chestplate|armou?r/i, 'netherite_chestplate.png'], [/apple/i, 'golden_apple.png'], [/pearl/i, 'ender_pearl.png'], [/\beye\b/i, 'ender_eye.png'], [/key/i, 'trial_key.png'], [/book|journal|tome/i, 'enchanted_book.png'], [/potion/i, 'potion.png'], [/star/i, 'nether_star.png'], [/crystal/i, 'end_crystal.png'], [/horn/i, 'goat_horn.png'], [/cannon|tnt|bomb/i, 'fire_charge.png'], [/spear/i, 'trident.png'], [/heart/i, 'heart_of_the_sea.png'], [/compass/i, 'compass_00.png'], [/map/i, 'filled_map.png'], [/clock/i, 'clock_00.png'], [/wind|breeze/i, 'wind_charge.png'], [/flower/i, 'pink_petals.png'], [/plane|blimp/i, 'phantom_membrane.png'], [/diamond/i, 'diamond.png'], [/gold/i, 'gold_ingot.png']];
function libraryIcon(title, type) {
  for (const [pattern, file] of NAME_ICONS) if (pattern.test(title)) return ITEM_ROOT + file;
  return ITEM_ROOT + (LIB_TYPES[type] || LIB_TYPES.other).icon;
}
const wikiUrl = title => `${WIKI_ORIGIN}/wiki/${encodeURIComponent(String(title).replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')}`;
const pageHash = title => `#/library/p/${encodeURIComponent(title)}`;
const slug = text => String(text || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Fandom image URLs: ask for a sensible size instead of the original upload.
function wikiImage(url, width = 400) {
  if (!url) return '';
  let clean = String(url).replace(/^\/\//, 'https://');
  if (!/^https:\/\/(static|vignette)\.wikia\.nocookie\.net\//.test(clean)) return '';
  const match = clean.match(/^(.*?\/revision\/latest)(?:\/[^?]*)?(\?.*)?$/);
  if (match) clean = `${match[1]}/scale-to-width-down/${width}${match[2] || ''}`;
  return clean;
}

/* ==========================================================================
   The End portal (stronghold portal room, eyes of ender, then a dive into The End)
   ========================================================================== */
let portalRun = null;
let portalVisited = false;
// The End portal's look: many layers of drifting specks, each tinted and scaled
// differently, added together over a near-black teal (like the game's shader).
const END_COLORS = ['#1b4d3e', '#1f6b5a', '#2a8c7a', '#3fb39d', '#5fc8a8', '#2d5e8c', '#3c4fa8', '#5b3fa8', '#7a4fc8', '#1e8c6b', '#4fd3a8', '#8fe8d0', '#2bb8a0', '#165a4a', '#3a7a6a', '#6ad8c0'];
let endLayers = null;
function makeEndLayers() {
  if (endLayers) return endLayers;
  const size = 64;
  const specks = document.createElement('canvas');
  specks.width = specks.height = size;
  const sctx = specks.getContext('2d');
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let index = 0; index < 52; index += 1) {
    sctx.fillStyle = `rgba(255,255,255,${0.55 + rnd() * 0.45})`;
    sctx.fillRect(Math.floor(rnd() * size), Math.floor(rnd() * size), 1, 1);
  }
  endLayers = END_COLORS.map((color, index) => {
    const layer = document.createElement('canvas');
    layer.width = layer.height = size;
    const lctx = layer.getContext('2d');
    lctx.drawImage(specks, 0, 0);
    lctx.globalCompositeOperation = 'multiply';
    lctx.fillStyle = color;
    lctx.fillRect(0, 0, size, size);
    return {canvas: layer, scale: 1 + index * 0.32, angle: ((index * index * 4321 + index * 9) % 360) * Math.PI / 180, speed: 0.6 + index / 6, alpha: 0.9 - index * 0.03};
  });
  return endLayers;
}
function drawEnd(ctx, width, height, time) {
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#060d0e';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  for (const layer of makeEndLayers()) {
    const pattern = ctx.createPattern(layer.canvas, 'repeat');
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    ctx.translate(width / 2, height / 2);
    ctx.rotate(layer.angle);
    ctx.scale(layer.scale, layer.scale);
    ctx.translate((time * layer.speed * 4) % 64, (time * layer.speed * 2.2) % 64);
    ctx.fillStyle = pattern;
    ctx.fillRect(-width * 2, -height * 2, width * 4, height * 4);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function endPortalSounds(phase, index = 0) {
  const bus = audio.bus();
  if (!bus) return;
  if (phase === 'eye') {
    const pitch = 1 + (index % 4) * 0.06;
    tone(bus, 0, 0.5, {type: 'triangle', from: 1175 * pitch, to: 1150 * pitch, gain: 0.07});
    tone(bus, 0, 0.35, {type: 'sine', from: 2350 * pitch, gain: 0.03});
    noise(bus, 0, 0.05, {from: 4200, q: 4, gain: 0.07});
  } else if (phase === 'open') {
    tone(bus, 0, 2.6, {from: 70, to: 38, gain: 0.85, attack: 0.01});
    noise(bus, 0, 2.2, {filter: 'lowpass', from: 1400, to: 90, gain: 0.4, attack: 0.02});
    [523, 659, 784, 1046, 1318].forEach((frequency, step) => tone(bus, 0.12 + step * 0.07, 1.8, {type: 'triangle', from: frequency, gain: 0.045, attack: 0.05}));
    tone(bus, 0.2, 2.2, {type: 'sawtooth', from: 98, to: 104, gain: 0.03, attack: 0.6});
  } else if (phase === 'dive') {
    noise(bus, 0, 1.1, {filter: 'bandpass', from: 300, to: 3800, q: 0.8, gain: 0.22, attack: 0.25});
    tone(bus, 0.1, 1.2, {from: 220, to: 880, gain: 0.05, attack: 0.3});
  }
  setTimeout(() => bus.disconnect(), 3200);
}
function buildPortalWorld(B) {
  const world = $('#ptWorld');
  const ring = [[1, 0], [2, 0], [3, 0], [4, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 4], [0, 3], [0, 2], [0, 1]];
  // Frames face the portal; the top texture's arrow side rotates with them.
  const facing = ([x, y]) => (y === 0 ? 0 : x === 4 ? 90 : y === 4 ? 180 : 270);
  const floorTex = (x, y) => { const n = (x * 31 + y * 17) % 11; return n === 0 ? 'mossy_stone_bricks.png' : n === 3 ? 'cracked_stone_bricks.png' : 'stone_bricks.png'; };
  const size = 9;
  const off = (size - 5) / 2;
  let html = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inHole = x >= off + 1 && x <= off + 3 && y >= off + 1 && y <= off + 3;
      if (inHole) continue;
      html += `<i class="pt-floor" style="--x:${x};--y:${y};background-image:url(${BLOCK_ROOT}${floorTex(x, y)})"></i>`;
    }
  }
  // The pit under the portal: lava one block down, stone brick walls around it.
  html += `<i class="pt-lava" style="--x:${off + 1};--y:${off + 1}"></i>`;
  for (let side = 0; side < 4; side += 1) html += `<i class="pt-pitwall s${side}" style="--x:${off + 1};--y:${off + 1};background-image:url(${BLOCK_ROOT}stone_bricks.png)"></i>`;
  html += `<div class="pt-surface" style="--x:${off + 1};--y:${off + 1}"><canvas id="ptSurface" width="48" height="48"></canvas></div>`;
  ring.forEach(([x, y], index) => {
    const face = (cls, extra = '') => `<i class="pt-face ${cls}" style="background-image:url(${BLOCK_ROOT}end_portal_frame_side.png)${extra}"></i>`;
    html += `<div class="pt-frame" style="--x:${x + off};--y:${y + off}" data-i="${index}">
      ${face('n')}${face('e')}${face('s')}${face('w')}
      <i class="pt-top" style="--rot:${facing([x, y])}deg;--top:url(${BLOCK_ROOT}end_portal_frame_top.png);--eye:url(${BLOCK_ROOT}end_portal_frame_eye.png)"><b></b></i>
    </div>`;
  });
  world.innerHTML = html;
  world.style.setProperty('--b', `${B}px`);
  world.style.setProperty('--n', size);
}
function playPortal(done) {
  if (portalRun) portalRun.finish();
  const layer = $('#portalLayer');
  const quick = portalVisited;
  portalVisited = true;
  const B = Math.round(Math.max(30, Math.min(84, Math.min(innerWidth, innerHeight) / 8)));
  buildPortalWorld(B);
  const surface = $('#ptSurface').getContext('2d');
  const voidCanvas = $('#ptVoid');
  const scale = 3;
  voidCanvas.width = Math.ceil(innerWidth / scale);
  voidCanvas.height = Math.ceil(innerHeight / scale);
  const vctx = voidCanvas.getContext('2d');
  layer.className = 'portal-layer';
  layer.hidden = false;
  void layer.offsetWidth;
  layer.classList.add('show');
  if (quick) layer.classList.add('quick', 'lit');
  const started = performance.now();
  let frame = 0;
  const tick = now => {
    const t = (now - started) / 1000;
    if (layer.classList.contains('lit')) drawEnd(surface, 48, 48, t);
    if (layer.classList.contains('void')) drawEnd(vctx, voidCanvas.width, voidCanvas.height, t * 1.6);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const run = {
    finish() {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      layer.className = 'portal-layer';
      layer.hidden = true;
      $('#ptWorld').innerHTML = '';
      if (portalRun === run) portalRun = null;
      document.removeEventListener('keydown', skip, true);
      layer.removeEventListener('click', run.finish);
      if (!run.done) { run.done = true; done(); }
    }
  };
  const skip = event => { if (event.key === 'Escape') { event.preventDefault(); run.finish(); } };
  portalRun = run;
  document.addEventListener('keydown', skip, true);
  layer.addEventListener('click', run.finish);
  const frames = [...layer.querySelectorAll('.pt-frame')];
  let openAt = 300;
  if (quick) frames.forEach(frameEl => frameEl.classList.add('eyed'));
  else {
    frames.forEach((frameEl, index) => at(380 + index * 85, () => {
      frameEl.classList.add('eyed');
      const top = frameEl.querySelector('.pt-top b');
      top.innerHTML = Array.from({length: 6}, (_, n) => `<s style="--a:${n * 60 + Math.random() * 40}deg;--d:${0.35 + Math.random() * 0.35}"></s>`).join('');
      endPortalSounds('eye', index);
    }));
    openAt = 380 + frames.length * 85 + 160;
  }
  at(openAt, () => { layer.classList.add('lit', 'open'); if (!quick) endPortalSounds('open'); });
  const diveAt = openAt + (quick ? 250 : 650);
  at(diveAt, () => { layer.classList.add('dive'); endPortalSounds('dive'); });
  at(diveAt + 900, () => layer.classList.add('void'));
  at(diveAt + 1250, () => { if (!run.done) { run.done = true; done(); } layer.classList.add('reveal'); });
  at(diveAt + 1950, () => run.finish());
}

/* ==========================================================================
   Data
   ========================================================================== */
let libraryData = null;
let libraryPromise = null;
const libraryPages = new Map();
let libraryTitles = new Map();
function indexTitles() {
  libraryTitles = new Map();
  for (const page of libraryData?.pages || []) {
    libraryTitles.set(page.t.toLowerCase(), page);
    for (const alias of page.al || []) if (!libraryTitles.has(alias.toLowerCase())) libraryTitles.set(alias.toLowerCase(), page);
  }
}
function pageByTitle(title) { return libraryTitles.get(String(title || '').toLowerCase()) || null; }
function loadLibrary(force = false) {
  if (!libraryPromise || force) {
    libraryPromise = fetch('/api/library', {cache: force ? 'no-store' : 'default'})
      .then(response => response.json().catch(() => ({empty: true, error: `The server answered ${response.status}.`})))
      .catch(() => ({empty: true, error: 'You appear to be offline.'}))
      .then(data => { libraryData = data && data.version === 2 && Array.isArray(data.pages) ? data : {empty: true, error: data?.error}; indexTitles(); return libraryData; });
  }
  return libraryPromise;
}
async function fetchLibraryPage(title) {
  const key = String(title).toLowerCase();
  if (libraryPages.has(key)) return libraryPages.get(key);
  const request = fetch(`/api/library/page?t=${encodeURIComponent(title)}`).then(async response => {
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Error ${response.status}`);
    return response.json();
  });
  libraryPages.set(key, request);
  request.catch(() => libraryPages.delete(key));
  return request;
}

/* ==========================================================================
   HTML cleaning. Used twice: when importing (wiki HTML → our HTML) and again
   when showing a page, so stored text can never inject scripts or styles.
   ========================================================================== */
const KEEP_TAGS = {P: 'p', UL: 'ul', OL: 'ol', LI: 'li', DL: 'dl', DT: 'dt', DD: 'dd', B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', S: 's', DEL: 's', SMALL: 'small', BR: 'br', BLOCKQUOTE: 'blockquote', TABLE: 'table', THEAD: 'thead', TBODY: 'tbody', TFOOT: 'tbody', TR: 'tr', TH: 'th', TD: 'td', CAPTION: 'caption', CODE: 'code', PRE: 'pre', SUB: 'sub', SUP: 'sup', H1: 'h4', H2: 'h4', H3: 'h4', H4: 'h5', H5: 'h5', H6: 'h5', FIGURE: 'figure', FIGCAPTION: 'figcaption', HR: 'hr'};
const VOID_TAGS = new Set(['br', 'hr']);
function cleanNode(node, link) {
  if (node.nodeType === 3) return escapeHTML(node.nodeValue);
  if (node.nodeType !== 1) return '';
  const tag = node.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'TEMPLATE' || tag === 'SVG' || tag === 'svg' || tag === 'BUTTON' || tag === 'INPUT') return '';
  const inner = () => [...node.childNodes].map(child => cleanNode(child, link)).join('');
  if (tag === 'A') {
    const text = inner();
    if (!text.trim()) return text;
    const target = link(node);
    if (target?.page) return `<a data-page="${escapeHTML(target.page)}" href="${pageHash(target.page)}">${text}</a>`;
    if (target?.href) return `<a href="${escapeHTML(target.href)}" target="_blank" rel="noreferrer">${text}</a>`;
    return text;
  }
  if (tag === 'IMG') {
    const src = wikiImage(node.getAttribute('data-src') || node.getAttribute('src') || '', Math.min(600, Number(node.getAttribute('width')) * 2 || 400));
    if (!src) return '';
    const width = Number(node.getAttribute('width')) || 0;
    const small = width && width <= 48;
    return `<img src="${escapeHTML(src)}" alt="${escapeHTML(node.getAttribute('alt') || '')}" loading="lazy"${small ? ` class="wk-icon" width="${width}"` : ''}>`;
  }
  // our own layout wrappers survive cleaning; nothing else keeps a class
  const ownClass = /^(wk-gallery|wk-figure)$/.test(node.getAttribute('class') || '') ? node.getAttribute('class') : '';
  if (tag === 'DIV' && ownClass === 'wk-gallery') return `<div class="wk-gallery">${inner()}</div>`;
  const keep = KEEP_TAGS[tag];
  if (!keep) return inner();
  if (VOID_TAGS.has(keep)) return `<${keep}>`;
  const content = inner();
  if (!content.trim() && !['td', 'th'].includes(keep)) return '';
  let attrs = '';
  if (keep === 'td' || keep === 'th') {
    const colspan = Number(node.getAttribute('colspan'));
    const rowspan = Number(node.getAttribute('rowspan'));
    if (colspan > 1 && colspan < 30) attrs += ` colspan="${colspan}"`;
    if (rowspan > 1 && rowspan < 60) attrs += ` rowspan="${rowspan}"`;
  }
  if (keep === 'figure' && ownClass) attrs += ` class="${ownClass}"`;
  return `<${keep}${attrs}>${content}</${keep}>`;
}
// Render-time pass over stored HTML: only our own tags, links and wiki images survive.
function safeHTML(html) {
  if (!html) return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  return [...template.content.childNodes].map(node => cleanNode(node, anchor => {
    const page = anchor.getAttribute('data-page');
    if (page) return pageByTitle(page) ? {page: pageByTitle(page).t} : null;
    const href = anchor.getAttribute('href') || '';
    return /^https:\/\//.test(href) ? {href} : null;
  })).join('');
}

/* ==========================================================================
   Wiki → library conversion (runs in the browser during the import)
   ========================================================================== */
const NOISE = ['.mw-editsection', '.toc', '#toc', '.navbox', '.navbox-wrapper', 'table.navbox', '.reference', '.references', '.reflist', '.mw-references-wrap', 'sup.reference', 'script', 'style', 'noscript', 'link', 'meta', '.printfooter', '.catlinks', '.mw-empty-elt', '.error', '.mbox', '.ambox', '.mw-collapsible-toggle', '.article-media-thumbnail .info-icon', '.mw-cite-backlink', '.noprint', '.nomobile'].join(',');
const NOTICE = /(this (article|page|section) (is a stub|requires|needs|is (currently )?(under|being|incomplete|missing))|help (us|the wiki) by (expanding|adding)|requires? (an )?update|is a stub)/i;
const textOf = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();

function convertWikiPage(html, title, resolveLink) {
  const doc = new DOMParser().parseFromString(`<div id="wk-root">${html}</div>`, 'text/html');
  const root = doc.querySelector('.mw-parser-output') || doc.getElementById('wk-root');
  root.querySelectorAll(NOISE).forEach(node => node.remove());
  // "This page needs an update"-style notice boxes
  root.querySelectorAll('table, div').forEach(node => { if (node.isConnected && !node.closest('.portable-infobox') && textOf(node).length < 320 && NOTICE.test(textOf(node)) && !node.querySelector('h2, h3, .portable-infobox')) node.remove(); });
  const links = new Set();
  const link = anchor => {
    const href = anchor.getAttribute('href') || '';
    if (anchor.classList.contains('new') || href.startsWith('#')) return null;
    const target = resolveLink(href);
    if (target) { if (target.toLowerCase() !== title.toLowerCase()) links.add(target); return {page: target}; }
    if (/^https:\/\//.test(href) && !href.startsWith(WIKI_ORIGIN)) return {href};
    return null;
  };
  const clean = node => cleanNode(node, link);
  const imageOf = img => wikiImage(img?.getAttribute('data-src') || img?.getAttribute('src') || '', 600);

  // ---- infoboxes (portable infoboxes first, then classic table infoboxes)
  const infobox = {title: '', images: [], groups: []};
  for (const box of root.querySelectorAll('aside.portable-infobox')) {
    if (!infobox.title) infobox.title = textOf(box.querySelector('.pi-title'));
    box.querySelectorAll('.pi-image, .pi-image-collection .wds-tab__content').forEach(holder => {
      const img = holder.querySelector('img');
      const src = imageOf(img);
      if (!src || infobox.images.some(image => image.src === src)) return;
      const tabIndex = [...(holder.parentElement?.children || [])].filter(child => child.classList.contains('wds-tab__content')).indexOf(holder);
      const tabLabel = tabIndex >= 0 ? textOf(holder.closest('.pi-image-collection')?.querySelectorAll('.wds-tabs__tab-label')[tabIndex]) : '';
      infobox.images.push({src, cap: tabLabel || textOf(holder.querySelector('.pi-caption')) || textOf(holder.nextElementSibling?.classList.contains('pi-caption') ? holder.nextElementSibling : null)});
    });
    let loose = {h: '', rows: []};
    const take = group => { if (group.rows.length) infobox.groups.push(group); };
    for (const child of box.children) {
      if (child.matches('section.pi-group, .pi-group')) {
        take(loose);
        loose = {h: '', rows: []};
        const group = {h: textOf(child.querySelector('.pi-header')), rows: []};
        child.querySelectorAll('.pi-data').forEach(row => { const k = textOf(row.querySelector('.pi-data-label')); const v = clean(row.querySelector('.pi-data-value') || row).trim(); if (v) group.rows.push({k: k || 'Info', v}); });
        child.querySelectorAll('.pi-horizontal-group, table.pi-horizontal-group').forEach(table => {
          const labels = [...table.querySelectorAll('th')].map(textOf);
          [...table.querySelectorAll('td')].forEach((cell, index) => { const v = clean(cell).trim(); if (v) group.rows.push({k: labels[index] || 'Info', v}); });
        });
        take(group);
      } else if (child.matches('.pi-data')) {
        const v = clean(child.querySelector('.pi-data-value') || child).trim();
        if (v) loose.rows.push({k: textOf(child.querySelector('.pi-data-label')) || 'Info', v});
      } else if (child.matches('.pi-header')) {
        take(loose);
        loose = {h: textOf(child), rows: []};
      }
    }
    take(loose);
    box.remove();
  }
  for (const table of root.querySelectorAll('table.infobox, table[class*="infobox"]')) {
    const group = {h: '', rows: []};
    table.querySelectorAll('tr').forEach(row => {
      const th = row.querySelector('th');
      const td = row.querySelector('td');
      const img = row.querySelector('img');
      if (img && !td?.textContent.trim()) { const src = imageOf(img); if (src) infobox.images.push({src, cap: ''}); return; }
      if (th && td) { const v = clean(td).trim(); if (v) group.rows.push({k: textOf(th), v}); } else if (th && !infobox.title) infobox.title = textOf(th);
    });
    if (group.rows.length) infobox.groups.push(group);
    table.remove();
  }

  // ---- body: sections, tabs, galleries
  const sections = [];
  const images = [];
  let current = null;
  let level = 1;
  let tabCounter = 0;
  const start = (h, lv, extra = {}) => { current = {h, lv, html: '', ...extra}; sections.push(current); };
  start('Overview', 1, {intro: true});
  const add = html => { if (html && html.replace(/<[^>]+>/g, '').trim() || /<img/.test(html || '')) current.html += html; };
  const gallery = container => {
    const figures = [];
    container.querySelectorAll('.wikia-gallery-item, .gallerybox, li.gallerybox, figure, .lightbox-caption').forEach(entry => {
      const img = entry.querySelector('img');
      const src = imageOf(img);
      if (!src || figures.some(figure => figure.src === src)) return;
      const caption = textOf(entry.querySelector('.lightbox-caption, .gallerytext, figcaption, .caption'));
      figures.push({src, caption});
    });
    if (!figures.length) return;
    images.push(...figures);
    add(`<div class="wk-gallery">${figures.map(figure => `<figure><img src="${escapeHTML(figure.src)}" alt="" loading="lazy">${figure.caption ? `<figcaption>${escapeHTML(figure.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`);
  };
  const tabber = container => {
    let labels = [];
    let panels = [];
    if (container.querySelector(':scope > .wds-tab__content')) {
      panels = [...container.querySelectorAll(':scope > .wds-tab__content')];
      labels = [...container.querySelectorAll(':scope > .wds-tabs__wrapper .wds-tabs__tab, :scope .wds-tabs__tab')].filter(tab => tab.closest('.tabber, .wds-tabber') === container).map(textOf);
    } else if (container.querySelector('.tabber__panel')) {
      panels = [...container.querySelectorAll('.tabber__panel')].filter(panel => panel.closest('.tabber') === container);
      const headerTabs = [...container.querySelectorAll('.tabber__tab')].filter(tab => tab.closest('.tabber') === container).map(textOf);
      labels = panels.map((panel, index) => panel.getAttribute('data-mw-tabber-title') || panel.getAttribute('data-title') || panel.getAttribute('title') || headerTabs[index] || '');
    } else {
      panels = [...container.querySelectorAll(':scope > .tabbertab')];
      labels = panels.map(panel => panel.getAttribute('title') || panel.getAttribute('data-title') || '');
    }
    if (!panels.length) { walk(container); return; }
    const parent = current;
    const baseLevel = level;
    const group = `tab${tabCounter += 1}`;
    panels.forEach((panel, index) => {
      start(labels[index] || `Part ${index + 1}`, baseLevel + 0.5, {tab: group});
      level = baseLevel + 0.5;
      walk(panel);
    });
    level = baseLevel;
    // anything after the tabs continues the section the tabs sat in
    start(parent.h, baseLevel, {cont: true, intro: parent.intro});
  };
  const walk = container => {
    for (const node of [...container.childNodes]) {
      if (node.nodeType === 3) { if (node.nodeValue.trim()) add(`<p>${escapeHTML(node.nodeValue.trim())}</p>`); continue; }
      if (node.nodeType !== 1) continue;
      const tag = node.tagName;
      const heading = /^H[1-6]$/.test(tag) ? node : node.classList.contains('mw-heading') ? node.querySelector('h1, h2, h3, h4, h5, h6') : null;
      if (heading) {
        const lv = Number(heading.tagName[1]);
        const h = textOf(heading.querySelector('.mw-headline') || heading);
        if (h) { level = lv; start(h, lv); }
        continue;
      }
      if (node.matches('.tabber, .wds-tabber, .tabberlive')) { tabber(node); continue; }
      if (node.matches('.wds-tabs__wrapper, .tabber__header, .wds-tabs')) continue;
      if (node.matches('.wikia-gallery, .gallery, ul.gallery, .gallery-image-wrapper, .wikia-slideshow')) { gallery(node); continue; }
      if (tag === 'FIGURE' || node.matches('.thumb, .floatright, .floatleft, .article-thumb')) {
        const img = node.querySelector('img');
        const src = imageOf(img);
        if (src) { const caption = textOf(node.querySelector('figcaption, .thumbcaption, .caption')); images.push({src, caption}); add(`<figure class="wk-figure"><img src="${escapeHTML(src)}" alt="" loading="lazy">${caption ? `<figcaption>${escapeHTML(caption)}</figcaption>` : ''}</figure>`); }
        continue;
      }
      if (tag === 'DL' && node.children.length && [...node.children].every(child => child.tagName === 'DT')) {
        // ";Heading" lines on the wiki
        const h = textOf(node);
        if (h) start(h, Math.max(level, 2) + 1, {minor: true});
        continue;
      }
      if (['P', 'UL', 'OL', 'DL', 'BLOCKQUOTE', 'TABLE', 'PRE'].includes(tag)) { add(clean(node)); continue; }
      if (/quote/i.test(node.className || '')) { const inner = clean(node).trim(); if (inner) add(`<blockquote>${inner}</blockquote>`); continue; }
      if (tag === 'HR' || tag === 'BR') continue;
      if (['DIV', 'SECTION', 'CENTER', 'SPAN', 'ARTICLE', 'MAIN', 'ASIDE', 'FONT'].includes(tag)) { walk(node); continue; }
      add(clean(node));
    }
  };
  walk(root);

  // drop empty sections unless they hold deeper sections (era headers)
  const kept = sections.filter((section, index) => {
    if (section.html.trim()) return true;
    const next = sections[index + 1];
    return !section.cont && next && next.lv > section.lv;
  });
  const used = new Set();
  for (const section of kept) {
    let id = slug(section.h);
    while (used.has(id)) id += '-2';
    used.add(id);
    section.id = id;
  }
  const intro = kept.find(section => section.intro && section.html) || kept.find(section => section.html);
  const summaryNode = new DOMParser().parseFromString(intro?.html || '', 'text/html');
  const firstPara = [...summaryNode.querySelectorAll('p')].map(textOf).find(text => text.length > 30) || textOf(summaryNode.body);
  const summary = firstPara.replace(/\[\d+\]/g, '').slice(0, 420);
  const mainImage = infobox.images[0]?.src || images[0]?.src || '';
  return {infobox, sections: kept.map(({h, lv, html, tab, minor, intro: isIntro, id}) => ({id, h, lv, html, ...(tab ? {tab} : {}), ...(minor ? {minor: 1} : {}), ...(isIntro ? {intro: 1} : {})})), summary, image: mainImage, gallery: images.slice(0, 40), links: [...links]};
}

// What kind of page is it? Character signals win over item signals, so a character
// whose page also lists their gear (and sits in "Items") stays a character.
const CATEGORY_TYPES = [
  ['character', /^(characters?|players?|content creators?|youtubers?|streamers?|antagonists?|protagonists?|members?|npcs?|villains?|heroes|people|deceased|alive|males?|females?|mobs?|bosses)(\/|$| )/i, 6],
  ['group', /^(factions?|groups?|alliances?|teams?|organi[sz]ations?|gangs?|mafias?|families|nations?|empires?|kingdoms?|civili[sz]ations?|clans?|cults?)(\/|$| )/i, 5],
  ['event', /^(events?|wars?|battles?|fights?|conflicts?|heists?|raids?|tournaments?|deaths?|episodes?|trials?|elections?)(\/|$| )/i, 5],
  ['location', /^(locations?|places?|bases?|structures?|builds?|buildings?|dimensions?|biomes?|areas?|cities|towns?|islands?|vaults?|prisons?)(\/|$| )/i, 5],
  ['item', /^(items?|weapons?|tools?|armou?r|artifacts?|artefacts?|relics?|machines?|inventions?|cannons?|vehicles?|enchantments?|potions?|blocks?|mods?|plugins?|mechanics?|abilities)(\/|$| )/i, 4],
  ['lore', /^(seasons?|lore|history|timelines?|storylines?|arcs?|theories)(\/|$| )/i, 4]
];
const FIELD_TYPES = [
  ['character', /^(pronouns?|gender|species|status|age|birthday|born|relatives?|family|occupation|nicknames?|aliases|debut|first appearance|latest appearance|affiliations?|allies|enemies|friends|rivals?|partners?|skin|real name|channel|youtube|twitch)$/i, 2],
  ['item', /^(type|owners?|users?|wielders?|creators?|inventors?|crafted by|made by|abilities|damage|durability|enchantments?|obtained|recipe|materials?|uses|power|range|ammo)$/i, 1.5],
  ['location', /^(coordinates|coords|dimension|biome|built by|builders?|residents?|inhabitants?|region|size)$/i, 2],
  ['event', /^(date|dates|participants?|combatants?|result|outcome|winners?|losers?|casualties|deaths|cause|duration|episode)$/i, 2],
  ['group', /^(leaders?|members?|founders?|founded|headquarters|base|disbanded|formed|ranks?)$/i, 2]
];
function classifyPage(title, categories, infobox) {
  const score = {character: 0, item: 0, location: 0, event: 0, group: 0, lore: 0};
  for (const category of categories) {
    if (/^(affiliated|appears in|mentioned in|requires|pages? with|stubs?|candidates|hidden|images?|videos?)\b/i.test(category)) continue;
    const name = category.replace(/_/g, ' ');
    for (const [type, pattern, weight] of CATEGORY_TYPES) if (pattern.test(name)) { score[type] += weight; break; }
  }
  const labels = new Set(infobox.groups.flatMap(group => group.rows.map(row => row.k.toLowerCase().replace(/[:(].*$/, '').trim())));
  for (const label of labels) for (const [type, pattern, weight] of FIELD_TYPES) if (pattern.test(label)) score[type] += weight;
  if (/^season \d|\/history$|^history|^timeline|^lore\b/i.test(title)) score.lore += 6;
  if (/\b(war|battle|heist|raid|trial|election|tournament|siege)\b/i.test(title)) score.event += 2;
  if (/\b(base|castle|city|town|vault|prison|island|tower|spawn|empire)\b/i.test(title) && !score.character) score.location += 1.5;
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 2 ? best[0] : 'other';
}

/* ==========================================================================
   The import (admin only)
   ========================================================================== */
let wikiMode = 'direct';
let importRun = null;
let importActive = false;
async function wikiGet(params, attempt = 0) {
  const query = new URLSearchParams({format: 'json', formatversion: '2', ...params});
  if (wikiMode === 'direct') {
    try {
      const response = await fetch(`${WIKI_API}?${query}&origin=*`, {credentials: 'omit'});
      if (response.status === 429 || response.status >= 500) { if (attempt < 4) { await sleep(1200 * (attempt + 1)); return wikiGet(params, attempt + 1); } throw new Error(`The wiki answered ${response.status}.`); }
      if (response.ok) return response.json();
      throw new Error(`The wiki answered ${response.status}.`);
    } catch (error) {
      if (error instanceof TypeError) wikiMode = 'relay'; // blocked by the browser: go through our server
      else throw error;
    }
  }
  const response = await fetch(`/api/admin/wiki?${query}`, {credentials: 'same-origin'});
  if ((response.status === 429 || response.status >= 500) && attempt < 4) { await sleep(1500 * (attempt + 1)); return wikiGet(params, attempt + 1); }
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `The wiki relay answered ${response.status}.`);
  return response.json();
}
async function wikiList(params, key) {
  const out = [];
  let next = {};
  for (let guard = 0; guard < 40 && next; guard += 1) {
    const data = await wikiGet({...params, ...next});
    out.push(...(data.query?.[key] || []));
    next = data.continue || null;
  }
  return out;
}
function importUI(state) {
  const box = $('#libImport');
  if (!box) return;
  if (!state) { box.hidden = true; return; }
  box.hidden = false;
  const share = state.total ? Math.round(state.done / state.total * 100) : 0;
  box.innerHTML = `<div class="imp-head"><img src="${ITEM_ROOT}ender_eye.png" alt=""><div><strong>${escapeHTML(state.title)}</strong><small>${escapeHTML(state.detail || '')}</small></div>${state.running ? '<button type="button" class="quiet-action compact" data-imp-cancel>Stop</button>' : '<button type="button" class="quiet-action compact" data-imp-close>Close</button>'}</div>${state.total ? `<div class="imp-bar"><i style="width:${share}%"></i></div><p class="imp-count">${state.done} / ${state.total}</p>` : ''}${state.error ? `<p class="imp-error">${escapeHTML(state.error)}</p>` : ''}`;
}
async function importWiki({auto = false} = {}) {
  if (importRun) return importRun;
  const run = (async () => {
    const id = `r${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const state = {title: 'Updating the Library from the wiki', detail: 'Listing every page…', running: true, done: 0, total: 0};
    importActive = true;
    const check = () => { if (importRun?.cancelled) throw new Error('Stopped.'); };
    importUI(state);
    try {
      const site = await wikiGet({action: 'query', meta: 'siteinfo', siprop: 'general'});
      const mainPage = site.query?.general?.mainpage || '';
      const all = (await wikiList({action: 'query', list: 'allpages', apnamespace: '0', apfilterredir: 'nonredirects', aplimit: '500'}, 'allpages')).map(page => page.title).filter(title => title !== mainPage);
      check();
      const titleSet = new Map(all.map(title => [title.toLowerCase(), title]));
      // redirects become aliases ("Ash" → "Ashswagg")
      state.detail = 'Collecting nicknames and redirects…';
      importUI(state);
      const redirectTitles = (await wikiList({action: 'query', list: 'allpages', apnamespace: '0', apfilterredir: 'redirects', aplimit: '500'}, 'allpages')).map(page => page.title);
      const redirects = new Map();
      for (let index = 0; index < redirectTitles.length; index += 50) {
        check();
        const data = await wikiGet({action: 'query', titles: redirectTitles.slice(index, index + 50).join('|'), redirects: '1'});
        for (const entry of data.query?.redirects || []) if (titleSet.has(entry.to.toLowerCase())) redirects.set(entry.from.toLowerCase(), titleSet.get(entry.to.toLowerCase()));
      }
      const resolveTitle = raw => {
        const key = String(raw || '').replace(/_/g, ' ').replace(/#.*$/, '').trim().toLowerCase();
        return titleSet.get(key) || redirects.get(key) || null;
      };
      const resolveLink = href => {
        let path = href;
        if (path.startsWith(WIKI_ORIGIN)) path = path.slice(WIKI_ORIGIN.length);
        const match = path.match(/^\/wiki\/([^?#]+)/);
        if (!match) return null;
        let name;
        try { name = decodeURIComponent(match[1]); } catch { name = match[1]; }
        if (/^(category|file|template|user|special|help|message[_ ]wall|user[_ ]blog|blog|forum|mediawiki|module|talk):/i.test(name)) return null;
        return resolveTitle(name);
      };
      state.total = all.length;
      state.detail = wikiMode === 'relay' ? 'Reading every page (through the site)…' : 'Reading every page…';
      importUI(state);
      const records = [];
      let cursor = 0;
      const worker = async () => {
        while (cursor < all.length) {
          check();
          const title = all[cursor++];
          try {
            const data = await wikiGet({action: 'parse', page: title, prop: 'text|categories|displaytitle|revid', disableeditsection: '1', disabletoc: '1', disablelimitreport: '1', redirects: '1'});
            if (data.parse) {
              const categories = (data.parse.categories || []).filter(category => !category.hidden).map(category => String(category.category || category['*'] || '').replace(/_/g, ' '));
              const converted = convertWikiPage(data.parse.text, title, resolveLink);
              records.push({t: title, type: classifyPage(title, categories, converted.infobox), cats: categories, rev: data.parse.revid, ...converted});
            }
          } catch (error) {
            if (importRun?.cancelled) throw error;
            console.warn('Library: skipped', title, error);
          }
          state.done += 1;
          if (state.done % 3 === 0 || state.done === all.length) importUI(state);
        }
      };
      await Promise.all(Array.from({length: 5}, worker));
      check();
      if (!records.length) throw new Error('The wiki returned no pages.');
      // backlinks: who mentions whom
      const back = new Map();
      for (const record of records) for (const target of record.links) { if (!back.has(target)) back.set(target, []); back.get(target).push(record.t); }
      const aliases = new Map();
      for (const [from, to] of redirects) { if (!aliases.has(to)) aliases.set(to, []); aliases.get(to).push(redirectTitles.find(title => title.toLowerCase() === from) || from); }
      const pages = records.map(record => ({
        t: record.t, type: record.type, url: wikiUrl(record.t), img: record.image, cats: record.cats, rev: record.rev,
        s: record.summary, ib: record.infobox, sec: record.sections, gal: record.gallery, links: record.links,
        back: (back.get(record.t) || []).slice(0, 60), al: (aliases.get(record.t) || []).slice(0, 12)
      }));
      // upload in small batches
      state.title = 'Saving the Library';
      state.detail = 'Uploading pages…';
      state.done = 0;
      state.total = pages.length;
      importUI(state);
      for (let index = 0; index < pages.length; index += 15) {
        check();
        const batch = pages.slice(index, index + 15);
        let ok = false;
        for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
          const response = await fetch('/api/admin/library/pages', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({run: id, pages: batch})}).catch(() => null);
          if (response?.ok) ok = true;
          else if (response && response.status < 500) throw new Error((await response.json().catch(() => ({}))).error || `Upload failed (${response.status}).`);
          else await sleep(1500 * (attempt + 1));
        }
        if (!ok) throw new Error('Uploading pages kept failing. Check your connection and try again.');
        state.done = Math.min(pages.length, index + batch.length);
        importUI(state);
      }
      const typeCounts = {};
      for (const page of pages) typeCounts[page.type] = (typeCounts[page.type] || 0) + 1;
      const catCounts = new Map();
      for (const page of pages) for (const category of page.cats) catCounts.set(category, (catCounts.get(category) || 0) + 1);
      const history = pages.find(page => page.t.toLowerCase() === HISTORY_TITLE.toLowerCase())?.t || pages.find(page => /\/history$/i.test(page.t))?.t || '';
      const index = {
        fetchedAt: new Date().toISOString(), source: {wiki: WIKI_ORIGIN, name: site.query?.general?.sitename || 'Unstable Universe Wiki'}, history,
        counts: typeCounts, categories: [...catCounts].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({name, count})),
        pages: pages.map(page => ({t: page.t, type: page.type, s: page.s.slice(0, 240), img: page.img ? wikiImage(page.img, 320) : '', cats: page.cats.slice(0, 12), al: page.al, n: page.back.length}))
      };
      state.detail = 'Publishing…';
      importUI(state);
      const response = await fetch('/api/admin/library/commit', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({run: id, index})});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Publishing failed (${response.status}).`);
      libraryPages.clear();
      await loadLibrary(true);
      importActive = false;
      if (currentView === 'library') renderLibraryView();
      importUI({title: 'The Library is up to date', detail: `${pages.length} pages · ${Object.entries(typeCounts).sort((a, b) => TYPE_ORDER.indexOf(a[0]) - TYPE_ORDER.indexOf(b[0])).map(([type, count]) => `${count} ${(LIB_TYPES[type] || LIB_TYPES.other).label.toLowerCase()}`).join(' · ')}`, running: false});
      setTimeout(() => importUI(null), 9000);
      toast(`Library updated: ${pages.length} pages.`);
      return true;
    } catch (error) {
      importUI({title: auto ? 'The automatic Library update stopped' : 'The Library update stopped', detail: 'The current Library was kept.', running: false, error: error.message});
      return false;
    } finally {
      importActive = false;
      importRun = null;
    }
  })();
  importRun = run;
  importRun.cancelled = false;
  return run;
}
function libraryAdminCheck() {
  const button = $('#libUpdate');
  if (button) button.hidden = !isAdmin;
  if (!isAdmin || importRun || !libraryData) return;
  const age = libraryData.empty ? Infinity : Date.now() - new Date(libraryData.fetchedAt || 0).getTime();
  if (age > LIBRARY_STALE_MS) importWiki({auto: true});
}

/* ==========================================================================
   Views
   ========================================================================== */
const libState = {type: 'all', q: '', cat: '', sort: 'top', shown: 60, era: 0};
function libraryRouteParts() {
  const hash = location.hash.replace(/^#\/?library\/?/, '');
  if (hash.startsWith('p/')) { let title = hash.slice(2); try { title = decodeURIComponent(title); } catch { /* keep raw */ } return {mode: 'page', title}; }
  if (hash.startsWith('timeline')) return {mode: 'timeline'};
  return {mode: 'browse'};
}
async function openLibrary() {
  if (!libraryData) {
    $('#libRoot').innerHTML = '<div class="lib-loading"><span class="player-loading"><span></span></span>Opening the archive…</div>';
    await loadLibrary();
  }
  libraryRoute();
  libraryAdminCheck();
}
function libraryRoute() {
  if (currentView !== 'library') return;
  const route = libraryRouteParts();
  if (route.mode === 'page') renderLibraryPage(route.title);
  else if (route.mode === 'timeline') { renderLibraryShell('timeline'); renderLibTimeline(); }
  else { renderLibraryShell('browse'); renderBrowse(); }
}
function renderLibraryView() { if (currentView === 'library' && libraryData) libraryRoute(); }
function attribution(extra = '') {
  const when = libraryData?.fetchedAt ? ` Synced ${timeAgo(new Date(libraryData.fetchedAt).getTime())}.` : '';
  $('#libAttrib').innerHTML = `${extra}Text and images from the <a href="${WIKI_ORIGIN}" target="_blank" rel="noreferrer">Unstable Universe Wiki</a> on Fandom, used under <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a> and reformatted for this site. Every page links to its source. This is an unofficial fan site.${when}`;
}
function typeCounts() {
  const counts = {};
  for (const page of libraryData?.pages || []) counts[page.type] = (counts[page.type] || 0) + 1;
  return counts;
}
function renderLibraryShell(mode) {
  const data = libraryData || {empty: true};
  const counts = typeCounts();
  const total = data.pages?.length || 0;
  const tiles = TYPE_ORDER.filter(type => counts[type]).map(type => `<button type="button" class="lib-tile t-${type} ${libState.type === type && mode === 'browse' ? 'active' : ''}" data-libtype="${type}" aria-pressed="${libState.type === type}"><img src="${ITEM_ROOT}${LIB_TYPES[type].icon}" alt=""><b>${counts[type]}</b><span>${LIB_TYPES[type].label}</span></button>`).join('');
  $('#libRoot').innerHTML = `
    <header class="lib-hero2">
      <div class="lib-hero-bg" aria-hidden="true"><i></i><i></i></div>
      <div class="lib-hero-top">
        <div>
          <p class="eyebrow">THE UNSTABLE ARCHIVE</p>
          <h1 id="libTitle">Every legend of the <em>Unstable Universe</em>.</h1>
          <p class="lib-lede">${data.empty ? 'The archive is being prepared.' : `${total} pages from the Unstable Universe Wiki: the people, gear, places and moments behind every episode.`}</p>
        </div>
        <div class="lib-hero-actions">
          <button class="quiet-action compact" id="libUpdate" type="button" ${isAdmin ? '' : 'hidden'}><img src="${ITEM_ROOT}ender_eye.png" alt="">Update from wiki</button>
        </div>
      </div>
      <label class="lib-search2"><span aria-hidden="true">⌕</span><input id="libSearch" type="search" placeholder="Search ${total || ''} pages: characters, items, places, events…" autocomplete="off" aria-label="Search the library" value="${escapeHTML(libState.q)}" /></label>
      <nav class="lib-modes" aria-label="Library sections">
        <a href="#/library" class="${mode === 'browse' ? 'active' : ''}" ${mode === 'browse' ? 'aria-current="page"' : ''}><img src="${ITEM_ROOT}book.png" alt="">Browse</a>
        ${data.history ? `<a href="#/library/timeline" class="${mode === 'timeline' ? 'active' : ''}" ${mode === 'timeline' ? 'aria-current="page"' : ''}><img src="${ITEM_ROOT}clock_00.png" alt="">Timeline</a>` : ''}
      </nav>
      ${tiles ? `<div class="lib-tiles" role="group" aria-label="Filter by type">${tiles}</div>` : ''}
    </header>
    <div class="lib-import" id="libImport" hidden aria-live="polite"></div>
    <div class="lib-body2" id="libBody"></div>`;
  attribution();
  if (importActive) importUI({title: 'Updating the Library from the wiki', detail: 'Still working…', running: true});
}
function searchPages(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return (libraryData.pages || []).map(page => {
    const title = page.t.toLowerCase();
    const alias = (page.al || []).join(' ').toLowerCase();
    const body = `${page.s} ${(page.cats || []).join(' ')}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (title === word) score += 40;
      else if (title.startsWith(word)) score += 20;
      else if (title.includes(word)) score += 12;
      else if (alias.includes(word)) score += 10;
      else if (body.includes(word)) score += 3;
      else return null;
    }
    return {page, score: score + Math.min(6, (page.n || 0) / 4)};
  }).filter(Boolean).sort((a, b) => b.score - a.score).map(entry => entry.page);
}
function libCard(page, words = [], big = false) {
  const type = LIB_TYPES[page.type] || LIB_TYPES.other;
  return `<a class="lib-card2 t-${page.type} ${big ? 'big' : ''}" href="${pageHash(page.t)}" data-page="${escapeHTML(page.t)}">
    <span class="lc-art ${page.img ? 'has-img' : ''}">${page.img ? `<img src="${escapeHTML(page.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('has-img');this.replaceWith(Object.assign(document.createElement('img'),{src:'${libraryIcon(page.t, page.type)}',className:'lc-icon'}))">` : `<img class="lc-icon" src="${libraryIcon(page.t, page.type)}" alt="">`}</span>
    <span class="lc-body"><span class="lc-type"><img src="${ITEM_ROOT}${type.icon}" alt="">${type.one}</span><strong>${highlight(page.t, words)}</strong><span class="lc-sum">${highlight(page.s || '', words)}</span></span>
  </a>`;
}
function renderBrowse() {
  const body = $('#libBody');
  const data = libraryData;
  if (!data || data.empty) {
    body.innerHTML = `<div class="empty-state lib-empty"><img src="${ITEM_ROOT}ender_eye.png" alt=""><h3>The archive hasn't been filled yet.</h3><p>${isAdmin ? 'It fills itself from the wiki the first time you open it as admin. Give it a minute; you can watch the progress above.' : 'It fills in automatically the next time the site admin opens the Library. Until then, everything is on the wiki itself.'}</p><a class="quiet-action" href="${WIKI_ORIGIN}" target="_blank" rel="noreferrer">Open the wiki ↗</a></div>`;
    return;
  }
  const words = libState.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = searchPages(libState.q) || [...data.pages];
  if (libState.type !== 'all') list = list.filter(page => page.type === libState.type);
  if (libState.cat) list = list.filter(page => (page.cats || []).includes(libState.cat));
  if (!words.length) list.sort(libState.sort === 'az' ? (a, b) => a.t.localeCompare(b.t) : (a, b) => (b.n || 0) - (a.n || 0) || a.t.localeCompare(b.t));
  const filtered = libState.type !== 'all' || libState.cat || words.length;
  const featured = !filtered ? [...data.pages].filter(page => page.type === 'character').sort((a, b) => (b.n || 0) - (a.n || 0)).slice(0, 8) : [];
  const categories = (data.categories || []).filter(category => libState.type === 'all' || data.pages.some(page => page.type === libState.type && page.cats?.includes(category.name)));
  const shown = list.slice(0, libState.shown);
  body.innerHTML = `
    ${featured.length ? `<section class="lib-feature"><div class="lib-sec-head"><h2>Main cast</h2><p>The characters the wiki mentions most.</p></div><div class="lib-feature-row">${featured.map(page => libCard(page, [], true)).join('')}</div></section>` : ''}
    <section class="lib-grid-wrap">
      <div class="lib-toolbar">
        <h2>${words.length ? `${list.length} result${list.length === 1 ? '' : 's'} for “${escapeHTML(libState.q.trim())}”` : libState.type === 'all' ? 'All pages' : LIB_TYPES[libState.type].label}${libState.cat ? ` <span class="lib-chip-on">${escapeHTML(libState.cat)} <button type="button" data-libcat="" aria-label="Clear category">×</button></span>` : ''}</h2>
        <div class="lib-tool-controls">
          ${libState.type !== 'all' ? '<button type="button" class="quiet-action compact" data-libtype="all">Show everything</button>' : ''}
          ${categories.length ? `<select id="libCat" aria-label="Wiki category"><option value="">All categories</option>${categories.map(category => `<option value="${escapeHTML(category.name)}" ${libState.cat === category.name ? 'selected' : ''}>${escapeHTML(category.name)} (${category.count})</option>`).join('')}</select>` : ''}
          ${words.length ? '' : `<select id="libSort" aria-label="Sort"><option value="top" ${libState.sort === 'top' ? 'selected' : ''}>Most mentioned</option><option value="az" ${libState.sort === 'az' ? 'selected' : ''}>A to Z</option></select>`}
        </div>
      </div>
      ${shown.length ? `<div class="lib-grid2">${shown.map(page => libCard(page, words)).join('')}</div>` : `<div class="empty-state"><img src="${ITEM_ROOT}compass_00.png" alt=""><h3>Nothing matches${words.length ? ` “${escapeHTML(libState.q.trim())}”` : ''}.</h3><p>Try a character, item or place name.</p></div>`}
      ${list.length > shown.length ? `<button type="button" class="quiet-action lib-more" data-libmore>Show ${Math.min(60, list.length - shown.length)} more of ${list.length - shown.length}</button>` : ''}
    </section>`;
}

/* ---------- Timeline (the wiki's History page) ---------- */
function sectionTree(sections) {
  // Turn the flat section list into eras (top-level tabs, or h2s) with their entries.
  const minLevel = Math.min(...sections.filter(section => !section.intro).map(section => section.lv));
  const eras = [];
  let era = null;
  for (const section of sections) {
    if (section.intro) { (eras[0]?.intro ? eras[0] : (eras.unshift({h: 'Overview', id: 'overview', intro: true, items: []}), eras[0])).items.push(section); continue; }
    if (section.lv === minLevel) { era = {h: section.h, id: section.id, items: section.html ? [{...section, h: section.h}] : []}; eras.push(era); continue; }
    if (!era) { era = {h: 'Overview', id: 'overview', items: []}; eras.push(era); }
    era.items.push(section);
  }
  return eras.filter(entry => entry.items.length);
}
async function renderLibTimeline() {
  const body = $('#libBody');
  if (!libraryData?.history) { body.innerHTML = '<div class="empty-state"><h3>No timeline yet.</h3></div>'; return; }
  body.innerHTML = '<div class="lib-loading"><span class="player-loading"><span></span></span>Opening the history…</div>';
  let page;
  try { page = await fetchLibraryPage(libraryData.history); } catch (error) { body.innerHTML = `<div class="empty-state"><h3>The timeline couldn't load.</h3><p>${escapeHTML(error.message)}</p></div>`; return; }
  if (libraryRouteParts().mode !== 'timeline') return;
  const eras = sectionTree(page.sec || []);
  if (libState.era >= eras.length) libState.era = 0;
  const era = eras[libState.era];
  const words = libState.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = item => !words.length || words.every(word => `${item.h} ${item.html.replace(/<[^>]+>/g, ' ')}`.toLowerCase().includes(word));
  const items = (words.length ? eras.flatMap(entry => entry.items.map(item => ({...item, era: entry.h}))) : era.items).filter(item => item.html && matches(item));
  body.innerHTML = `
    <div class="tl-eras" role="tablist" aria-label="Eras">${eras.map((entry, index) => `<button type="button" role="tab" class="tl-era ${index === libState.era && !words.length ? 'active' : ''}" data-era="${index}" aria-selected="${index === libState.era}">${escapeHTML(entry.h)}<small>${entry.items.filter(item => item.html).length}</small></button>`).join('')}</div>
    ${words.length ? `<p class="tl-note">${items.length} entr${items.length === 1 ? 'y mentions' : 'ies mention'} “${escapeHTML(libState.q.trim())}” across every era.</p>` : ''}
    <ol class="tl-list">${items.map((item, index) => {
      const related = relatedVideosFor(item.h, [...item.html.matchAll(/data-page="([^"]+)"/g)].map(match => match[1]));
      return `<li class="tl-item ${item.lv > (era?.items[0]?.lv || 0) + 1 ? 'deep' : ''}" id="tl-${escapeHTML(item.id)}" style="--i:${Math.min(index, 12)}">
        <span class="tl-dot" aria-hidden="true"></span>
        <article class="tl-card">
          ${item.era ? `<p class="tl-path">${escapeHTML(item.era)}</p>` : ''}
          <h3>${highlight(item.h, words)}</h3>
          <div class="wk-prose">${safeHTML(item.html)}</div>
          ${related.length ? `<div class="lib-related"><span class="side-note">Videos that may cover this</span>${related.map(video => `<button type="button" class="lib-vid" data-play="${video.id}"><img src="${thumbOf(video)}" alt="" loading="lazy"><span><strong>${escapeHTML(video.title)}</strong><small>${escapeHTML(video.creator)} · ${escapeHTML(video.date || '')}</small></span></button>`).join('')}</div>` : ''}
        </article>
      </li>`;
    }).join('')}</ol>
    <p class="tl-src"><a href="${escapeHTML(page.url)}" target="_blank" rel="noreferrer">Read the full history on the wiki ↗</a></p>`;
}

/* ---------- Page reader ---------- */
const normalizeTitleText = text => String(text || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
function videoByTitle(text) {
  const wanted = normalizeTitleText(text);
  if (wanted.length < 6) return null;
  const exact = videos.find(video => normalizeTitleText(video.title) === wanted);
  if (exact) return exact;
  if (wanted.length < 16 || wanted.split(' ').length < 3) return null;
  return videos.find(video => normalizeTitleText(video.title).includes(wanted)) || null;
}
const STOP = new Set('the and for with from that this into over when then than they them their there were was are has have had what where which while will would your you our his her its out off not but all any can get got one two new episode part video unstable universe smp minecraft season final finale vs'.split(' '));
function tokens(text) { return [...new Set(String(text || '').toLowerCase().match(/[a-z0-9']{4,}/g) || [])].filter(word => !STOP.has(word)); }
function relatedVideosFor(title, links = []) {
  const words = tokens(`${title} ${links.slice(0, 6).join(' ')}`);
  if (!words.length) return [];
  return videos.map(video => {
    const haystack = video.title.toLowerCase();
    const hits = words.filter(word => haystack.includes(word));
    return {video, score: hits.length + (hits.some(word => title.toLowerCase().includes(word)) ? 1 : 0)};
  }).filter(entry => entry.score >= 2 || (entry.score >= 1 && words.length <= 2)).sort((a, b) => b.score - a.score || byDate(a.video) - byDate(b.video)).slice(0, 3).map(entry => entry.video);
}
// Infobox values: wiki links stay links, YouTube links to our videos become play buttons.
function factHTML(value) {
  let html = safeHTML(value);
  html = html.replace(/<a href="https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})[^"]*"[^>]*>(.*?)<\/a>/g, (whole, id, label) => (getVideo(id) ? `<button type="button" class="fact-video" data-play="${id}"><img src="https://i.ytimg.com/vi/${id}/default.jpg" alt="">${label}</button>` : whole));
  const plain = html.replace(/<[^>]+>/g, '').trim();
  if (!/<(a|button)\b/.test(html)) {
    const video = videoByTitle(plain);
    if (video) html = `<button type="button" class="fact-video" data-play="${video.id}"><img src="${thumbOf(video)}" alt="">${escapeHTML(plain)}</button>`;
  }
  return html;
}
function renderSections(sections) {
  // Consecutive sections that share a tab group become a tab strip.
  let html = '';
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    if (section.tab) {
      const group = section.tab;
      const tabs = [];
      let cursor = index;
      while (cursor < sections.length) {
        const entry = sections[cursor];
        if (entry.tab === group) { tabs.push({head: entry, children: []}); cursor += 1; continue; }
        if (entry.lv > section.lv && tabs.length) { tabs[tabs.length - 1].children.push(entry); cursor += 1; continue; }
        break;
      }
      html += `<div class="wk-tabs" data-tabs>
        <div class="wk-tabbar" role="tablist">${tabs.map((tab, n) => `<button type="button" role="tab" aria-selected="${n === 0}" data-tab="${n}">${escapeHTML(tab.head.h)}</button>`).join('')}</div>
        ${tabs.map((tab, n) => `<div class="wk-tabpanel" role="tabpanel" ${n ? 'hidden' : ''} id="s-${escapeHTML(tab.head.id)}">${tab.head.html ? `<div class="wk-prose">${safeHTML(tab.head.html)}</div>` : ''}${renderSections(tab.children)}</div>`).join('')}
      </div>`;
      index = cursor - 1;
      continue;
    }
    const depth = section.intro ? 0 : Math.max(2, Math.min(5, Math.round(section.lv)));
    const heading = section.intro || section.cont ? '' : `<h${Math.min(6, depth + 0)} class="wk-h lv${depth}${section.minor ? ' minor' : ''}" id="s-${escapeHTML(section.id)}">${escapeHTML(section.h)}</h${Math.min(6, depth + 0)}>`;
    html += `${heading}${section.html ? `<div class="wk-prose">${safeHTML(section.html)}</div>` : ''}`;
  }
  return html;
}
async function renderLibraryPage(title) {
  const root = $('#libRoot');
  if (!libraryData || libraryData.empty) { renderLibraryShell('browse'); renderBrowse(); return; }
  const entry = pageByTitle(title);
  root.innerHTML = '<div class="lib-loading"><span class="player-loading"><span></span></span>Opening the page…</div>';
  window.scrollTo({top: 0, behavior: 'auto'});
  if (!entry) { root.innerHTML = `<div class="empty-state"><img src="${ITEM_ROOT}compass_00.png" alt=""><h3>“${escapeHTML(title)}” isn't in the library.</h3><p><a href="#/library">Back to the archive</a></p></div>`; return; }
  if (entry.t !== title) { history.replaceState(null, '', pageHash(entry.t)); }
  let page;
  try { page = await fetchLibraryPage(entry.t); } catch (error) { root.innerHTML = `<div class="empty-state"><h3>This page couldn't load.</h3><p>${escapeHTML(error.message)}</p><p><a href="#/library">Back to the archive</a></p></div>`; return; }
  if (libraryRouteParts().title?.toLowerCase() !== entry.t.toLowerCase() && libraryRouteParts().title?.toLowerCase() !== title.toLowerCase()) return;
  const type = LIB_TYPES[page.type] || LIB_TYPES.other;
  const images = page.ib?.images?.length ? page.ib.images : page.img ? [{src: page.img, cap: ''}] : [];
  // The header already shows the opening paragraph, so the body starts after it.
  const sections = (page.sec || []).map(section => {
    if (!section.intro || !page.s) return section;
    const template = document.createElement('template');
    template.innerHTML = section.html;
    const first = [...template.content.querySelectorAll('p')].find(p => textOf(p).length > 30);
    if (first && page.s.startsWith(textOf(first).replace(/\[\d+\]/g, '').slice(0, 60))) first.remove();
    return {...section, html: template.innerHTML};
  });
  const shownCats = (page.cats || []).filter(category => category.toLowerCase() !== page.t.toLowerCase() && !/^(requires|stubs?|pages? |candidates|articles? |hidden|disambig)/i.test(category));
  const toc = sections.filter(section => !section.intro && !section.cont && !section.minor && section.lv <= 3 && !section.tab);
  const related = relatedVideosFor(page.t);
  const backlinks = (page.back || []).map(pageByTitle).filter(Boolean);
  const linked = (page.links || []).map(pageByTitle).filter(Boolean).filter(other => !backlinks.includes(other));
  const facts = (page.ib?.groups || []).map(group => `${group.h ? `<h4 class="ib-h">${escapeHTML(group.h)}</h4>` : ''}<dl class="ib-rows">${group.rows.map(row => `<div><dt>${escapeHTML(row.k)}</dt><dd>${factHTML(row.v)}</dd></div>`).join('')}</dl>`).join('');
  root.innerHTML = `
    <article class="wk-page t-${page.type}">
      <nav class="wk-crumbs"><a href="#/library">← Library</a><span>›</span><a href="#/library" data-libtype="${page.type}">${type.label}</a></nav>
      <header class="wk-hero">
        ${images[0] ? `<div class="wk-hero-bg" style="background-image:url('${escapeHTML(images[0].src)}')" aria-hidden="true"></div>` : ''}
        <div class="wk-hero-art ${images[0] ? 'img' : ''}">${images[0] ? `<img src="${escapeHTML(images[0].src)}" alt="" referrerpolicy="no-referrer">` : `<img class="lc-icon" src="${libraryIcon(page.t, page.type)}" alt="">`}</div>
        <div class="wk-hero-copy">
          <span class="lc-type"><img src="${ITEM_ROOT}${type.icon}" alt="">${type.one}</span>
          <h1 id="libPageTitle">${escapeHTML(page.t)}</h1>
          ${page.al?.length ? `<p class="wk-aka">Also known as ${page.al.slice(0, 5).map(alias => `<b>${escapeHTML(alias)}</b>`).join(', ')}</p>` : ''}
          ${page.s ? `<p class="wk-lede">${escapeHTML(page.s.length > 320 ? `${page.s.slice(0, 320).replace(/\s+\S*$/, '')}…` : page.s)}</p>` : ''}
          <div class="wk-actions"><a class="quiet-action compact" href="${escapeHTML(page.url)}" target="_blank" rel="noreferrer">Read on the wiki ↗</a><button type="button" class="quiet-action compact" data-copy-page>Copy link</button></div>
          ${shownCats.length ? `<div class="wk-cats">${shownCats.slice(0, 10).map(category => `<button type="button" data-libcat="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('')}</div>` : ''}
        </div>
      </header>
      <div class="wk-layout">
        <aside class="wk-side">
          ${facts || images.length > 1 ? `<div class="wk-infobox">
            ${images.length > 1 ? `<div class="ib-gallery">${images.slice(0, 6).map((image, n) => `<button type="button" class="${n ? '' : 'active'}" data-ibimg="${escapeHTML(image.src)}" title="${escapeHTML(image.cap || '')}"><img src="${escapeHTML(image.src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
            ${facts}
          </div>` : ''}
          ${toc.length > 1 ? `<nav class="wk-toc" aria-label="On this page"><p>On this page</p>${toc.map(section => `<a href="#s-${escapeHTML(section.id)}" data-jump class="lv${Math.round(section.lv)}">${escapeHTML(section.h)}</a>`).join('')}</nav>` : ''}
        </aside>
        <div class="wk-main">
          ${renderSections(sections) || `<p class="wk-empty">The wiki page doesn't have more text yet.</p>`}
          ${related.length ? `<h2 class="wk-h lv2">Videos that may feature ${escapeHTML(page.t)}</h2><div class="wk-videos">${related.map(video => sideCard(video, video.creator)).join('')}</div>` : ''}
          ${backlinks.length ? `<h2 class="wk-h lv2">Mentioned on</h2><div class="wk-chips">${backlinks.slice(0, 30).map(other => `<a class="lib-link" href="${pageHash(other.t)}" data-page="${escapeHTML(other.t)}"><img src="${libraryIcon(other.t, other.type)}" alt="">${escapeHTML(other.t)}</a>`).join('')}</div>` : ''}
          ${linked.length ? `<h2 class="wk-h lv2">Linked from this page</h2><div class="wk-chips">${linked.slice(0, 30).map(other => `<a class="lib-link" href="${pageHash(other.t)}" data-page="${escapeHTML(other.t)}"><img src="${libraryIcon(other.t, other.type)}" alt="">${escapeHTML(other.t)}</a>`).join('')}</div>` : ''}
          <p class="lib-attrib small">From <a href="${escapeHTML(page.url)}" target="_blank" rel="noreferrer">${escapeHTML(page.t)} on the Unstable Universe Wiki</a>, CC BY-SA 3.0.${page.trimmed ? ' This page is very long, so only its first part is shown here.' : ''}</p>
        </div>
      </div>
    </article>`;
  document.title = `${page.t} · Library · Unstable Universe Experience`;
  attribution();
}

/* ---------- The player's "In the Library" card ---------- */
function renderRelatedLibrary(video) {
  const box = $('#railLibrary');
  const render = () => {
    if (!libraryData || libraryData.empty || activeVideoId !== video.id) { box.hidden = true; return; }
    const title = ` ${normalizeTitleText(video.title)} `;
    const found = libraryData.pages.map(page => {
      const names = [page.t, ...(page.al || [])].map(normalizeTitleText).filter(name => name.length >= 4);
      const hit = names.find(name => title.includes(` ${name} `));
      return hit ? {page, score: hit.length + (page.n || 0) / 10 + (page.type === 'character' ? 0 : 3)} : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 4);
    if (!found.length) { box.hidden = true; return; }
    box.innerHTML = `<div class="rail-head"><h3><img src="${ITEM_ROOT}enchanted_book.png" alt="">In the Library</h3><span class="side-note">Named in this video's title</span></div>${found.map(({page}) => `<a class="rail-lib" href="${pageHash(page.t)}" data-page="${escapeHTML(page.t)}"><img src="${page.img ? escapeHTML(page.img) : libraryIcon(page.t, page.type)}" alt=""><span><strong>${escapeHTML(page.t)}</strong><small>${escapeHTML((page.s || '').slice(0, 80))}…</small></span><b>→</b></a>`).join('')}`;
    box.hidden = false;
  };
  if (libraryData) render(); else loadLibrary().then(render);
}

/* ---------- Events ---------- */
function goLibraryPage(title) {
  if ($('#playerDialog').open) $('#playerDialog').close();
  location.hash = pageHash(title);
}
document.addEventListener('click', event => {
  const pageLink = event.target.closest('a[data-page]');
  if (pageLink && (pageLink.closest('#libraryView') || pageLink.closest('#railLibrary'))) {
    event.preventDefault();
    goLibraryPage(pageLink.dataset.page);
  }
});
$('#libraryView').addEventListener('click', event => {
  const type = event.target.closest('[data-libtype]');
  if (type) {
    event.preventDefault();
    libState.type = libState.type === type.dataset.libtype && type.classList.contains('lib-tile') ? 'all' : type.dataset.libtype;
    libState.shown = 60;
    libState.cat = '';
    if (libraryRouteParts().mode !== 'browse') location.hash = '#/library'; else { renderLibraryShell('browse'); renderBrowse(); }
    return;
  }
  const cat = event.target.closest('[data-libcat]');
  if (cat) {
    libState.cat = cat.dataset.libcat;
    libState.type = 'all';
    libState.shown = 60;
    if (libraryRouteParts().mode !== 'browse') location.hash = '#/library'; else renderBrowse();
    return;
  }
  if (event.target.closest('[data-libmore]')) { libState.shown += 60; renderBrowse(); return; }
  const era = event.target.closest('[data-era]');
  if (era) { libState.era = Number(era.dataset.era); libState.q = ''; const input = $('#libSearch'); if (input) input.value = ''; renderLibTimeline(); return; }
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    const box = tab.closest('[data-tabs]');
    box.querySelectorAll(':scope > .wk-tabbar [data-tab]').forEach(button => button.setAttribute('aria-selected', String(button === tab)));
    box.querySelectorAll(':scope > .wk-tabpanel').forEach((panel, n) => { panel.hidden = n !== Number(tab.dataset.tab); });
    return;
  }
  const ibimg = event.target.closest('[data-ibimg]');
  if (ibimg) {
    const art = $('.wk-hero-art img');
    if (art) art.src = ibimg.dataset.ibimg;
    ibimg.parentNode.querySelectorAll('button').forEach(button => button.classList.toggle('active', button === ibimg));
    return;
  }
  const jump = event.target.closest('[data-jump]');
  if (jump) {
    event.preventDefault();
    const target = document.getElementById(jump.getAttribute('href').slice(1));
    const panel = target?.closest('.wk-tabpanel[hidden]');
    if (panel) panel.closest('[data-tabs]').querySelector(`[data-tab="${[...panel.parentNode.querySelectorAll(':scope > .wk-tabpanel')].indexOf(panel)}"]`)?.click();
    target?.scrollIntoView({behavior: 'smooth', block: 'start'});
    return;
  }
  if (event.target.closest('[data-copy-page]')) {
    navigator.clipboard?.writeText(location.href).then(() => toast('Link copied.'), () => toast(location.href));
    return;
  }
  if (event.target.closest('#libUpdate')) { importWiki(); return; }
  if (event.target.closest('[data-imp-cancel]')) { if (importRun) importRun.cancelled = true; return; }
  if (event.target.closest('[data-imp-close]')) { importUI(null); return; }
  const play = event.target.closest('[data-play]');
  if (play) openPlayer(play.dataset.play);
});
$('#libraryView').addEventListener('input', event => {
  if (event.target.id !== 'libSearch') return;
  clearTimeout(window.__libTimer);
  window.__libTimer = setTimeout(() => {
    libState.q = event.target.value;
    libState.shown = 60;
    const mode = libraryRouteParts().mode;
    if (mode === 'timeline') renderLibTimeline();
    else if (mode === 'browse') renderBrowse();
  }, 140);
});
$('#libraryView').addEventListener('change', event => {
  if (event.target.id === 'libCat') { libState.cat = event.target.value; libState.shown = 60; renderBrowse(); }
  if (event.target.id === 'libSort') { libState.sort = event.target.value; renderBrowse(); }
});
$('#libraryView').addEventListener('keydown', event => {
  if (event.target.id === 'libSearch' && event.key === 'Enter' && libraryRouteParts().mode === 'page') { location.hash = '#/library'; }
});
// A page reached from search on the reader goes back to browse with the query.
window.addEventListener('hashchange', () => { if (currentView === 'library' && !location.hash.includes('/p/')) document.title = 'Unstable Universe Experience'; });
