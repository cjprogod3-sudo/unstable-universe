'use strict';

/* ==========================================================================
   Unstable Universe Library
   Static, no-build front end. Personal data stays in this browser.
   Storage keys are stable: never rename PROFILE_KEY or CATALOG_KEY.
   ========================================================================== */

const PLAYLIST_ID = 'PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg';
const ITEM_ROOT = 'https://assets.mcasset.cloud/1.21.4/assets/minecraft/textures/item/';
const PROFILE_KEY = 'unstable-universe-library-profile-v1';
const CATALOG_KEY = 'unstable-universe-library-catalog-v1';
const CATALOG_META_KEY = 'unstable-universe-library-catalog-meta-v1';
const SETTINGS_KEY = 'unstable-universe-library-settings-v1';
const DISMISSED_KEY = 'unstable-universe-library-dismissed-new-v1';
const DAY = 86400000;
const NEW_BANNER_DAYS = 2;
const NEW_FILTER_DAYS = 7;

const CREATORS = ['Wemmbu', 'Parrot', 'Spoke', 'FlameFrags', 'F0_olish'];

const icons = {
  All: 'nether_star.png', Wemmbu: 'mace.png', Parrot: 'spyglass.png', Spoke: 'totem_of_undying.png', FlameFrags: 'netherite_sword.png', F0_olish: 'trial_key.png', Other: 'compass_00.png',
  'New uploads': 'firework_rocket.png', 'In progress': 'recovery_compass_00.png', Watched: 'experience_bottle.png', 'Not started': 'map.png', Favorites: 'amethyst_shard.png', 'Watch later': 'clock_00.png', Rated: 'amethyst_shard.png', Bookmarked: 'writable_book.png', Longform: 'clock_00.png',
  Civilization: 'end_crystal.png', Law: 'book.png', Dimension: 'ender_eye.png', War: 'netherite_sword.png', Mafia: 'echo_shard.png', Prison: 'iron_door.png', 'Bases & vaults': 'bundle.png',
  Random: 'ender_pearl.png', Search: 'spyglass.png', Settings: 'redstone.png', YouTube: 'painting.png'
};
const themes = {
  All: {key: 'all', accent: '#8fd8ff', rgb: '143,216,255', two: '#5a6cff'},
  Wemmbu: {key: 'wemmbu', accent: '#be85ff', rgb: '190,133,255', two: '#6b3ba9'},
  Parrot: {key: 'parrot', accent: '#77f59c', rgb: '119,245,156', two: '#218c56'},
  Spoke: {key: 'spoke', accent: '#ff85d3', rgb: '255,133,211', two: '#4ecdf4'},
  FlameFrags: {key: 'flamefrags', accent: '#ff6d78', rgb: '255,109,120', two: '#b72f49'},
  F0_olish: {key: 'f0olish', accent: '#ffc35c', rgb: '255,195,92', two: '#b0671e'},
  Other: {key: 'other', accent: '#b9c3d6', rgb: '185,195,214', two: '#56627a'},
  Civilization: {key: 'civilization', accent: '#e0bf6b', rgb: '224,191,107', two: '#76613a'},
  War: {key: 'war', accent: '#ff9b62', rgb: '255,155,98', two: '#be3649'},
  Mafia: {key: 'mafia', accent: '#c49cff', rgb: '196,156,255', two: '#51368c'}
};
const PRESETS = {
  minimal: {particles: 0, artifacts: 6, motes: 0, rings: 0, shake: false},
  balanced: {particles: 14, artifacts: 11, motes: 10, rings: 1, shake: false},
  cinematic: {particles: 30, artifacts: 16, motes: 22, rings: 2, shake: true}
};
const COLLECTION_EMPTY = {
  'New uploads': ['No uploads in the last 7 days.', 'Videos show up here for a week after they are uploaded. Press Refresh playlist to check for new ones.'],
  'In progress': ['Nothing in progress yet.', 'Start any video and your place is saved here automatically.'],
  Watched: ['No watched videos yet.', 'Finish a video, or use "Mark watched", and it appears here.'],
  'Not started': ['You have started everything in this view.', 'Impressive. Try another creator or clear the filters.'],
  Favorites: ['No favorites yet.', 'Use the amethyst button on any card to favorite it.'],
  'Watch later': ['Your watch later list is empty.', 'Use the clock button on any card to queue a video.'],
  Rated: ['No ratings yet.', 'Rate a video from 1 to 5 shards and it appears here.'],
  Bookmarked: ['No bookmarked moments yet.', 'Open the player and use "Bookmark this moment".'],
  Longform: ['No videos over an hour in this view.', 'Try another creator or clear the filters.']
};

/* ---------- helpers ---------- */
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));
const item = name => `${ITEM_ROOT}${icons[name] || icons.All}`;
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const safeRead = (key, fallback) => { try { const parsed = JSON.parse(localStorage.getItem(key)); return parsed && typeof parsed === 'object' ? parsed : fallback; } catch { return fallback; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const defaultProfile = () => ({name: '', progress: {}, ratings: {}, favorites: {}, watchLater: {}, bookmarks: {}, favoriteCreator: '', lastVideoId: ''});
function normalizeProfile(raw) {
  const source = isObject(raw) ? raw : {};
  const bookmarks = {};
  if (isObject(source.bookmarks)) {
    for (const [id, list] of Object.entries(source.bookmarks)) {
      if (!Array.isArray(list)) continue;
      const clean = list.filter(entry => isObject(entry) && Number.isFinite(Number(entry.t))).map(entry => ({t: Math.max(0, Math.floor(Number(entry.t))), label: String(entry.label || '').slice(0, 60), at: Number(entry.at) || Date.now()}));
      if (clean.length) bookmarks[id] = clean.slice(0, 50);
    }
  }
  return {
    ...defaultProfile(),
    name: String(source.name || '').slice(0, 28),
    progress: isObject(source.progress) ? source.progress : {},
    ratings: isObject(source.ratings) ? source.ratings : {},
    favorites: isObject(source.favorites) ? source.favorites : {},
    watchLater: isObject(source.watchLater) ? source.watchLater : {},
    bookmarks,
    favoriteCreator: CREATORS.includes(source.favoriteCreator) ? source.favoriteCreator : '',
    lastVideoId: typeof source.lastVideoId === 'string' ? source.lastVideoId : ''
  };
}
const defaultSettings = () => ({preset: 'balanced', transitions: true, sound: true, volume: 0.5, theater: false, sidebar: 'open'});
function normalizeSettings(raw) {
  const source = isObject(raw) ? raw : {};
  return {
    preset: PRESETS[source.preset] ? source.preset : 'balanced',
    transitions: source.transitions !== false,
    sound: source.sound !== false,
    volume: clamp(Number.isFinite(Number(source.volume)) ? Number(source.volume) : 0.5, 0, 1),
    theater: Boolean(source.theater),
    sidebar: source.sidebar === 'rail' ? 'rail' : 'open'
  };
}

let profile = normalizeProfile(safeRead(PROFILE_KEY, defaultProfile()));
let settings = normalizeSettings(safeRead(SETTINGS_KEY, defaultSettings()));
let catalogMeta = safeRead(CATALOG_META_KEY, {});
const cachedCatalog = safeRead(CATALOG_KEY, []);
let videos = Array.isArray(cachedCatalog) ? cachedCatalog : [];
let filters = {creator: 'All', collection: 'All', tag: 'All', search: '', sort: 'playlist', length: 'any', year: 'any'};
let loading = false;
let activeVideoId = '';
let youtubePlayer = null;
let playerTimer = null;
let youtubeLoader = null;
let appliedTheme = '';
let appliedIcon = '';
let pendingVideoFromURL = '';
let suppressCloseTeardown = false;
let unavailableCount = 0;

function saveProfile() { if (!safeWrite(PROFILE_KEY, profile)) toast('Could not save. This browser storage may be full or blocked.'); }
function saveSettings() { safeWrite(SETTINGS_KEY, settings); }
function saveCatalog() { safeWrite(CATALOG_KEY, videos); safeWrite(CATALOG_META_KEY, catalogMeta); }

/* ---------- video model ---------- */
function progressFor(id) { return isObject(profile.progress[id]) ? profile.progress[id] : {seconds: 0, duration: 0, completed: false}; }
function ratingFor(id) { return clamp(Number(profile.ratings[id] || 0), 0, 5); }
function statusFor(video) {
  const progress = progressFor(video.id);
  if (progress.completed) return 'Watched';
  if (progress.seconds > 3) return 'In progress';
  return 'Not started';
}
function percentFor(video) {
  const progress = progressFor(video.id);
  const duration = progress.duration || video.durationSeconds || 0;
  return progress.completed ? 100 : duration > 0 ? clamp(Math.round(progress.seconds / duration * 100), 0, 100) : 0;
}
function formatSeconds(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}
function parseClock(text) {
  const parts = String(text || '').split(':').map(Number);
  if (!parts.length || parts.some(part => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}
function parseCompact(text) {
  const match = String(text || '').trim().match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return 0;
  return Number(match[1]) * ({K: 1e3, M: 1e6, B: 1e9}[(match[2] || '').toUpperCase()] || 1);
}
const TAG_RULES = [
  ['Civilization', /civilization/],
  ['Law', /\blaw\b|lawless/],
  ['Dimension', /dimension/],
  ['War', /\bwar\b|battle|empire/],
  ['Mafia', /mafia/],
  ['Prison', /prison/],
  ['Bases & vaults', /base|vault/]
];
function tagMatches(video) {
  const text = `${video.title || ''} ${video.description || ''}`.toLowerCase();
  const found = [];
  for (const [tag, pattern] of TAG_RULES) {
    const hit = text.match(pattern);
    if (hit) found.push({tag, word: hit[0]});
  }
  return found;
}
function knownCreator(value) {
  if (/f0_?olish/i.test(value || '')) return 'F0_olish';
  return CREATORS.includes(value) ? value : 'Other';
}
function enrich(video, index) {
  const matches = tagMatches(video);
  return {
    ...video,
    position: Number(video.position || index + 1),
    creator: knownCreator(video.creator || video.channelTitle),
    tags: matches.map(match => match.tag),
    tagWords: Object.fromEntries(matches.map(match => [match.tag, match.word])),
    durationSeconds: Number(video.durationSeconds) || parseClock(video.length),
    viewCount: Number(video.viewCount) || parseCompact(video.views),
    chapters: Array.isArray(video.chapters) ? video.chapters.filter(chapter => isObject(chapter) && Number.isFinite(Number(chapter.t))) : []
  };
}
function getVideo(id) { return videos.find(video => video.id === id); }
function creatorsPresent() {
  const present = new Set(videos.map(video => video.creator));
  return ['All', ...CREATORS, ...(present.has('Other') ? ['Other'] : [])];
}

/* ---------- toast + announcer ---------- */
let toastTimer = null;
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
}
function announce(message) { $('#announcer').textContent = message; }

/* ==========================================================================
   Sound: synthesized with Web Audio. No audio files, nothing before a gesture.
   ========================================================================== */
const audio = {
  ctx: null, master: null, noise: null, activated: false,
  ensure() {
    if (!settings.sound || !this.activated) return null;
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.5, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    this.master.gain.value = settings.volume * 0.9;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  bus() {
    const ctx = this.ensure();
    if (!ctx) return null;
    const gain = ctx.createGain();
    gain.connect(this.master);
    return gain;
  }
};
['pointerdown', 'keydown'].forEach(type => window.addEventListener(type, () => { audio.activated = true; }, {capture: true, passive: true}));

function envelope(ctx, gainNode, start, duration, peak, attack = 0.01) {
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.linearRampToValueAtTime(peak, start + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
}
function tone(bus, offset, duration, {type = 'sine', from = 440, to = from, gain = 0.15, attack = 0.01} = {}) {
  const ctx = audio.ctx;
  const start = ctx.currentTime + offset;
  const oscillator = ctx.createOscillator();
  const amp = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  envelope(ctx, amp, start, duration, gain, attack);
  oscillator.connect(amp).connect(bus);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}
function noise(bus, offset, duration, {filter = 'bandpass', from = 1000, to = from, q = 1, gain = 0.2, attack = 0.01} = {}) {
  const ctx = audio.ctx;
  const start = ctx.currentTime + offset;
  const source = ctx.createBufferSource();
  source.buffer = audio.noise;
  const shaping = ctx.createBiquadFilter();
  shaping.type = filter;
  shaping.Q.value = q;
  shaping.frequency.setValueAtTime(from, start);
  if (to !== from) shaping.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  const amp = ctx.createGain();
  envelope(ctx, amp, start, duration, gain, attack);
  source.connect(shaping).connect(amp).connect(bus);
  source.start(start);
  source.stop(start + duration + 0.05);
}
const SOUNDS = {
  Wemmbu(bus) {
    noise(bus, 0, 0.5, {from: 2600, to: 380, q: 1.2, gain: 0.28, attack: 0.18});
    tone(bus, 0.56, 0.45, {from: 150, to: 38, gain: 0.85});
    noise(bus, 0.56, 0.22, {filter: 'lowpass', from: 900, to: 200, gain: 0.55});
    [392, 587, 784].forEach((frequency, index) => tone(bus, 0.62 + index * 0.04, 1.5, {type: 'triangle', from: frequency, gain: 0.07, attack: 0.05}));
  },
  Parrot(bus) {
    tone(bus, 0, 0.035, {type: 'square', from: 2300, gain: 0.08});
    tone(bus, 0.06, 0.035, {type: 'square', from: 1500, gain: 0.07});
    tone(bus, 0.12, 0.55, {from: 260, to: 1150, gain: 0.1, attack: 0.08});
    noise(bus, 0.12, 0.55, {from: 600, to: 3200, q: 2, gain: 0.07, attack: 0.1});
    noise(bus, 0.65, 0.32, {from: 3000, to: 800, gain: 0.13, attack: 0.05});
  },
  Spoke(bus) {
    tone(bus, 0, 0.4, {type: 'triangle', from: 220, to: 660, gain: 0.12, attack: 0.06});
    [784, 988, 1175, 1568, 1976].forEach((frequency, index) => tone(bus, 0.32 + index * 0.07, 0.8, {type: 'triangle', from: frequency, gain: 0.08}));
    noise(bus, 0.3, 0.9, {filter: 'highpass', from: 6000, gain: 0.04, attack: 0.1});
  },
  FlameFrags(bus) {
    noise(bus, 0, 0.26, {from: 4200, to: 900, q: 1.6, gain: 0.34, attack: 0.04});
    [1240, 1830, 2620, 3410].forEach((frequency, index) => tone(bus, 0.21, 0.55 - index * 0.08, {from: frequency, gain: 0.07}));
    noise(bus, 0.24, 0.75, {filter: 'lowpass', from: 950, to: 280, gain: 0.22, attack: 0.06});
  },
  F0_olish(bus) {
    tone(bus, 0, 0.035, {type: 'square', from: 1600, gain: 0.07});
    tone(bus, 0.16, 0.04, {type: 'square', from: 950, gain: 0.08});
    tone(bus, 0.34, 0.8, {type: 'triangle', from: 659, gain: 0.09});
    tone(bus, 0.42, 0.9, {type: 'triangle', from: 988, gain: 0.08});
  },
  All(bus) {
    noise(bus, 0, 0.4, {from: 1800, to: 5000, gain: 0.06, attack: 0.15});
    [523, 659, 784, 1046].forEach((frequency, index) => tone(bus, 0.15 + index * 0.05, 1, {from: frequency, gain: 0.06, attack: 0.03}));
  },
  Other(bus) {
    tone(bus, 0, 0.04, {type: 'square', from: 1200, gain: 0.06});
    tone(bus, 0.1, 0.7, {type: 'triangle', from: 587, gain: 0.08});
  }
};
function playThemeSound(name) {
  const bus = audio.bus();
  if (!bus) return null;
  (SOUNDS[name] || SOUNDS.Other)(bus);
  return bus;
}

/* ==========================================================================
   Theme application + creator transitions
   ========================================================================== */
function themeNameFor(state = filters) {
  if (state.creator !== 'All') return state.creator;
  if (state.tag !== 'All' && themes[state.tag]) return state.tag;
  return 'All';
}
function iconNameFor(state = filters) {
  if (state.creator !== 'All') return state.creator;
  if (state.tag !== 'All') return state.tag;
  return 'All';
}
function effectiveFx() { return reducedMotion.matches ? 'minimal' : settings.preset; }

function renderMotes() {
  const count = PRESETS[effectiveFx()].motes;
  $('#fxLayer').innerHTML = `<i class="scanline"></i>` + Array.from({length: count}, (_, index) => {
    const x = (index * 37 + 7) % 100;
    const delay = -((index * 1.7) % 14);
    const duration = 10 + (index * 3) % 9;
    const size = 3 + (index % 3) * 2;
    return `<span class="mote" style="--x:${x}%;--delay:${delay}s;--duration:${duration}s;--size:${size}px;--hue:${(index * 47) % 360}"></span>`;
  }).join('');
}
function applyTheme(name = themeNameFor(), iconName = iconNameFor()) {
  const theme = themes[name] || themes.All;
  appliedTheme = name;
  appliedIcon = iconName;
  document.body.dataset.theme = theme.key;
  const root = document.documentElement.style;
  root.setProperty('--accent', theme.accent);
  root.setProperty('--accent-rgb', theme.rgb);
  root.setProperty('--accent-two', theme.two);
  $('#activeItem').src = item(iconName);
  $('#activeMode').textContent = `${iconName.toUpperCase()} MODE`;
  $('#topItem').src = item(iconName);
  $('#topMode').textContent = iconName === 'All' ? 'All creators' : iconName;
  renderArtifacts(iconName, theme);
}

/* ==========================================================================
   Interactive background: themed floating items you can grab, throw and
   click, plus a spark trail that follows the pointer. One rAF loop that
   stops when nothing moves; transforms only.
   ========================================================================== */
const ITEM_SETS = {
  All: ['nether_star.png', 'diamond.png', 'ender_eye.png', 'heart_of_the_sea.png', 'echo_shard.png', 'prismarine_shard.png'],
  Wemmbu: ['mace.png', 'wind_charge.png', 'breeze_rod.png', 'amethyst_shard.png', 'ender_pearl.png', 'enchanted_book.png'],
  Parrot: ['spyglass.png', 'feather.png', 'emerald.png', 'slime_ball.png', 'lime_dye.png', 'turtle_scute.png'],
  Spoke: ['totem_of_undying.png', 'red_dye.png', 'orange_dye.png', 'yellow_dye.png', 'lime_dye.png', 'light_blue_dye.png', 'purple_dye.png', 'magenta_dye.png'],
  FlameFrags: ['netherite_sword.png', 'blaze_powder.png', 'fire_charge.png', 'magma_cream.png', 'blaze_rod.png', 'netherite_ingot.png'],
  F0_olish: ['trial_key.png', 'gold_ingot.png', 'honeycomb.png', 'clock_00.png', 'raw_gold.png', 'glowstone_dust.png'],
  Other: ['compass_00.png', 'map.png', 'paper.png']
};
const SPARK_TINTS = {
  All: ['#ffffff', '#8fd8ff', '#b5c2ff'], Wemmbu: ['#be85ff', '#e7c8ff', '#8a4dff'], Parrot: ['#77f59c', '#d4ffe0', '#2fbf6d'],
  FlameFrags: ['#ff6d78', '#ffb36b', '#ff3d3d'], F0_olish: ['#ffc35c', '#fff2c8', '#ff9f2e'], Other: ['#ffffff', '#b9c3d6']
};
const BLOCKERS = 'button, a, input, select, textarea, label, dialog, summary, kbd, h1, h2, h3, p, .glass-card, .video-card, .shelf-card, .hotbar, .topbar, .sidebar, .sidebar-scrim, .empty-state, .toast, .new-banner';
const field = {items: [], sparks: [], rings: [], frame: 0, last: 0, drag: null, hover: null, colors: SPARK_TINTS.All, rainbow: false, canvas: null, ctx: null, w: 0, h: 0, pointer: null};

function itemSetFor(iconName) {
  if (ITEM_SETS[iconName]) return ITEM_SETS[iconName];
  return [icons[iconName] || icons.All, ...ITEM_SETS.All.slice(0, 3)];
}
function sparksEnabled() { return effectiveFx() !== 'minimal'; }
function sizeCanvas() {
  if (!field.canvas) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  field.w = innerWidth;
  field.h = innerHeight;
  field.canvas.width = Math.round(field.w * ratio);
  field.canvas.height = Math.round(field.h * ratio);
  field.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  field.ctx.imageSmoothingEnabled = false;
}
function renderArtifacts(iconName, theme) {
  const layer = $('#artifactField');
  const count = PRESETS[effectiveFx()].artifacts;
  const set = itemSetFor(iconName);
  const mainCount = Math.max(1, Math.ceil(count / 3));
  const small = innerWidth < 700 ? 0.72 : 1;
  const previous = field.items;
  field.colors = SPARK_TINTS[iconName] || [theme.accent, '#ffffff'];
  field.rainbow = iconName === 'Spoke';
  field.drag = null;
  field.hover = null;
  document.body.classList.remove('grabbing', 'over-artifact');
  layer.innerHTML = '';
  field.items = Array.from({length: count}, (_, index) => {
    const file = index < mainCount || set.length === 1 ? set[0] : set[1 + ((index - mainCount) % (set.length - 1))];
    const main = file === set[0];
    const size = Math.round((main ? 58 : 40) * small * (0.85 + Math.random() * 0.35));
    const element = document.createElement('img');
    element.className = `artifact${main ? ' main' : ''}`;
    element.src = `${ITEM_ROOT}${file}`;
    element.alt = '';
    element.draggable = false;
    element.style.width = element.style.height = `${size}px`;
    element.style.setProperty('--artifact-rgb', theme.rgb);
    element.addEventListener('error', () => { element.remove(); }, {once: true});
    layer.append(element);
    const old = previous[index];
    return {
      el: element, file, main, size,
      x: old ? old.x : size + Math.random() * Math.max(1, innerWidth - size * 2),
      y: old ? old.y : size + Math.random() * Math.max(1, innerHeight - size * 2),
      vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
      rot: old ? old.rot : Math.random() * 360, vr: (Math.random() - 0.5) * 30,
      phase: Math.random() * Math.PI * 2, pop: old ? 0.6 : 0
    };
  });
  paintItems(performance.now());
  ensureFieldLoop();
}
function paintItems() {
  for (const entry of field.items) {
    const held = field.drag?.item === entry;
    const scale = 1 + entry.pop * 0.45 + (held || field.hover === entry ? 0.14 : 0);
    entry.el.style.transform = `translate3d(${entry.x - entry.size / 2}px, ${entry.y - entry.size / 2}px, 0) rotate(${entry.rot}deg) scale(${scale})`;
  }
}
function itemAt(x, y) {
  for (let index = field.items.length - 1; index >= 0; index -= 1) {
    const entry = field.items[index];
    if (!entry.el.isConnected) continue;
    const reach = entry.size * 0.62;
    if ((x - entry.x) ** 2 + (y - entry.y) ** 2 <= reach * reach) return entry;
  }
  return null;
}
function openSpot(target) { return !(target instanceof Element) || !target.closest(BLOCKERS); }
function sparkColor(index = 0) {
  if (field.rainbow) return `hsl(${Math.round((performance.now() / 6 + index * 37) % 360)} 95% 66%)`;
  return field.colors[index % field.colors.length];
}
function spawnSparks(x, y, count, {speed = 90, life = 0.7, spread = Math.PI * 2, angle = 0, gravity = 260} = {}) {
  if (!sparksEnabled()) return;
  for (let index = 0; index < count; index += 1) {
    const direction = angle + (Math.random() - 0.5) * spread;
    const velocity = speed * (0.35 + Math.random() * 0.75);
    field.sparks.push({x, y, vx: Math.cos(direction) * velocity, vy: Math.sin(direction) * velocity, life: life * (0.6 + Math.random() * 0.6), max: life, size: 2 + Math.round(Math.random() * 2.5), color: sparkColor(index), gravity});
  }
  if (field.sparks.length > 420) field.sparks.splice(0, field.sparks.length - 420);
  ensureFieldLoop();
}
function drawEffects(dt) {
  const ctx = field.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, field.w, field.h);
  if (!field.sparks.length && !field.rings.length) return;
  ctx.globalCompositeOperation = 'lighter';
  field.sparks = field.sparks.filter(spark => {
    spark.life -= dt;
    if (spark.life <= 0) return false;
    spark.vy += spark.gravity * dt;
    spark.vx *= Math.pow(0.25, dt);
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    const alpha = Math.min(1, spark.life / spark.max * 1.4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = spark.color;
    const size = spark.size * (0.5 + alpha * 0.5);
    ctx.fillRect(Math.round(spark.x - size / 2), Math.round(spark.y - size / 2), size, size);
    return true;
  });
  field.rings = field.rings.filter(ring => {
    ring.life -= dt;
    if (ring.life <= 0) return false;
    const progress = 1 - ring.life / ring.max;
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 3 * (1 - progress) + 1;
    ctx.beginPath();
    ctx.ellipse(ring.x, ring.y, ring.radius * progress, ring.radius * progress * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    return true;
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function fieldTick(now) {
  field.frame = 0;
  const dt = Math.min(0.05, field.last ? (now - field.last) / 1000 : 0.016);
  field.last = now;
  const floating = effectiveFx() !== 'minimal';
  const width = innerWidth;
  const height = innerHeight;
  let moving = false;
  for (const entry of field.items) {
    entry.pop = Math.max(0, entry.pop - dt * 2.5);
    if (field.drag?.item === entry) { moving = true; continue; }
    if (floating) {
      entry.vx += Math.sin(now / 1700 + entry.phase) * 9 * dt;
      entry.vy += Math.cos(now / 2100 + entry.phase) * 9 * dt;
    }
    const friction = Math.pow(0.45, dt);
    entry.vx *= friction;
    entry.vy *= friction;
    entry.vr *= Math.pow(0.6, dt);
    if (floating && Math.abs(entry.vr) < 6) entry.vr += (entry.vr >= 0 ? 4 : -4) * dt;
    entry.x += entry.vx * dt;
    entry.y += entry.vy * dt;
    entry.rot += entry.vr * dt;
    const radius = entry.size / 2;
    if (entry.x < radius) { entry.x = radius; entry.vx = Math.abs(entry.vx) * 0.55; }
    if (entry.x > width - radius) { entry.x = width - radius; entry.vx = -Math.abs(entry.vx) * 0.55; }
    if (entry.y < radius) { entry.y = radius; entry.vy = Math.abs(entry.vy) * 0.55; }
    if (entry.y > height - radius) {
      const impact = entry.vy;
      entry.y = height - radius;
      entry.vy = -Math.abs(entry.vy) * 0.45;
      if (impact > 700) landImpact(entry, impact);
    }
    if (Math.abs(entry.vx) + Math.abs(entry.vy) > 4 || entry.pop > 0) moving = true;
  }
  paintItems(now);
  drawEffects(dt);
  if (!document.hidden && (floating || moving || field.sparks.length || field.rings.length)) field.frame = requestAnimationFrame(fieldTick);
  else field.last = 0;
}
function ensureFieldLoop() { if (!field.frame && !document.hidden) field.frame = requestAnimationFrame(fieldTick); }

function itemSound(entry, strength = 1) {
  const bus = audio.bus();
  if (!bus) return;
  const name = entry.file.replace('.png', '');
  if (name === 'mace') { tone(bus, 0, 0.3, {from: 170, to: 45, gain: 0.5 * strength}); noise(bus, 0, 0.16, {filter: 'lowpass', from: 900, to: 200, gain: 0.35 * strength}); tone(bus, 0.04, 0.9, {type: 'triangle', from: 587, gain: 0.05}); }
  else if (name.includes('sword') || name.includes('netherite') || name === 'trial_key' || name.includes('ingot')) { [1240, 1830, 2620].forEach(frequency => tone(bus, 0, 0.35, {from: frequency, gain: 0.05 * strength})); }
  else if (name === 'totem_of_undying') { [784, 988, 1175, 1568].forEach((frequency, index) => tone(bus, index * 0.05, 0.5, {type: 'triangle', from: frequency, gain: 0.06})); }
  else if (name === 'spyglass') { tone(bus, 0, 0.03, {type: 'square', from: 2200, gain: 0.07}); tone(bus, 0.05, 0.03, {type: 'square', from: 1500, gain: 0.06}); }
  else if (name.includes('fire') || name.includes('blaze') || name.includes('magma')) { noise(bus, 0, 0.4, {filter: 'lowpass', from: 1200, to: 300, gain: 0.2 * strength}); }
  else { tone(bus, 0, 0.45, {type: 'triangle', from: 520 + Math.random() * 500, gain: 0.07}); }
  setTimeout(() => bus.disconnect(), 1600);
}
function clickItem(entry) {
  entry.pop = 1;
  entry.vr += (Math.random() < 0.5 ? -1 : 1) * 620;
  entry.vy -= 60;
  spawnSparks(entry.x, entry.y, 26, {speed: 220, life: 0.8});
  field.rings.push({x: entry.x, y: entry.y, radius: entry.size * 2.2, life: 0.45, max: 0.45, color: sparkColor(1)});
  itemSound(entry);
  ensureFieldLoop();
}
function landImpact(entry, impact) {
  const strength = Math.min(1, impact / 1800);
  spawnSparks(entry.x, entry.y + entry.size / 2, Math.round(14 + strength * 26), {speed: 160 + strength * 200, angle: -Math.PI / 2, spread: Math.PI * 0.9, life: 0.7});
  if (entry.file === 'mace.png') field.rings.push({x: entry.x, y: entry.y + entry.size / 2, radius: 120 + strength * 220, life: 0.6, max: 0.6, color: sparkColor(0)});
  itemSound(entry, 0.5 + strength * 0.5);
}

(function initField() {
  field.canvas = $('#sparkCanvas');
  field.ctx = field.canvas.getContext('2d');
  sizeCanvas();
  window.addEventListener('resize', () => {
    sizeCanvas();
    for (const entry of field.items) { entry.x = clamp(entry.x, entry.size / 2, innerWidth - entry.size / 2); entry.y = clamp(entry.y, entry.size / 2, innerHeight - entry.size / 2); }
    paintItems();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { field.last = 0; ensureFieldLoop(); } });
  window.addEventListener('pointerdown', event => {
    if (event.button !== 0 || document.querySelector('dialog:modal') || !openSpot(event.target)) return;
    const entry = itemAt(event.clientX, event.clientY);
    if (!entry) return;
    event.preventDefault();
    const now = performance.now();
    field.drag = {item: entry, id: event.pointerId, startX: event.clientX, startY: event.clientY, start: now, offsetX: entry.x - event.clientX, offsetY: entry.y - event.clientY, trail: [{x: event.clientX, y: event.clientY, t: now}]};
    entry.vx = entry.vy = 0;
    entry.el.classList.add('held');
    document.body.classList.add('grabbing');
    ensureFieldLoop();
  });
  window.addEventListener('pointermove', event => {
    const now = performance.now();
    const drag = field.drag;
    if (drag && drag.id === event.pointerId) {
      drag.item.x = clamp(event.clientX + drag.offsetX, 0, innerWidth);
      drag.item.y = clamp(event.clientY + drag.offsetY, 0, innerHeight);
      drag.trail.push({x: event.clientX, y: event.clientY, t: now});
      if (drag.trail.length > 6) drag.trail.shift();
    } else if (event.pointerType === 'mouse') {
      const hovered = openSpot(event.target) && !document.querySelector('dialog:modal') ? itemAt(event.clientX, event.clientY) : null;
      if (hovered !== field.hover) {
        field.hover?.el.classList.remove('hot');
        hovered?.el.classList.add('hot');
        field.hover = hovered;
        document.body.classList.toggle('over-artifact', Boolean(hovered));
        paintItems();
      }
    }
    if (sparksEnabled() && !document.querySelector('dialog:modal')) {
      const previous = field.pointer;
      field.pointer = {x: event.clientX, y: event.clientY};
      const distance = previous ? Math.hypot(event.clientX - previous.x, event.clientY - previous.y) : 0;
      const count = Math.min(5, Math.floor(distance / 9)) + (effectiveFx() === 'cinematic' ? 1 : 0);
      if (count) spawnSparks(event.clientX, event.clientY, count, {speed: 45, life: 0.55, gravity: 140});
    }
  }, {passive: true});
  const release = event => {
    const drag = field.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const entry = drag.item;
    field.drag = null;
    entry.el.classList.remove('held');
    document.body.classList.remove('grabbing');
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (moved < 6 && performance.now() - drag.start < 400) { clickItem(entry); return; }
    const first = drag.trail[0];
    const last = drag.trail[drag.trail.length - 1];
    const span = Math.max(16, last.t - first.t);
    entry.vx = clamp((last.x - first.x) / span * 1000, -2600, 2600);
    entry.vy = clamp((last.y - first.y) / span * 1000, -2600, 2600);
    entry.vr += entry.vx * 0.4;
    ensureFieldLoop();
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
})();

const transitionLayer = $('#transitionLayer');
let activeRun = null;

function createRun(name) {
  const run = {name, anims: [], timers: [], nodes: [], bus: null, applied: false, done: false, startedAt: performance.now()};
  run.apply = () => { if (!run.applied) { run.applied = true; applyTheme(name, iconNameFor()); } };
  run.at = (ms, callback) => { run.timers.push(setTimeout(() => { if (!run.done) callback(); }, ms)); };
  run.node = (className, attributes = {}) => {
    const element = document.createElement(attributes.tag || 'div');
    element.className = className;
    if (attributes.src) { element.src = attributes.src; element.alt = ''; }
    if (attributes.style) element.setAttribute('style', attributes.style);
    if (attributes.html) element.innerHTML = attributes.html;
    transitionLayer.append(element);
    run.nodes.push(element);
    return element;
  };
  run.animate = (element, keyframes, options) => {
    const animation = element.animate(keyframes, {fill: 'both', ...options});
    run.anims.push(animation);
    return animation;
  };
  run.finish = (applyTarget = true) => {
    if (run.done) return;
    run.done = true;
    run.timers.forEach(clearTimeout);
    run.anims.forEach(animation => { try { animation.cancel(); } catch { /* already gone */ } });
    run.nodes.forEach(node => node.remove());
    if (run.bus && audio.ctx) {
      const now = audio.ctx.currentTime;
      run.bus.gain.cancelScheduledValues(now);
      run.bus.gain.setTargetAtTime(0, now, applyTarget ? 0.25 : 0.03);
    }
    if (applyTarget) run.apply();
    if (activeRun === run) {
      activeRun = null;
      transitionLayer.classList.remove('active');
      document.body.classList.remove('transitioning');
    }
  };
  return run;
}

function burst(run, {x = '50%', y = '50%', count, colors, spread = 280, delay = 0, rainbow = false}) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = spread * (0.35 + Math.random() * 0.65);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const size = 5 + Math.round(Math.random() * 6);
    const color = rainbow ? `hsl(${Math.round(index / count * 360)} 95% 68%)` : colors[index % colors.length];
    const particle = run.node('px', {style: `left:${x};top:${y};width:${size}px;height:${size}px;background:${color};box-shadow:0 0 10px ${color}`});
    run.animate(particle, [
      {transform: 'translate(-50%,-50%) scale(1)', opacity: 1},
      {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.round(Math.random() * 180)}deg) scale(.9)`, opacity: 0.9, offset: 0.65},
      {transform: `translate(calc(-50% + ${dx * 1.12}px), calc(-50% + ${dy * 1.12 + 46}px)) scale(.3)`, opacity: 0}
    ], {duration: 700 + Math.random() * 450, delay, easing: 'cubic-bezier(.15,.7,.3,1)'});
  }
}
function ring(run, {delay = 0, color, size = '14vmin', scale = 14, duration = 820, width = 3}) {
  const element = run.node('ring', {style: `width:${size};height:${size};border:${width}px solid ${color};box-shadow:0 0 24px ${color}, inset 0 0 18px ${color}`});
  run.animate(element, [
    {transform: 'translate(-50%,-50%) scale(.1)', opacity: 0.95},
    {transform: `translate(-50%,-50%) scale(${scale})`, opacity: 0}
  ], {duration, delay, easing: 'cubic-bezier(.2,.65,.3,1)'});
}
function flash(run, {delay = 0, color, peak = 0.35, duration = 380}) {
  const element = run.node('flash', {style: `background:radial-gradient(circle at 50% 50%, ${color}, transparent 70%)`});
  run.animate(element, [{opacity: 0}, {opacity: peak, offset: 0.25}, {opacity: 0}], {duration, delay, easing: 'ease-out'});
}
function shake(run, delay) {
  const main = document.querySelector('main');
  run.at(delay, () => run.animate(main, [
    {transform: 'translate3d(0,0,0)'}, {transform: 'translate3d(0,7px,0)'}, {transform: 'translate3d(-4px,-3px,0)'}, {transform: 'translate3d(3px,2px,0)'}, {transform: 'translate3d(0,0,0)'}
  ], {duration: 320, easing: 'ease-out', fill: 'none'}));
}
function hero(run, name, extraClass = '') { return run.node(`hero-item ${extraClass}`, {tag: 'img', src: item(name)}); }

const TRANSITIONS = {
  Wemmbu(run, preset) {
    const theme = themes.Wemmbu;
    const mace = hero(run, 'Wemmbu', 'enchanted');
    run.animate(mace, [
      {transform: 'translate(-50%, calc(-50% - 75vh)) rotate(-42deg) scale(1.1)', opacity: 1},
      {transform: 'translate(-50%, -50%) rotate(10deg) scale(1.1)', opacity: 1, offset: 0.42, easing: 'cubic-bezier(.3,0,.2,1)'},
      {transform: 'translate(-50%, calc(-50% - 10px)) rotate(-5deg) scale(1.05)', opacity: 1, offset: 0.5},
      {transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1, offset: 0.6},
      {transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1, offset: 0.78},
      {transform: 'translate(-50%, -50%) rotate(0deg) scale(.7)', opacity: 0}
    ], {duration: 1330, easing: 'cubic-bezier(.55,0,1,.45)'});
    run.at(560, () => {
      flash(run, {color: `rgba(${theme.rgb},.9)`});
      for (let index = 0; index < preset.rings; index += 1) ring(run, {color: theme.accent, delay: index * 130});
      burst(run, {count: preset.particles, colors: [theme.accent, '#e3c9ff', '#7d47d8']});
      if (preset.shake) shake(run, 0);
      run.apply();
    });
    run.at(1400, () => run.finish());
  },
  Parrot(run, preset) {
    const theme = themes.Parrot;
    const glass = hero(run, 'Parrot');
    run.animate(glass, [
      {transform: 'translate(-50%,-50%) rotate(-28deg) scale(.4)', opacity: 0},
      {transform: 'translate(-50%,-50%) rotate(-8deg) scale(1.1)', opacity: 1, offset: 0.45},
      {transform: 'translate(-50%,-50%) rotate(0deg) scale(2.4)', opacity: 0}
    ], {duration: 620, easing: 'cubic-bezier(.3,.7,.3,1)'});
    const lens = run.node('lens', {html: '<i class="lens-cross"></i><i class="lens-cross v"></i><i class="lens-sweep"></i>', style: `--lens-rgb:${theme.rgb}`});
    run.animate(lens, [
      {transform: 'translate(-50%,-50%) scale(.04)', opacity: 0},
      {transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.36},
      {transform: 'translate(-50%,-50%) scale(1.05)', opacity: 1, offset: 0.62},
      {transform: 'translate(-50%,-50%) scale(8)', opacity: 0}
    ], {duration: 1350, delay: 260, easing: 'cubic-bezier(.45,.05,.3,1)'});
    run.at(820, () => run.apply());
    run.at(1100, () => burst(run, {count: preset.particles, colors: [theme.accent, '#c7ffd6', '#2fbf6d'], spread: 340}));
    run.at(1700, () => run.finish());
  },
  Spoke(run, preset) {
    const disc = run.node('rainbow-disc');
    run.animate(disc, [
      {transform: 'translate(-50%,-50%) scale(.05) rotate(0deg)', opacity: 0},
      {transform: 'translate(-50%,-50%) scale(.9) rotate(80deg)', opacity: 0.75, offset: 0.5},
      {transform: 'translate(-50%,-50%) scale(1.7) rotate(150deg)', opacity: 0}
    ], {duration: 1350, delay: 380, easing: 'cubic-bezier(.25,.6,.3,1)'});
    const totem = hero(run, 'Spoke', 'totem');
    run.animate(totem, [
      {transform: 'translate(-50%,-40%) perspective(400px) rotateY(0deg) scale(0)', opacity: 0},
      {transform: 'translate(-50%,-50%) perspective(400px) rotateY(540deg) scale(1.45)', opacity: 1, offset: 0.45},
      {transform: 'translate(-50%,-55%) perspective(400px) rotateY(720deg) scale(1.2)', opacity: 1, offset: 0.7},
      {transform: 'translate(-50%,-75%) perspective(400px) rotateY(720deg) scale(1)', opacity: 0}
    ], {duration: 1300, easing: 'cubic-bezier(.2,.8,.3,1)'});
    run.at(540, () => {
      flash(run, {color: 'rgba(255,240,160,.9)', peak: 0.3});
      burst(run, {count: preset.particles + 6, rainbow: true, spread: 360});
      for (let index = 0; index < preset.rings; index += 1) ring(run, {color: index ? '#4ecdf4' : '#ff85d3', delay: index * 120});
      run.apply();
    });
    run.at(1800, () => run.finish());
  },
  FlameFrags(run, preset) {
    const theme = themes.FlameFrags;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const angle = Math.atan2(height, width);
    const travel = Math.hypot(width, height) * 0.62;
    const dx = Math.cos(angle) * travel;
    const dy = Math.sin(angle) * travel;
    const wipe = run.node('slash-wipe', {style: `--slash-rgb:${theme.rgb}`});
    run.animate(wipe, [
      {clipPath: 'polygon(0 0, 0 0, 0 0)', opacity: 1},
      {clipPath: 'polygon(0 0, 230% 0, 0 230%)', opacity: 1, offset: 0.4},
      {clipPath: 'polygon(0 0, 230% 0, 0 230%)', opacity: 0}
    ], {duration: 1050, delay: 60, easing: 'cubic-bezier(.6,0,.3,1)'});
    const trail = run.node('slash-trail', {style: `--slash-rgb:${theme.rgb};transform:translate(-50%,-50%) rotate(${angle}rad)`});
    run.animate(trail, [
      {clipPath: 'inset(0 100% 0 0)', opacity: 1, transform: `translate(-50%,-50%) rotate(${angle}rad) scaleY(1)`},
      {clipPath: 'inset(0 0 0 0)', opacity: 1, transform: `translate(-50%,-50%) rotate(${angle}rad) scaleY(1.4)`, offset: 0.35},
      {clipPath: 'inset(0 0 0 0)', opacity: 0, transform: `translate(-50%,-50%) rotate(${angle}rad) scaleY(.2)`}
    ], {duration: 900, easing: 'cubic-bezier(.5,0,.2,1)'});
    const sword = hero(run, 'FlameFrags', 'sword');
    run.animate(sword, [
      {transform: `translate(calc(-50% - ${dx}px), calc(-50% - ${dy}px)) rotate(90deg) scale(1.15)`, opacity: 1},
      {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(110deg) scale(1.15)`, opacity: 1}
    ], {duration: 380, easing: 'cubic-bezier(.55,0,.35,1)'});
    run.at(300, () => {
      burst(run, {count: preset.particles, colors: [theme.accent, '#ffb36b', '#ff3d3d'], spread: 300});
      if (preset.shake) shake(run, 0);
    });
    run.at(470, () => run.apply());
    run.at(1250, () => run.finish());
  },
  F0_olish(run, preset) {
    const theme = themes.F0_olish;
    const key = hero(run, 'F0_olish');
    run.animate(key, [
      {transform: 'translate(-50%,-50%) rotate(-90deg) scale(.3)', opacity: 0},
      {transform: 'translate(-50%,-50%) rotate(0deg) scale(1.1)', opacity: 1, offset: 0.25},
      {transform: 'translate(-50%,-50%) rotate(0deg) scale(1.1)', opacity: 1, offset: 0.35},
      {transform: 'translate(-50%,-50%) rotate(90deg) scale(1.1)', opacity: 1, offset: 0.55, easing: 'steps(3, end)'},
      {transform: 'translate(-50%,-50%) rotate(90deg) scale(1)', opacity: 1, offset: 0.75},
      {transform: 'translate(-50%,-50%) rotate(90deg) scale(.6)', opacity: 0}
    ], {duration: 1200, easing: 'cubic-bezier(.3,.7,.3,1)'});
    run.at(640, () => {
      flash(run, {color: `rgba(${theme.rgb},.85)`, peak: 0.28});
      ring(run, {color: theme.accent, scale: 12});
      if (preset.rings > 1) ring(run, {color: '#fff2c8', delay: 110, scale: 9, width: 2});
      burst(run, {count: preset.particles, colors: [theme.accent, '#fff2c8', '#c77b25']});
      run.apply();
    });
    run.at(1350, () => run.finish());
  },
  All(run, preset) {
    const theme = themes.All;
    const star = hero(run, 'All');
    run.animate(star, [
      {transform: 'translate(-50%,-50%) rotate(-120deg) scale(0)', opacity: 0},
      {transform: 'translate(-50%,-50%) rotate(0deg) scale(1.3)', opacity: 1, offset: 0.45},
      {transform: 'translate(-50%,-50%) rotate(30deg) scale(1.1)', opacity: 1, offset: 0.7},
      {transform: 'translate(-50%,-50%) rotate(60deg) scale(.5)', opacity: 0}
    ], {duration: 1100, easing: 'cubic-bezier(.2,.8,.3,1)'});
    run.at(470, () => {
      flash(run, {color: 'rgba(220,245,255,.9)', peak: 0.3});
      for (let index = 0; index < preset.rings; index += 1) ring(run, {color: index ? '#5a6cff' : theme.accent, delay: index * 120});
      burst(run, {count: preset.particles, colors: ['#ffffff', theme.accent, '#b5c2ff']});
      run.apply();
    });
    run.at(1200, () => run.finish());
  },
  Other(run, preset) {
    const theme = themes.Other;
    const compass = hero(run, 'Other');
    run.animate(compass, [
      {transform: 'translate(-50%,-50%) rotate(0deg) scale(.4)', opacity: 0},
      {transform: 'translate(-50%,-50%) rotate(360deg) scale(1.1)', opacity: 1, offset: 0.6},
      {transform: 'translate(-50%,-50%) rotate(380deg) scale(.6)', opacity: 0}
    ], {duration: 950, easing: 'cubic-bezier(.3,.7,.3,1)'});
    run.at(520, () => { ring(run, {color: theme.accent}); burst(run, {count: Math.round(preset.particles / 2), colors: [theme.accent, '#ffffff']}); run.apply(); });
    run.at(1050, () => run.finish());
  }
};

function canAnimate() { return settings.transitions && effectiveFx() !== 'minimal' && typeof Element.prototype.animate === 'function'; }
function transitionTo(name) {
  if (activeRun) activeRun.finish(false);
  const preset = PRESETS[effectiveFx()];
  const bus = playThemeSound(name);
  if (!canAnimate()) {
    if (bus) setTimeout(() => bus.disconnect(), 2500);
    applyTheme(name, iconNameFor());
    return;
  }
  const run = createRun(name);
  run.bus = bus;
  activeRun = run;
  transitionLayer.classList.add('active');
  document.body.classList.add('transitioning');
  (TRANSITIONS[name] || TRANSITIONS.Other)(run, preset);
  run.node('skip-hint', {html: 'Click or press Esc to skip'});
}
function skipTransition() { if (activeRun) activeRun.finish(true); }
document.addEventListener('pointerdown', event => {
  if (!activeRun || performance.now() - activeRun.startedAt < 160) return;
  if (event.target.closest('[data-filter-group="creator"], [data-hotbar-creator]')) return;
  skipTransition();
}, true);

function syncTheme(animate) {
  const name = themeNameFor();
  const icon = iconNameFor();
  if (activeRun && activeRun.name === name) return;
  if (animate && name !== appliedTheme && TRANSITIONS[name]) { transitionTo(name); return; }
  if (name !== appliedTheme || icon !== appliedIcon) {
    if (activeRun) activeRun.finish(false);
    applyTheme(name, icon);
  }
}

/* ==========================================================================
   Filtering, sorting, URL state
   ========================================================================== */
function allTags() { return [...new Set(videos.flatMap(video => video.tags))]; }
function filterDefinitions() {
  return [
    {key: 'creator', label: 'CREATORS', values: creatorsPresent()},
    {key: 'collection', label: 'MY LIBRARY', values: ['All', 'New uploads', 'In progress', 'Watched', 'Not started', 'Favorites', 'Watch later', 'Rated', 'Bookmarked', 'Longform']},
    {key: 'tag', label: 'KEYWORD TAGS', values: ['All', ...allTags()]}
  ];
}
function countFor(group, value) {
  if (value === 'All') return null;
  const probe = {...filters, [group]: value};
  return videos.filter(video => matches(video, probe)).length;
}
const COLLECTION_LABELS = {All: 'Everything'};
function sideRow(group, value, label) {
  const theme = themes[value] || themes.All;
  const active = filters[group] === value;
  const count = videos.length ? (value === 'All' ? (group === 'creator' ? videos.length : null) : countFor(group, value)) : null;
  return `<button class="side-row ${active ? 'active' : ''}" type="button" aria-pressed="${active}" data-filter-group="${group}" data-filter-value="${escapeHTML(value)}" title="${escapeHTML(label)}" style="--row-rgb:${theme.rgb};--row-accent:${theme.accent}"><span class="row-icon"><img src="${item(value)}" alt=""></span><span class="side-text row-label">${escapeHTML(label)}</span>${count === null ? '' : `<span class="side-text row-count">${count}</span>`}</button>`;
}
function renderFilters() {
  const [creators, collections, tags] = filterDefinitions();
  $('#creatorList').innerHTML = creators.values.map(value => sideRow('creator', value, value === 'All' ? 'All creators' : value)).join('');
  $('#collectionList').innerHTML = collections.values.map(value => sideRow('collection', value, COLLECTION_LABELS[value] || value)).join('');
  $('#tagList').innerHTML = tags.values.length > 1 ? tags.values.map(value => {
    const theme = themes[value] || themes.All;
    const active = filters.tag === value;
    return `<button class="side-chip ${active ? 'active' : ''}" type="button" aria-pressed="${active}" data-filter-group="tag" data-filter-value="${escapeHTML(value)}" style="--row-rgb:${theme.rgb}"><img src="${item(value)}" alt="">${escapeHTML(value === 'All' ? 'Any' : value)}</button>`;
  }).join('') : '<p class="side-note">Tags appear once the playlist loads.</p>';
  const any = filters.creator !== 'All' || filters.collection !== 'All' || filters.tag !== 'All' || filters.search || filters.length !== 'any' || filters.year !== 'any';
  $('#clearFiltersSide').hidden = !any;
}
function lengthBucket(seconds) {
  if (!seconds) return 'any';
  if (seconds < 1200) return 'short';
  if (seconds <= 2700) return 'medium';
  return 'long';
}
function yearOf(video) { const date = new Date(video.publishedAt || video.date); return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear()); }
function matches(video, state = filters) {
  if (state.creator !== 'All' && video.creator !== state.creator) return false;
  const status = statusFor(video);
  if (state.collection === 'New uploads' && !isNewUpload(video, NEW_FILTER_DAYS)) return false;
  if (state.collection === 'In progress' && status !== 'In progress') return false;
  if (state.collection === 'Watched' && status !== 'Watched') return false;
  if (state.collection === 'Not started' && status !== 'Not started') return false;
  if (state.collection === 'Favorites' && !profile.favorites[video.id]) return false;
  if (state.collection === 'Watch later' && !profile.watchLater[video.id]) return false;
  if (state.collection === 'Rated' && !ratingFor(video.id)) return false;
  if (state.collection === 'Bookmarked' && !(profile.bookmarks[video.id] || []).length) return false;
  if (state.collection === 'Longform' && !/^([1-9]\d*):\d\d:\d\d/.test(video.length || '')) return false;
  if (state.tag !== 'All' && !video.tags.includes(state.tag)) return false;
  if (state.length !== 'any' && lengthBucket(video.durationSeconds) !== state.length) return false;
  if (state.year !== 'any' && yearOf(video) !== state.year) return false;
  const words = state.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = `${video.title} ${video.creator} ${video.description} ${video.tags.join(' ')}`.toLowerCase();
  return words.every(word => haystack.includes(word));
}
const byDate = video => new Date(video.publishedAt || video.date).getTime() || 0;
// "New" is measured from the last successful Refresh playlist, not from whenever the page is viewed.
function referenceTime() { return Number(catalogMeta.refreshedAt) || Date.now(); }
function isNewUpload(video, days) {
  const published = byDate(video);
  const reference = referenceTime();
  return Boolean(published) && published <= reference + 3600000 && reference - published <= days * DAY;
}
function uploadedAgo(video) {
  const hours = Math.max(0, Math.round((Date.now() - byDate(video)) / 3600000));
  if (hours < 1) return 'less than an hour ago';
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}
function dismissedNew() { const list = safeRead(DISMISSED_KEY, []); return Array.isArray(list) ? list : []; }
function renderNewBanner() {
  const banner = $('#newBanner');
  const dismissed = dismissedNew();
  const fresh = videos.filter(video => isNewUpload(video, NEW_BANNER_DAYS)).sort((a, b) => byDate(b) - byDate(a));
  const lead = fresh.find(video => !dismissed.includes(video.id) && statusFor(video) !== 'Watched');
  if (!lead) { banner.hidden = true; banner.innerHTML = ''; return; }
  const theme = themes[lead.creator] || themes.Other;
  const others = fresh.length - 1;
  banner.style.setProperty('--card-rgb', theme.rgb);
  banner.innerHTML = `<div class="new-banner-art"><img src="${escapeHTML(lead.thumbnail || `https://i.ytimg.com/vi/${lead.id}/hqdefault.jpg`)}" alt=""><span class="duration-badge">${escapeHTML(lead.length || '')}</span></div>
    <div class="new-banner-copy">
      <p class="new-kicker"><span class="new-dot"></span>Uploaded ${uploadedAgo(lead)}</p>
      <h2 class="new-headline">New Unstable video!</h2>
      <p class="new-title">${escapeHTML(lead.title)}</p>
      <p class="new-meta"><img src="${item(lead.creator)}" alt="">${escapeHTML(lead.creator)} · ${escapeHTML(lead.date || '')}</p>
      <div class="new-actions"><button class="primary-action" type="button" data-play="${lead.id}">Watch now</button>${others > 0 ? `<button class="quiet-action" type="button" data-shelf-filter="New uploads">See all ${fresh.length} new uploads</button>` : ''}<button class="text-button" type="button" data-dismiss-new="${lead.id}">Dismiss</button></div>
    </div>`;
  banner.hidden = false;
}
function orderedVideos() {
  const found = videos.filter(video => matches(video));
  const sorters = {
    newest: (a, b) => byDate(b) - byDate(a),
    oldest: (a, b) => byDate(a) - byDate(b),
    views: (a, b) => b.viewCount - a.viewCount,
    rating: (a, b) => ratingFor(b.id) - ratingFor(a.id) || a.position - b.position,
    longest: (a, b) => b.durationSeconds - a.durationSeconds,
    shortest: (a, b) => a.durationSeconds - b.durationSeconds,
    playlist: (a, b) => a.position - b.position
  };
  return [...found].sort(sorters[filters.sort] || sorters.playlist);
}

const URL_KEYS = {creator: 'creator', collection: 'list', tag: 'tag', search: 'q', sort: 'sort', length: 'len', year: 'year'};
function writeURL() {
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(URL_KEYS)) {
    const value = filters[key];
    if (value && !['All', 'any', 'playlist', ''].includes(value)) params.set(param, value);
  }
  if (activeVideoId && $('#playerDialog').open) params.set('v', activeVideoId);
  const query = params.toString();
  const next = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
  if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', next);
}
function readURL() {
  const params = new URLSearchParams(location.search);
  for (const [key, param] of Object.entries(URL_KEYS)) {
    const value = params.get(param);
    if (value) filters[key] = value.slice(0, 80);
  }
  if (filters.creator !== 'All') filters.creator = filters.creator === 'Other' ? 'Other' : (CREATORS.find(name => name.toLowerCase() === filters.creator.toLowerCase()) || 'All');
  const video = params.get('v');
  if (video && /^[\w-]{11}$/.test(video)) pendingVideoFromURL = video;
  return params.has('creator');
}
function shareURL(videoId) {
  const url = new URL(location.href);
  url.hash = '';
  if (videoId) { url.search = ''; url.searchParams.set('v', videoId); }
  return url.toString();
}
async function copyText(text, message) {
  try { await navigator.clipboard.writeText(text); toast(message); } catch { window.prompt('Copy this link:', text); }
}

/* ==========================================================================
   Rendering
   ========================================================================== */
function ratingMarkup(video) {
  const rating = ratingFor(video.id);
  return `<div class="rating-row"><span class="rating-caption">YOUR RATING ${rating ? `· ${rating}/5` : ''}</span><div class="shards" role="group" aria-label="Rate ${escapeHTML(video.title)}">${Array.from({length: 5}, (_, index) => `<button class="shard ${index < rating ? 'active' : ''}" type="button" data-rate="${index + 1}" data-id="${video.id}" aria-label="Rate ${index + 1} out of 5" aria-pressed="${index < rating}"><img src="${item('Rated')}" alt=""></button>`).join('')}</div></div>`;
}
function iconButton({data, id, label, icon, active, extra = ''}) {
  return `<button class="icon-action ${active ? 'on' : ''}" type="button" data-${data}="${id}" aria-label="${escapeHTML(label)}" aria-pressed="${Boolean(active)}" title="${escapeHTML(label)}" ${extra}><img src="${item(icon)}" alt=""></button>`;
}
function cardMarkup(video) {
  const rating = ratingFor(video.id);
  const status = statusFor(video);
  const progress = percentFor(video);
  const favorite = Boolean(profile.favorites[video.id]);
  const later = Boolean(profile.watchLater[video.id]);
  const marks = (profile.bookmarks[video.id] || []).length;
  const theme = themes[video.creator] || themes.Other;
  const tagHTML = video.tags.length ? video.tags.slice(0, 3).map(tag => `<span class="tag" title="Keyword match: “${escapeHTML(video.tagWords?.[tag] || tag.toLowerCase())}”">${escapeHTML(tag)}</span>`).join('') : '<span class="tag">Playlist</span>';
  const description = escapeHTML(video.description || 'No description was provided by the playlist.');
  const thumbnail = escapeHTML(video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`);
  const title = escapeHTML(video.title);
  return `<article class="video-card status-${status.toLowerCase().replace(' ', '-')}" style="--rating-glow:${rating / 5};--card-rgb:${theme.rgb};--card-accent:${theme.accent}">
    <button class="card-art" type="button" data-play="${video.id}" aria-label="Play ${title}"><img src="${thumbnail}" alt="" loading="lazy" decoding="async"><span class="episode-order">#${String(video.position).padStart(2, '0')}</span><span class="duration-badge">${escapeHTML(video.length || '—')}</span><span class="video-status">${status}${status === 'In progress' ? ` · ${progress}%` : ''}</span><span class="play-glyph" aria-hidden="true"></span></button>
    <div class="card-content"><div class="creator-line"><span class="creator-badge"><img src="${item(video.creator)}" alt="">${escapeHTML(video.creator)}</span><span>${escapeHTML(video.views || '—')} views</span></div>
      <h3 class="video-title">${title}</h3><p class="video-meta">${escapeHTML(video.date || 'Unknown date')}${video.ago ? ` · ${escapeHTML(video.ago)}` : ''}${marks ? ` · ${marks} bookmark${marks > 1 ? 's' : ''}` : ''}</p>
      <p class="video-description">${description}</p>
      <div class="tag-row">${tagHTML}</div>
      <div class="progress-track" title="${progress}% watched"><i style="--progress:${progress}%"></i></div>
      ${ratingMarkup(video)}
      <div class="card-actions"><button class="card-action watch" type="button" data-play="${video.id}">${status === 'In progress' ? 'Resume' : 'Watch'}</button>
        ${iconButton({data: 'favorite', id: video.id, label: favorite ? 'Remove from favorites' : 'Add to favorites', icon: 'Favorites', active: favorite})}
        ${iconButton({data: 'later', id: video.id, label: later ? 'Remove from watch later' : 'Add to watch later', icon: 'Watch later', active: later})}
        ${iconButton({data: 'watched', id: video.id, label: status === 'Watched' ? 'Unmark watched' : 'Mark watched', icon: 'Watched', active: status === 'Watched'})}
        <a class="icon-action yt" href="https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}&list=${PLAYLIST_ID}" target="_blank" rel="noreferrer" aria-label="Open on YouTube" title="Open on YouTube">YT</a></div>
    </div></article>`;
}
function renderSkeletons() { $('#videoGrid').innerHTML = Array.from({length: 8}, () => $('#loadingCard').innerHTML).join(''); }
function renderYearOptions() {
  const years = [...new Set(videos.map(yearOf).filter(Boolean))].sort();
  const select = $('#yearSelect');
  const wanted = ['any', ...years].join('|');
  if (select.dataset.years !== wanted) {
    select.innerHTML = '<option value="any">Any year</option>' + years.map(year => `<option value="${year}">${year}</option>`).join('');
    select.dataset.years = wanted;
  }
  if (filters.year !== 'any' && !years.includes(filters.year) && videos.length) filters.year = 'any';
  select.value = filters.year;
}
function renderEmpty() {
  const [title, text] = (filters.search && ['No videos match that search.', 'Check the spelling, or try a creator name or a single word.']) || COLLECTION_EMPTY[filters.collection] || ['No videos match this view.', 'Try clearing a filter or search phrase.'];
  $('#emptyTitle').textContent = title;
  $('#emptyText').textContent = text;
  $('#emptyIcon').src = item(filters.collection !== 'All' ? filters.collection : iconNameFor());
}
function shelfCard(video, kind) {
  const progress = percentFor(video);
  const theme = themes[video.creator] || themes.Other;
  return `<button class="shelf-card" type="button" data-play="${video.id}" style="--card-rgb:${theme.rgb}"><span class="shelf-thumb"><img src="${escapeHTML(video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`)}" alt="" loading="lazy"><span class="duration-badge">${escapeHTML(video.length || '')}</span></span><span class="shelf-text"><span class="shelf-creator"><img src="${item(video.creator)}" alt="">${escapeHTML(video.creator)}</span><strong>${escapeHTML(video.title)}</strong><span class="shelf-meta">${kind === 'progress' ? `${formatSeconds(progressFor(video.id).seconds)} in · ${progress}%` : `Queued · ${escapeHTML(video.length || '')}`}</span></span>${kind === 'progress' ? `<span class="progress-track"><i style="--progress:${progress}%"></i></span>` : ''}</button>`;
}
function renderShelves() {
  const inProgress = videos.filter(video => statusFor(video) === 'In progress').sort((a, b) => (progressFor(b.id).updatedAt || 0) - (progressFor(a.id).updatedAt || 0)).slice(0, 8);
  const later = videos.filter(video => profile.watchLater[video.id] && statusFor(video) !== 'Watched').sort((a, b) => Number(profile.watchLater[b.id]) - Number(profile.watchLater[a.id])).slice(0, 8);
  const rows = [];
  if (inProgress.length) rows.push(`<div class="shelf"><div class="shelf-head"><h2>Continue watching</h2><button class="text-button" type="button" data-shelf-filter="In progress">See all</button></div><div class="shelf-row">${inProgress.map(video => shelfCard(video, 'progress')).join('')}</div></div>`);
  if (later.length) rows.push(`<div class="shelf"><div class="shelf-head"><h2>Watch later</h2><button class="text-button" type="button" data-shelf-filter="Watch later">See all</button></div><div class="shelf-row">${later.map(video => shelfCard(video, 'later')).join('')}</div></div>`);
  $('#shelfZone').innerHTML = rows.join('');
  $('#shelfZone').hidden = !rows.length;
}
function renderLibrary(options = {}) {
  syncTheme(options.animate);
  renderFilters();
  renderYearOptions();
  $('#sortSelect').value = filters.sort;
  $('#lengthSelect').value = filters.length;
  const found = orderedVideos();
  $('#catalogCount').textContent = String(videos.length);
  $('#resultsText').textContent = videos.length ? `${found.length} of ${videos.length} videos` : 'Loading official playlist…';
  renderEmpty();
  $('#emptyState').hidden = Boolean(found.length || (loading && !videos.length));
  if (!videos.length && loading) renderSkeletons();
  else $('#videoGrid').innerHTML = found.map(cardMarkup).join('');
  renderShelves();
  renderNewBanner();
  renderHotbar();
  updateProfileUI();
  writeURL();
}
function creatorStats() {
  return creatorsPresent().filter(name => name !== 'All').map(name => {
    const list = videos.filter(video => video.creator === name);
    const watched = list.filter(video => statusFor(video) === 'Watched').length;
    const rated = list.map(video => ratingFor(video.id)).filter(Boolean);
    return {name, total: list.length, watched, average: rated.length ? rated.reduce((sum, value) => sum + value, 0) / rated.length : 0, ratedCount: rated.length};
  }).filter(entry => entry.total);
}
function hoursWatched() {
  let seconds = 0;
  for (const video of videos) {
    const progress = progressFor(video.id);
    seconds += progress.completed ? (progress.duration || video.durationSeconds || 0) : (progress.seconds || 0);
  }
  return seconds / 3600;
}
function updateProfileUI() {
  const watched = videos.filter(video => statusFor(video) === 'Watched').length;
  const inProgress = videos.filter(video => statusFor(video) === 'In progress').length;
  const percent = videos.length ? Math.round(watched / videos.length * 100) : 0;
  $('#watchedCount').textContent = String(watched);
  $('#inProgressCount').textContent = String(inProgress);
  $('#watchedPercent').textContent = `${percent}%`;
  $('#progressOrb').style.setProperty('--orb', `${percent * 3.6}deg`);
  $('#profileLabel').textContent = profile.name || 'This device';
  $('#profileAvatar').textContent = (profile.name || '?').trim().charAt(0).toUpperCase() || '?';
  $('#profileSub').textContent = `${watched} watched · saved in this browser`;
  const ratingsSaved = Object.keys(profile.ratings).filter(id => ratingFor(id)).length;
  const bookmarkCount = Object.values(profile.bookmarks).reduce((sum, list) => sum + list.length, 0);
  $('#profileSummary').innerHTML = [
    [watched, 'watched'], [inProgress, 'in progress'], [hoursWatched().toFixed(1), 'hours watched'],
    [ratingsSaved, 'ratings saved'], [Object.values(profile.watchLater).filter(Boolean).length, 'watch later'], [bookmarkCount, 'bookmarks']
  ].map(([value, label]) => `<div class="profile-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
  const stats = creatorStats();
  const top = stats.filter(entry => entry.ratedCount >= 2).sort((a, b) => b.average - a.average)[0];
  $('#creatorStats').innerHTML = stats.length ? `<h3>Progress by creator</h3>${stats.map(entry => {
    const theme = themes[entry.name] || themes.Other;
    const share = entry.total ? Math.round(entry.watched / entry.total * 100) : 0;
    return `<div class="creator-stat" style="--card-rgb:${theme.rgb};--card-accent:${theme.accent}"><img src="${item(entry.name)}" alt=""><span class="creator-stat-name">${escapeHTML(entry.name)}</span><span class="creator-stat-bar"><i style="width:${share}%"></i></span><span class="creator-stat-num">${entry.watched}/${entry.total}</span></div>`;
  }).join('')}${top ? `<p class="stat-note">Your highest-rated creator so far: <strong>${escapeHTML(top.name)}</strong> (${top.average.toFixed(1)} average across ${top.ratedCount} of your ratings). This is your personal rating, not a community score.</p>` : ''}` : '';
}
function setNotice(message, isError = false) {
  $('#catalogNotice').innerHTML = isError ? `<strong>Playlist unavailable.</strong> ${escapeHTML(message)} <button class="text-button" type="button" id="retryRefresh">Try again</button>${videos.length ? ' Showing the last saved copy.' : ''}` : message;
  $('#retryRefresh')?.addEventListener('click', refreshPlaylist);
}
function timeAgo(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/* ==========================================================================
   Catalog loading (keeps the full pagination loop)
   ========================================================================== */
async function requestJSON(path) {
  const result = await fetch(path, {cache: 'no-store'});
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error || `Request failed (${result.status})`);
  return payload;
}
async function refreshPlaylist() {
  if (loading) return;
  loading = true;
  $('#refreshButton').disabled = true;
  $('#refreshButton').textContent = 'Refreshing…';
  const hadCache = videos.length > 0;
  if (!hadCache) renderLibrary();
  try {
    const all = [];
    let pageToken = '';
    let pages = 0;
    do {
      setNotice(`<strong>Refreshing the official playlist.</strong> Loading page ${pages + 1}…`);
      const params = new URLSearchParams({playlistId: PLAYLIST_ID});
      if (pageToken) params.set('pageToken', pageToken);
      const page = await requestJSON(`/api/catalog?${params}`);
      all.push(...(page.videos || []));
      pageToken = page.nextPageToken || '';
      pages += 1;
      if (!hadCache) { videos = all.filter(video => !video.unavailable).map(enrich); renderLibrary(); tryOpenPendingVideo(); }
    } while (pageToken);
    unavailableCount = all.filter(video => video.unavailable).length;
    videos = all.filter(video => !video.unavailable).map(enrich);
    catalogMeta = {refreshedAt: Date.now(), unavailable: unavailableCount};
    saveCatalog();
    const skipped = unavailableCount ? ` ${unavailableCount} private or deleted ${unavailableCount === 1 ? 'entry was' : 'entries were'} skipped because YouTube cannot embed ${unavailableCount === 1 ? 'it' : 'them'}.` : '';
    setNotice(`<strong>Playlist synced.</strong> ${videos.length} verified videos loaded in official playlist order.${skipped}`);
  } catch (error) {
    setNotice(error.message || 'Unable to retrieve the official playlist.', true);
  } finally {
    loading = false;
    $('#refreshButton').disabled = false;
    $('#refreshButton').textContent = 'Refresh playlist';
    renderLibrary();
    tryOpenPendingVideo();
  }
}
function tryOpenPendingVideo() {
  if (!pendingVideoFromURL || !getVideo(pendingVideoFromURL)) return;
  const id = pendingVideoFromURL;
  pendingVideoFromURL = '';
  openPlayer(id);
}

/* ==========================================================================
   Library actions
   ========================================================================== */
function setRating(id, value) {
  profile.ratings[id] = ratingFor(id) === value ? 0 : value;
  saveProfile();
  renderLibrary();
}
function toggleFavorite(id) {
  profile.favorites[id] = !profile.favorites[id];
  if (!profile.favorites[id]) delete profile.favorites[id];
  saveProfile();
  toast(profile.favorites[id] ? 'Added to favorites' : 'Removed from favorites');
  renderLibrary();
  refreshPlayerButtons();
}
function toggleLater(id) {
  if (profile.watchLater[id]) delete profile.watchLater[id];
  else profile.watchLater[id] = Date.now();
  saveProfile();
  toast(profile.watchLater[id] ? 'Added to watch later' : 'Removed from watch later');
  renderLibrary();
  refreshPlayerButtons();
}
function toggleWatched(id) {
  const old = progressFor(id);
  const video = getVideo(id);
  const duration = old.duration || video?.durationSeconds || 1;
  profile.progress[id] = {...old, completed: !old.completed, duration, seconds: old.completed ? 0 : duration, updatedAt: Date.now()};
  if (!old.completed && profile.watchLater[id]) delete profile.watchLater[id];
  profile.lastVideoId = id;
  saveProfile();
  renderLibrary();
  refreshPlayerButtons();
}
function setFilter(group, value, {animate = true} = {}) {
  if (!(group in filters)) return;
  if (filters[group] === value && group !== 'creator') return;
  filters[group] = value;
  if (group === 'creator') announce(`${value === 'All' ? 'All creators' : value} filter on.`);
  renderLibrary({animate: group === 'creator' && animate});
}
function randomUnwatched() {
  const pool = orderedVideos().filter(video => statusFor(video) !== 'Watched');
  const fallback = videos.filter(video => statusFor(video) !== 'Watched');
  const list = pool.length ? pool : fallback;
  if (!list.length) { toast('You have watched everything. Nice.'); return; }
  if (!pool.length) toast('Nothing unwatched in this view, so I picked from the whole playlist.');
  openPlayer(list[Math.floor(Math.random() * list.length)].id);
}
function continueWatching() {
  const candidate = getVideo(profile.lastVideoId) || videos.find(video => statusFor(video) === 'In progress') || videos.find(video => statusFor(video) === 'Not started') || videos[0];
  if (candidate) openPlayer(candidate.id);
}
function clearFilters() {
  filters = {...filters, creator: 'All', collection: 'All', tag: 'All', search: '', length: 'any', year: 'any'};
  $('#searchInput').value = '';
  renderLibrary({animate: true});
}

/* ==========================================================================
   Player
   ========================================================================== */
const playerDialog = $('#playerDialog');
function nextInPlaylist(video) { return videos.filter(candidate => candidate.position > video.position).sort((a, b) => a.position - b.position)[0]; }
function nextFromCreator(video) { return videos.filter(candidate => candidate.creator === video.creator && candidate.position > video.position).sort((a, b) => a.position - b.position)[0]; }
function sameTimePerspectives(video) {
  const time = byDate(video);
  if (!time) return [];
  return videos.filter(candidate => candidate.creator !== video.creator && Math.abs(byDate(candidate) - time) <= 3 * 86400000)
    .sort((a, b) => Math.abs(byDate(a) - time) - Math.abs(byDate(b) - time)).slice(0, 4);
}
function sideCard(video, caption) {
  const theme = themes[video.creator] || themes.Other;
  const status = statusFor(video);
  return `<button class="side-card" type="button" data-play="${video.id}" style="--card-rgb:${theme.rgb}"><span class="side-thumb"><img src="${escapeHTML(video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`)}" alt="" loading="lazy"><span class="duration-badge">${escapeHTML(video.length || '')}</span>${status !== 'Not started' ? `<span class="progress-track"><i style="--progress:${percentFor(video)}%"></i></span>` : ''}</span><span class="side-text"><span class="side-caption">${escapeHTML(caption)}</span><strong>${escapeHTML(video.title)}</strong><span class="shelf-creator"><img src="${item(video.creator)}" alt="">${escapeHTML(video.creator)} · ${escapeHTML(video.date || '')}</span></span></button>`;
}
function renderPlayerSide(video) {
  const blocks = [];
  const next = nextInPlaylist(video);
  const creatorNext = nextFromCreator(video);
  if (next) blocks.push(`<h3>Up next in the playlist</h3>${sideCard(next, `#${next.position}`)}`);
  if (creatorNext && creatorNext.id !== next?.id) blocks.push(`<h3>Next from ${escapeHTML(video.creator)}</h3>${sideCard(creatorNext, `#${creatorNext.position}`)}`);
  const perspectives = sameTimePerspectives(video);
  if (perspectives.length) blocks.push(`<h3>Other perspectives</h3><p class="side-note">Uploaded within three days of this video.</p>${perspectives.map(candidate => sideCard(candidate, candidate.creator)).join('')}`);
  $('#playerSide').innerHTML = blocks.join('') || '<p class="side-note">This is the last video in the playlist.</p>';
}
function renderBookmarks() {
  const list = (profile.bookmarks[activeVideoId] || []).slice().sort((a, b) => a.t - b.t);
  $('#bookmarkList').innerHTML = list.length ? list.map((mark, index) => `<li><button class="time-link" type="button" data-seek="${mark.t}">${formatSeconds(mark.t)}</button><span>${escapeHTML(mark.label || 'Bookmarked moment')}</span><button class="text-button danger" type="button" data-remove-bookmark="${index}" aria-label="Delete bookmark at ${formatSeconds(mark.t)}">Delete</button></li>`).join('') : '<li class="muted">No bookmarks for this video yet.</li>';
}
function renderChapters(video) {
  const chapters = video.chapters || [];
  $('#chapterPanel').hidden = !chapters.length;
  $('#chapterList').innerHTML = chapters.map(chapter => `<li><button class="time-link" type="button" data-seek="${Number(chapter.t)}">${formatSeconds(chapter.t)}</button><span>${escapeHTML(chapter.label)}</span></li>`).join('');
}
function refreshPlayerButtons() {
  if (!activeVideoId) return;
  const video = getVideo(activeVideoId);
  if (!video) return;
  const favorite = Boolean(profile.favorites[video.id]);
  const later = Boolean(profile.watchLater[video.id]);
  $('#playerFavorite').textContent = favorite ? 'Favorited' : 'Favorite';
  $('#playerFavorite').setAttribute('aria-pressed', String(favorite));
  $('#playerLater').textContent = later ? 'In watch later' : 'Watch later';
  $('#playerLater').setAttribute('aria-pressed', String(later));
  $('#playerWatched').textContent = statusFor(video) === 'Watched' ? 'Unmark watched' : 'Mark watched';
}
function teardownPlayer() {
  recordPlayerProgress();
  if (playerTimer) window.clearInterval(playerTimer);
  playerTimer = null;
  try { youtubePlayer?.destroy(); } catch { /* player may already be gone */ }
  youtubePlayer = null;
  $('#playerMount').innerHTML = '';
}
function recordPlayerProgress() {
  if (!youtubePlayer || !activeVideoId) return;
  try {
    const seconds = Math.floor(youtubePlayer.getCurrentTime() || 0);
    const duration = Math.floor(youtubePlayer.getDuration() || 0);
    if (!duration || !seconds) return;
    const old = progressFor(activeVideoId);
    const completed = old.completed || seconds / duration >= 0.93;
    profile.progress[activeVideoId] = {seconds, duration, completed, updatedAt: Date.now()};
    if (completed && profile.watchLater[activeVideoId]) delete profile.watchLater[activeVideoId];
    profile.lastVideoId = activeVideoId;
    saveProfile();
    $('#playerProgressText').textContent = `${formatSeconds(seconds)} of ${formatSeconds(duration)} saved on this device.`;
    $('#playerProgressBar').style.setProperty('--progress', `${Math.round(seconds / duration * 100)}%`);
  } catch { /* YouTube player may not be ready yet */ }
}
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeLoader) return youtubeLoader;
  youtubeLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => reject(new Error('The YouTube player API timed out.')), 12000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); resolve(window.YT); };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timer); youtubeLoader = null; reject(new Error('The embedded YouTube player could not load.')); };
    document.head.append(script);
  });
  return youtubeLoader;
}
function fallbackPlayer(video) {
  const start = progressFor(video.id).seconds > 4 && !progressFor(video.id).completed ? `&start=${Math.floor(progressFor(video.id).seconds)}` : '';
  $('#playerMount').innerHTML = `<iframe title="${escapeHTML(video.title)}" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?rel=0${start}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  $('#playerProgressText').textContent = 'Embedded player loaded. Automatic progress saving needs the YouTube player API, which did not load.';
}
function seekTo(seconds) {
  if (!youtubePlayer?.seekTo) { toast('Seeking needs the YouTube player to finish loading.'); return; }
  youtubePlayer.seekTo(seconds, true);
  youtubePlayer.playVideo?.();
}
function showPlayerDialog(mode = 'modal') {
  if (mode === 'modal' && playerDialog.open && !playerDialog.matches(':modal')) { suppressCloseTeardown = true; playerDialog.close(); }
  if (!playerDialog.open) { if (mode === 'modal') playerDialog.showModal(); else playerDialog.show(); }
  playerDialog.classList.toggle('mini', mode === 'mini');
  playerDialog.classList.toggle('theater', settings.theater && mode === 'modal');
  $('#theaterButton').setAttribute('aria-pressed', String(settings.theater));
  $('#miniButton').textContent = mode === 'mini' ? 'Expand' : 'Mini player';
}
async function openPlayer(id) {
  const video = getVideo(id);
  if (!video) return;
  if (activeVideoId && activeVideoId !== id) teardownPlayer();
  else if (activeVideoId === id && youtubePlayer) { showPlayerDialog('modal'); return; }
  activeVideoId = id;
  $('#playerTitle').textContent = video.title;
  $('#playerEyebrow').textContent = `NOW PLAYING · ${video.creator.toUpperCase()} · #${video.position}`;
  playerDialog.style.setProperty('--card-rgb', (themes[video.creator] || themes.Other).rgb);
  $('#playerMount').innerHTML = '<div class="player-loading"><span></span>Loading embedded player…</div>';
  $('#playerProgressBar').style.setProperty('--progress', `${percentFor(video)}%`);
  $('#playerProgressText').textContent = `${percentFor(video)}% of this video is saved on this device.`;
  $('#resumeNote').hidden = true;
  $('#nextButton').disabled = !nextInPlaylist(video);
  $('#commentMount').innerHTML = '<button class="quiet-action" id="loadComments" type="button">Show comments</button>';
  $('#bookmarkLabel').value = '';
  refreshPlayerButtons();
  renderBookmarks();
  renderChapters(video);
  renderPlayerSide(video);
  showPlayerDialog('modal');
  writeURL();
  try {
    const YT = await loadYouTubeAPI();
    if (activeVideoId !== id || !playerDialog.open) return;
    $('#playerMount').innerHTML = '<div id="youtubePlayer"></div>';
    youtubePlayer = new YT.Player('youtubePlayer', {
      videoId: id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {autoplay: 1, rel: 0, playsinline: 1, origin: location.origin},
      events: {
        onReady: event => {
          if (activeVideoId !== id) return;
          const saved = progressFor(id);
          if (!saved.completed && saved.seconds > 4 && (!saved.duration || saved.seconds < saved.duration - 8)) {
            event.target.seekTo(saved.seconds, true);
            $('#resumeNote').innerHTML = `Resumed at <strong>${formatSeconds(saved.seconds)}</strong>, where you left off. <button class="text-button" type="button" data-seek="0">Start over</button>`;
            $('#resumeNote').hidden = false;
          }
          event.target.playVideo();
          if (playerTimer) window.clearInterval(playerTimer);
          playerTimer = window.setInterval(recordPlayerProgress, 4000);
        },
        onStateChange: event => {
          if (activeVideoId !== id) return;
          if (event.data === YT.PlayerState.ENDED) {
            const duration = Math.floor(event.target.getDuration() || 0);
            profile.progress[id] = {seconds: duration, duration, completed: true, updatedAt: Date.now()};
            if (profile.watchLater[id]) delete profile.watchLater[id];
            profile.lastVideoId = id;
            saveProfile();
            refreshPlayerButtons();
            const next = nextInPlaylist(video);
            if (next) toast(`Finished. Up next: ${next.title}`);
          }
          if (event.data === YT.PlayerState.PAUSED) recordPlayerProgress();
        }
      }
    });
  } catch {
    if (activeVideoId === id) fallbackPlayer(video);
  }
}
function closePlayer() { playerDialog.close(); }
function minimizeOrExpand() {
  if (!playerDialog.open) return;
  if (playerDialog.classList.contains('mini')) { suppressCloseTeardown = true; playerDialog.close(); showPlayerDialog('modal'); }
  else { suppressCloseTeardown = true; playerDialog.close(); showPlayerDialog('mini'); toast('Mini player on. Keep browsing.'); }
}
function addBookmark(event) {
  event?.preventDefault();
  if (!activeVideoId) return;
  if (!youtubePlayer?.getCurrentTime) { toast('Bookmarks need the YouTube player to finish loading.'); return; }
  const t = Math.floor(youtubePlayer.getCurrentTime() || 0);
  const list = profile.bookmarks[activeVideoId] || [];
  list.push({t, label: $('#bookmarkLabel').value.trim().slice(0, 60), at: Date.now()});
  profile.bookmarks[activeVideoId] = list.slice(-50);
  saveProfile();
  $('#bookmarkLabel').value = '';
  renderBookmarks();
  toast(`Bookmarked ${formatSeconds(t)}`);
}
function removeBookmark(index) {
  const list = (profile.bookmarks[activeVideoId] || []).slice().sort((a, b) => a.t - b.t);
  list.splice(index, 1);
  if (list.length) profile.bookmarks[activeVideoId] = list;
  else delete profile.bookmarks[activeVideoId];
  saveProfile();
  renderBookmarks();
}
async function loadComments() {
  const id = activeVideoId;
  $('#commentMount').innerHTML = '<p class="muted">Loading comments…</p>';
  try {
    const data = await requestJSON(`/api/comments?videoId=${encodeURIComponent(id)}`);
    if (id !== activeVideoId) return;
    const comments = data.comments || [];
    $('#commentMount').innerHTML = comments.length ? `<ul class="comment-list">${comments.map(comment => `<li><div class="comment-head"><strong>${escapeHTML(comment.author)}</strong><span>${escapeHTML(comment.publishedAt)} · ${Number(comment.likes || 0).toLocaleString()} likes</span></div><p>${escapeHTML(comment.text)}</p></li>`).join('')}</ul>` : '<p class="muted">No comments are available for this video.</p>';
  } catch (error) {
    if (id === activeVideoId) $('#commentMount').innerHTML = `<p class="muted">${escapeHTML(error.message || 'Comments could not load.')}</p>`;
  }
}

/* ==========================================================================
   Profile + settings dialogs
   ========================================================================== */
function openProfile() {
  $('#profileNameInput').value = profile.name || '';
  $('#favoriteCreatorSelect').innerHTML = '<option value="">No favorite</option>' + CREATORS.map(name => `<option value="${name}">${name}</option>`).join('');
  $('#favoriteCreatorSelect').value = profile.favoriteCreator || '';
  updateProfileUI();
  $('#profileDialog').showModal();
}
function exportProfile() {
  const payload = JSON.stringify({profile, exportedAt: new Date().toISOString(), playlistId: PLAYLIST_ID, format: 'unstable-universe-profile/2'}, null, 2);
  const url = URL.createObjectURL(new Blob([payload], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'unstable-universe-device-profile.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importProfile(file) {
  if (!file) return;
  if (file.size > 2_000_000) { toast('That file is too large to be a profile export.'); return; }
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = normalizeProfile(isObject(parsed.profile) ? parsed.profile : parsed);
    const counts = `${Object.keys(incoming.progress).length} progress entries, ${Object.keys(incoming.ratings).length} ratings, ${Object.keys(incoming.favorites).length} favorites`;
    if (!confirm(`Replace the profile on this device with the imported one?\n\nIt contains ${counts}.`)) return;
    profile = incoming;
    saveProfile();
    $('#profileNameInput').value = profile.name;
    $('#favoriteCreatorSelect').value = profile.favoriteCreator;
    renderLibrary();
    toast('Profile imported');
  } catch {
    toast('That file is not a valid profile export.');
  } finally {
    $('#importProfile').value = '';
  }
}
const PRESET_NOTES = {minimal: 'Colors switch instantly. Items stay still, no sparks.', balanced: 'Creator transitions, floating items, and a spark trail.', cinematic: 'More items and sparks, shockwaves, and light that follows your pointer.'};
function syncSettingsControls() {
  document.querySelectorAll('input[name="preset"]').forEach(input => { input.checked = input.value === settings.preset; });
  $('#presetNote').textContent = PRESET_NOTES[settings.preset];
  $('#transitionsToggle').checked = settings.transitions;
  $('#soundToggle').checked = settings.sound;
  $('#volumeRange').value = String(Math.round(settings.volume * 100));
  $('#volumeRange').style.setProperty('--fill', `${Math.round(settings.volume * 100)}%`);
  $('#volumeOutput').textContent = `${Math.round(settings.volume * 100)}%`;
  $('#motionNote').hidden = !reducedMotion.matches;
}
function openSettings() {
  openSidebar();
  const panel = $('#settingsPanel');
  panel.scrollIntoView({block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth'});
  panel.classList.remove('flash-panel');
  void panel.offsetWidth;
  panel.classList.add('flash-panel');
}

/* ---------- sidebar: pinned / rail on desktop, drawer on small screens ---------- */
const drawerQuery = window.matchMedia('(max-width: 980px)');
function isDrawer() { return drawerQuery.matches; }
function applySidebarState() {
  document.body.dataset.sidebar = isDrawer() ? 'drawer' : settings.sidebar;
  $('#sidebarCollapse').setAttribute('aria-label', settings.sidebar === 'rail' ? 'Expand sidebar' : 'Collapse sidebar');
  $('#sidebarCollapse').title = `${settings.sidebar === 'rail' ? 'Expand' : 'Collapse'} sidebar ([)`;
  if (!isDrawer()) closeDrawer(false);
}
function openSidebar() {
  if (isDrawer()) {
    document.body.classList.add('drawer-open');
    $('#sidebarScrim').hidden = false;
    $('#sidebarOpen').setAttribute('aria-expanded', 'true');
  } else if (settings.sidebar === 'rail') {
    toggleSidebarRail();
  }
}
function closeDrawer(returnFocus = true) {
  if (!document.body.classList.contains('drawer-open')) return;
  document.body.classList.remove('drawer-open');
  $('#sidebarScrim').hidden = true;
  $('#sidebarOpen').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('#sidebarOpen').focus({preventScroll: true});
}
function toggleSidebarRail() {
  if (isDrawer()) { if (document.body.classList.contains('drawer-open')) closeDrawer(); else openSidebar(); return; }
  settings.sidebar = settings.sidebar === 'rail' ? 'open' : 'rail';
  saveSettings();
  if (settings.sidebar === 'rail' && $('#sidebar').contains(document.activeElement)) document.activeElement.blur();
  applySidebarState();
}
function applySettings() {
  document.body.dataset.fx = effectiveFx();
  const muted = !settings.sound || settings.volume === 0;
  $('#muteToggle').setAttribute('aria-pressed', String(muted));
  $('#muteToggle').classList.toggle('muted', muted);
  $('#muteLabel').textContent = muted ? 'Sound effects off' : 'Sound effects on';
  if (audio.master) audio.master.gain.value = settings.volume * 0.9;
  renderMotes();
  syncSettingsControls();
  applyTheme(appliedTheme || themeNameFor(), iconNameFor());
}
function toggleSound() {
  settings.sound = !settings.sound;
  if (settings.sound && settings.volume === 0) settings.volume = 0.5;
  saveSettings();
  applySettings();
  toast(settings.sound ? 'Sound effects on' : 'Sound effects muted');
}

/* ==========================================================================
   Hotbar + command palette + keyboard
   ========================================================================== */
const HOTBAR = [
  ...['All', ...CREATORS].map((name, index) => ({key: String(index + 1), icon: name, label: name === 'All' ? 'All creators' : name, creator: name})),
  {key: '7', icon: 'Watch later', label: 'Watch later', action: () => setFilter('collection', filters.collection === 'Watch later' ? 'All' : 'Watch later')},
  {key: '8', icon: 'In progress', label: 'Continue watching', action: continueWatching},
  {key: '9', icon: 'Search', label: 'Command palette', action: () => openPalette()}
];
function renderHotbar() {
  $('#hotbarSlots').innerHTML = HOTBAR.map(slot => {
    const selected = slot.creator ? filters.creator === slot.creator : slot.icon === 'Watch later' && filters.collection === 'Watch later';
    const theme = themes[slot.creator] || themes.All;
    return `<button class="slot ${selected ? 'selected' : ''}" type="button" ${slot.creator ? `data-hotbar-creator="${slot.creator}"` : `data-hotbar-action="${slot.key}"`} aria-label="${escapeHTML(slot.label)} (key ${slot.key})" aria-pressed="${selected}" data-label="${escapeHTML(slot.label)}" style="--slot-rgb:${theme.rgb}"><img src="${item(slot.icon)}" alt=""><span class="slot-key">${slot.key}</span></button>`;
  }).join('');
}
let hotbarLabelTimer = null;
function flashHotbarLabel(text) {
  const label = $('#hotbarLabel');
  label.textContent = text;
  label.classList.add('show');
  clearTimeout(hotbarLabelTimer);
  hotbarLabelTimer = setTimeout(() => label.classList.remove('show'), 1400);
}
const hotbarElement = $('#hotbar');
let hotbarHideTimer = null;
function showHotbar(holdFor = 2600) {
  hotbarElement.classList.remove('tucked');
  clearTimeout(hotbarHideTimer);
  hotbarHideTimer = setTimeout(() => { if (!hotbarElement.matches(':hover, :focus-within')) hotbarElement.classList.add('tucked'); }, holdFor);
}
window.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' && event.clientY > innerHeight - 90 && Math.abs(event.clientX - innerWidth / 2) < 340) showHotbar(); }, {passive: true});
hotbarElement.addEventListener('pointerleave', () => showHotbar(900));
hotbarElement.addEventListener('focusin', () => showHotbar(4000));
$('#hotbarHint').addEventListener('click', () => showHotbar(4000));
let lastScrollY = scrollY;
window.addEventListener('scroll', () => { if (matchMedia('(hover: none)').matches && scrollY < lastScrollY - 8) showHotbar(); lastScrollY = scrollY; }, {passive: true});
function runHotbar(key) {
  showHotbar();
  const slot = HOTBAR.find(entry => entry.key === key);
  if (!slot) return;
  flashHotbarLabel(slot.label);
  if (slot.creator) setFilter('creator', slot.creator);
  else slot.action();
}

let paletteItems = [];
let paletteIndex = 0;
function paletteCommands() {
  const commands = [
    {label: 'Continue watching', hint: 'C', icon: 'In progress', run: continueWatching},
    {label: 'Play a random unwatched video', hint: 'R', icon: 'Random', run: randomUnwatched},
    ...creatorsPresent().map(name => ({label: `Creator: ${name === 'All' ? 'All creators' : name}`, icon: name, run: () => setFilter('creator', name)})),
    ...['New uploads', 'In progress', 'Watched', 'Not started', 'Favorites', 'Watch later', 'Rated', 'Bookmarked', 'Longform'].map(name => ({label: `Show: ${name}`, icon: name, run: () => setFilter('collection', name)})),
    ...allTags().map(tag => ({label: `Keyword tag: ${tag}`, icon: tag, run: () => setFilter('tag', tag)})),
    ...[['playlist', 'Playlist order'], ['newest', 'Newest upload'], ['oldest', 'Oldest upload'], ['views', 'Most viewed'], ['rating', 'My rating'], ['longest', 'Longest'], ['shortest', 'Shortest']].map(([value, label]) => ({label: `Sort: ${label}`, icon: 'Search', run: () => setFilter('sort', value)})),
    {label: 'Clear all filters', icon: 'Other', run: clearFilters},
    {label: 'Go to the library', icon: 'All', run: () => $('#library').scrollIntoView({behavior: 'smooth'})},
    {label: 'Open filters and settings', icon: 'Search', run: openSidebar},
    {label: 'Collapse or expand the sidebar', hint: '[', icon: 'Settings', run: toggleSidebarRail},
    {label: 'Copy a link to this view', icon: 'Random', run: () => copyText(shareURL(), 'Link to this view copied')},
    {label: 'Refresh the playlist', icon: 'Other', run: refreshPlaylist},
    {label: 'Open my device profile', icon: 'Watched', run: openProfile},
    {label: 'Open settings', icon: 'Settings', run: openSettings},
    {label: settings.sound ? 'Mute sound effects' : 'Turn sound effects on', hint: 'M', icon: 'Settings', run: toggleSound},
    ...Object.keys(PRESETS).map(name => ({label: `Visual preset: ${name[0].toUpperCase()}${name.slice(1)}`, icon: 'Settings', run: () => { settings.preset = name; saveSettings(); applySettings(); toast(`${name[0].toUpperCase()}${name.slice(1)} preset on`); }}))
  ];
  return commands;
}
function renderPalette() {
  const query = $('#paletteInput').value.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const commands = paletteCommands().filter(command => words.every(word => command.label.toLowerCase().includes(word)));
  const videoHits = words.length && query.length >= 2 ? videos.filter(video => words.every(word => `${video.title} ${video.creator}`.toLowerCase().includes(word))).slice(0, 8).map(video => ({label: video.title, sub: `${video.creator} · #${video.position} · ${video.length || ''}`, icon: video.creator, run: () => openPlayer(video.id)})) : [];
  paletteItems = [...commands.slice(0, words.length ? 12 : 9), ...videoHits];
  paletteIndex = clamp(paletteIndex, 0, Math.max(0, paletteItems.length - 1));
  $('#paletteList').innerHTML = paletteItems.length ? paletteItems.map((entry, index) => `<li id="palette-${index}" role="option" aria-selected="${index === paletteIndex}" data-palette-index="${index}" class="${index === paletteIndex ? 'active' : ''}"><img src="${item(entry.icon)}" alt=""><span><strong>${escapeHTML(entry.label)}</strong>${entry.sub ? `<small>${escapeHTML(entry.sub)}</small>` : ''}</span>${entry.hint ? `<kbd>${entry.hint}</kbd>` : entry.sub ? '<kbd>Play</kbd>' : ''}</li>`).join('') : '<li class="muted" role="option" aria-disabled="true">No matches. Try a creator name or part of a title.</li>';
  $('#paletteInput').setAttribute('aria-activedescendant', paletteItems.length ? `palette-${paletteIndex}` : '');
  document.getElementById(`palette-${paletteIndex}`)?.scrollIntoView({block: 'nearest'});
}
function openPalette() {
  if ($('#paletteDialog').open) return;
  $('#paletteInput').value = '';
  paletteIndex = 0;
  renderPalette();
  $('#paletteDialog').showModal();
  $('#paletteInput').focus();
}
function runPaletteItem(index) {
  const entry = paletteItems[index];
  if (!entry) return;
  $('#paletteDialog').close();
  entry.run();
}

const isTyping = target => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
document.addEventListener('keydown', event => {
  const key = event.key;
  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'k') { event.preventDefault(); $('#paletteDialog').open ? $('#paletteDialog').close() : openPalette(); return; }
  if (key === 'Escape' && activeRun) { skipTransition(); return; }
  if (key === 'Escape' && document.body.classList.contains('drawer-open') && !document.querySelector('dialog:modal')) { closeDrawer(); return; }
  if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
  const modalOpen = document.querySelector('dialog:modal');
  const playerModal = modalOpen === playerDialog;
  if (playerModal || (playerDialog.open && !modalOpen)) {
    const lower = key.toLowerCase();
    const actions = {n: () => $('#nextButton').click(), f: () => toggleFavorite(activeVideoId), l: () => toggleLater(activeVideoId), b: () => addBookmark(), t: () => $('#theaterButton').click(), i: minimizeOrExpand};
    if (actions[lower] && (playerModal || lower === 'i')) { event.preventDefault(); actions[lower](); return; }
  }
  if (modalOpen) return;
  if (key === '/') { event.preventDefault(); $('#searchInput').focus(); $('#searchInput').select(); return; }
  if (/^[1-9]$/.test(key)) { event.preventDefault(); runHotbar(key); return; }
  const lower = key.toLowerCase();
  if (lower === 'c') continueWatching();
  else if (lower === 'r') randomUnwatched();
  else if (lower === 'm') toggleSound();
  else if (key === '?') $('#settingsDialog').showModal();
  else if (key === '[') toggleSidebarRail();
});

/* ==========================================================================
   Events
   ========================================================================== */
$('#sidebar').addEventListener('click', event => {
  const button = event.target.closest('[data-filter-group]');
  if (!button) return;
  setFilter(button.dataset.filterGroup, button.dataset.filterValue);
  if (isDrawer() && button.dataset.filterGroup !== 'tag') setTimeout(() => closeDrawer(false), 180);
});
$('#sidebarCollapse').addEventListener('click', toggleSidebarRail);
$('#sidebarOpen').addEventListener('click', () => { if (!isDrawer()) toggleSidebarRail(); else if (document.body.classList.contains('drawer-open')) closeDrawer(); else openSidebar(); });
$('#sidebarScrim').addEventListener('click', () => closeDrawer());
$('#clearFiltersSide').addEventListener('click', clearFilters);
$('#shortcutsTrigger').addEventListener('click', () => $('#settingsDialog').showModal());
drawerQuery.addEventListener?.('change', applySidebarState);
/* Liquid-glass specular highlight follows the pointer on the surface under it. */
document.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || document.body.dataset.fx === 'minimal') return;
  const surface = event.target instanceof Element && event.target.closest('.video-card, .lg, .new-banner, .shelf-card, .side-row');
  if (!surface) return;
  const rect = surface.getBoundingClientRect();
  surface.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width * 100).toFixed(1)}%`);
  surface.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height * 100).toFixed(1)}%`);
}, {passive: true});
function handleCardClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.play) openPlayer(button.dataset.play);
  else if (button.dataset.rate) setRating(button.dataset.id, Number(button.dataset.rate));
  else if (button.dataset.favorite) toggleFavorite(button.dataset.favorite);
  else if (button.dataset.later) toggleLater(button.dataset.later);
  else if (button.dataset.watched) toggleWatched(button.dataset.watched);
  else if (button.dataset.shelfFilter) { setFilter('collection', button.dataset.shelfFilter); $('#library').scrollIntoView({behavior: 'smooth'}); }
}
$('#videoGrid').addEventListener('click', handleCardClick);
$('#shelfZone').addEventListener('click', handleCardClick);
$('#newBanner').addEventListener('click', event => {
  const dismiss = event.target.closest('[data-dismiss-new]');
  if (dismiss) { safeWrite(DISMISSED_KEY, [...dismissedNew(), dismiss.dataset.dismissNew].slice(-40)); renderNewBanner(); return; }
  handleCardClick(event);
});
// Shelves scroll sideways with a normal mouse wheel, since their scrollbars are hidden.
$('#shelfZone').addEventListener('wheel', event => {
  const row = event.target.closest('.shelf-row');
  if (!row || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const max = row.scrollWidth - row.clientWidth;
  if (max <= 0) return;
  if ((event.deltaY < 0 && row.scrollLeft <= 0) || (event.deltaY > 0 && row.scrollLeft >= max - 1)) return;
  event.preventDefault();
  row.scrollLeft += event.deltaY;
}, {passive: false});
let searchTimer = null;
$('#searchInput').addEventListener('input', event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { filters.search = event.target.value; renderLibrary(); }, 120); });
$('#searchInput').addEventListener('keydown', event => { if (event.key === 'Escape' && event.target.value) { event.target.value = ''; filters.search = ''; renderLibrary(); } });
$('#sortSelect').addEventListener('change', event => setFilter('sort', event.target.value));
$('#lengthSelect').addEventListener('change', event => setFilter('length', event.target.value));
$('#yearSelect').addEventListener('change', event => setFilter('year', event.target.value));
$('#shareView').addEventListener('click', () => copyText(shareURL(), 'Link to this view copied'));
$('#refreshButton').addEventListener('click', refreshPlaylist);
$('#continueButton').addEventListener('click', continueWatching);
$('#randomButton').addEventListener('click', randomUnwatched);
$('#profileTrigger').addEventListener('click', openProfile);
$('#profileShortcut').addEventListener('click', openProfile);
$('#settingsTrigger').addEventListener('click', openSettings);
$('#paletteTrigger').addEventListener('click', openPalette);
$('#muteToggle').addEventListener('click', toggleSound);
$('#clearFilters').addEventListener('click', clearFilters);
$('#saveProfile').addEventListener('click', () => {
  profile.name = $('#profileNameInput').value.trim().slice(0, 28);
  profile.favoriteCreator = CREATORS.includes($('#favoriteCreatorSelect').value) ? $('#favoriteCreatorSelect').value : '';
  saveProfile();
  updateProfileUI();
  $('#profileDialog').close();
  toast('Profile saved on this device');
});
$('#exportProfile').addEventListener('click', exportProfile);
$('#importProfile').addEventListener('change', event => importProfile(event.target.files[0]));
$('#resetProfile').addEventListener('click', () => { if (confirm('Reset your local profile, ratings, favorites, watch later list, bookmarks, and saved watch progress on this device?')) { profile = defaultProfile(); try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ } renderLibrary(); $('#profileDialog').close(); } });

$('#playerWatched').addEventListener('click', () => { if (activeVideoId) toggleWatched(activeVideoId); });
$('#playerFavorite').addEventListener('click', () => { if (activeVideoId) toggleFavorite(activeVideoId); });
$('#playerLater').addEventListener('click', () => { if (activeVideoId) toggleLater(activeVideoId); });
$('#playerShare').addEventListener('click', () => { if (activeVideoId) copyText(shareURL(activeVideoId), 'Link to this video copied'); });
$('#nextButton').addEventListener('click', () => { const current = getVideo(activeVideoId); const next = current && nextInPlaylist(current); if (next) openPlayer(next.id); });
$('#playerClose').addEventListener('click', closePlayer);
$('#theaterButton').addEventListener('click', () => { settings.theater = !settings.theater; saveSettings(); if (playerDialog.classList.contains('mini')) minimizeOrExpand(); else showPlayerDialog('modal'); });
$('#miniButton').addEventListener('click', minimizeOrExpand);
$('#bookmarkForm').addEventListener('submit', addBookmark);
playerDialog.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.seek !== undefined) { seekTo(Number(target.dataset.seek)); if (target.closest('#resumeNote')) $('#resumeNote').hidden = true; }
  else if (target.dataset.removeBookmark !== undefined) removeBookmark(Number(target.dataset.removeBookmark));
  else if (target.dataset.play) openPlayer(target.dataset.play);
  else if (target.id === 'loadComments') loadComments();
});
playerDialog.addEventListener('close', () => {
  if (suppressCloseTeardown) { suppressCloseTeardown = false; return; }
  teardownPlayer();
  activeVideoId = '';
  playerDialog.classList.remove('mini', 'theater');
  renderLibrary();
});

document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.closeDialog}`).close()));
document.querySelectorAll('.profile-dialog, .settings-dialog, .palette-dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));

document.querySelectorAll('input[name="preset"]').forEach(input => input.addEventListener('change', () => { settings.preset = input.value; saveSettings(); applySettings(); }));
$('#transitionsToggle').addEventListener('change', event => { settings.transitions = event.target.checked; saveSettings(); });
$('#soundToggle').addEventListener('change', event => { settings.sound = event.target.checked; saveSettings(); applySettings(); });
$('#volumeRange').addEventListener('input', event => { settings.volume = Number(event.target.value) / 100; saveSettings(); applySettings(); });
$('#testSound').addEventListener('click', () => { if (isDrawer()) closeDrawer(false); transitionTo(themeNameFor()); });

$('#hotbarSlots').addEventListener('click', event => {
  const slot = event.target.closest('.slot');
  if (!slot) return;
  runHotbar(slot.dataset.hotbarCreator ? String(['All', ...CREATORS].indexOf(slot.dataset.hotbarCreator) + 1) : slot.dataset.hotbarAction);
});
$('#hotbarSlots').addEventListener('pointerover', event => { const slot = event.target.closest('.slot'); if (slot) flashHotbarLabel(slot.dataset.label); });

$('#paletteInput').addEventListener('input', () => { paletteIndex = 0; renderPalette(); });
$('#paletteInput').addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); paletteIndex = (paletteIndex + 1) % Math.max(1, paletteItems.length); renderPalette(); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); paletteIndex = (paletteIndex - 1 + paletteItems.length) % Math.max(1, paletteItems.length); renderPalette(); }
  else if (event.key === 'Enter') { event.preventDefault(); runPaletteItem(paletteIndex); }
});
$('#paletteList').addEventListener('click', event => { const row = event.target.closest('[data-palette-index]'); if (row) runPaletteItem(Number(row.dataset.paletteIndex)); });
$('#paletteList').addEventListener('pointermove', event => { const row = event.target.closest('[data-palette-index]'); if (row && Number(row.dataset.paletteIndex) !== paletteIndex) { paletteIndex = Number(row.dataset.paletteIndex); renderPalette(); } });

/* Cinematic pointer light: one element, transform only, paused when not cinematic. */
let lightFrame = 0;
let pointer = {x: innerWidth / 2, y: innerHeight / 3};
window.addEventListener('pointermove', event => {
  if (document.body.dataset.fx !== 'cinematic') return;
  pointer = {x: event.clientX, y: event.clientY};
  if (!lightFrame) lightFrame = requestAnimationFrame(() => { lightFrame = 0; $('#cursorLight').style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`; });
}, {passive: true});
reducedMotion.addEventListener?.('change', applySettings);
window.addEventListener('pagehide', recordPlayerProgress);
document.addEventListener('visibilitychange', () => { if (document.hidden) recordPlayerProgress(); });

/* ---------- boot ---------- */
videos = videos.filter(video => !video?.unavailable).map(enrich);
const creatorFromURL = readURL();
if (!creatorFromURL && profile.favoriteCreator) filters.creator = profile.favoriteCreator;
$('#searchInput').value = filters.search;
applySidebarState();
applySettings();
renderLibrary();
showHotbar(3000);
if (catalogMeta.refreshedAt && videos.length) setNotice(`<strong>Showing your saved copy</strong> from ${timeAgo(catalogMeta.refreshedAt)}. Checking the official playlist for changes…`);
tryOpenPendingVideo();
refreshPlaylist();
