'use strict';

/* ==========================================================================
   Unstable Universe Experience
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

const CREATORS = ['Wemmbu', 'Parrot', 'Spoke', 'FlameFrags'];
// F0_olish's videos are left out of the site on purpose (catalog + any cached copy).
const REMOVED_CREATOR = /f0_?olish/i;
const keepVideo = video => Boolean(video) && !video.unavailable && !REMOVED_CREATOR.test(`${video.creator || ''} ${video.channelTitle || ''}`);

const icons = {
  All: 'nether_star.png', Wemmbu: 'mace.png', Parrot: 'spyglass.png', Spoke: 'totem_of_undying.png', FlameFrags: 'netherite_sword.png', Other: 'compass_00.png',
  'New uploads': 'firework_rocket.png', 'In progress': 'recovery_compass_00.png', Watched: 'experience_bottle.png', 'Not started': 'map.png', Favorites: 'amethyst_shard.png', 'Watch later': 'clock_00.png', Rated: 'diamond.png', Bookmarked: 'writable_book.png', Longform: 'clock_00.png',
  Civilization: 'end_crystal.png', Law: 'book.png', Dimension: 'ender_eye.png', War: 'netherite_sword.png', Mafia: 'echo_shard.png', Prison: 'iron_door.png', 'Bases & vaults': 'bundle.png',
  Random: 'ender_pearl.png', Search: 'spyglass.png', Settings: 'redstone.png', YouTube: 'painting.png'
};
const themes = {
  All: {key: 'all', accent: '#8fd8ff', rgb: '143,216,255', two: '#5a6cff'},
  Wemmbu: {key: 'wemmbu', accent: '#be85ff', rgb: '190,133,255', two: '#6b3ba9'},
  Parrot: {key: 'parrot', accent: '#77f59c', rgb: '119,245,156', two: '#218c56'},
  Spoke: {key: 'spoke', accent: '#ff85d3', rgb: '255,133,211', two: '#4ecdf4'},
  FlameFrags: {key: 'flamefrags', accent: '#ff6d78', rgb: '255,109,120', two: '#b72f49'},
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
  Rated: ['No ratings yet.', 'Give a video a tier from Coal to Netherite and it appears here.'],
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

const defaultProfile = () => ({name: '', progress: {}, ratings: {}, favorites: {}, watchLater: {}, bookmarks: {}, favoriteCreator: '', lastVideoId: '', achievements: {}, days: {}, counters: {}, equipped: '', notes: {}});
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
    lastVideoId: typeof source.lastVideoId === 'string' ? source.lastVideoId : '',
    achievements: isObject(source.achievements) ? Object.fromEntries(Object.entries(source.achievements).filter(([, at]) => Number(at) > 0)) : {},
    days: isObject(source.days) ? Object.fromEntries(Object.entries(source.days).filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day)).slice(-400)) : {},
    counters: isObject(source.counters) ? Object.fromEntries(Object.entries(source.counters).map(([key, value]) => [key, Number(value) || 0])) : {},
    equipped: typeof source.equipped === 'string' ? source.equipped.slice(0, 40) : '',
    notes: isObject(source.notes) ? Object.fromEntries(Object.entries(source.notes).filter(([, text]) => typeof text === 'string' && text.trim()).map(([id, text]) => [id, text.slice(0, 4000)]).slice(0, 500)) : {}
  };
}
const defaultSettings = () => ({preset: 'balanced', transitions: true, sound: true, volume: 0.5, theater: false, sidebar: 'open', storyline: false, autoplay: true, videoVolume: 80, videoMuted: false, captions: false, speed: 1});
function normalizeSettings(raw) {
  const source = isObject(raw) ? raw : {};
  return {
    preset: PRESETS[source.preset] ? source.preset : 'balanced',
    transitions: source.transitions !== false,
    sound: source.sound !== false,
    volume: clamp(Number.isFinite(Number(source.volume)) ? Number(source.volume) : 0.5, 0, 1),
    theater: Boolean(source.theater),
    sidebar: source.sidebar === 'rail' ? 'rail' : 'open',
    storyline: Boolean(source.storyline),
    autoplay: source.autoplay !== false,
    videoVolume: clamp(Number.isFinite(Number(source.videoVolume)) ? Number(source.videoVolume) : 80, 0, 100),
    videoMuted: Boolean(source.videoMuted),
    captions: Boolean(source.captions),
    speed: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(Number(source.speed)) ? Number(source.speed) : 1
  };
}

let profile = normalizeProfile(safeRead(PROFILE_KEY, defaultProfile()));
let settings = normalizeSettings(safeRead(SETTINGS_KEY, defaultSettings()));
let catalogMeta = safeRead(CATALOG_META_KEY, {});
const cachedCatalog = safeRead(CATALOG_KEY, []);
let videos = Array.isArray(cachedCatalog) ? cachedCatalog : [];
const SITE_KEY = 'unstable-universe-site-config-v1';
let siteConfig = (() => { const raw = safeRead(SITE_KEY, {}); return {featured: raw.featured || null, announcement: raw.announcement || null, hidden: Array.isArray(raw.hidden) ? raw.hidden : []}; })();
let allVideos = [];
const sessionStart = Date.now();
let openedThisSession = false;
function visibleOnly(list) { const hidden = new Set(siteConfig.hidden); return list.filter(video => !hidden.has(video.id)); }
let filters = {creator: 'All', collection: 'All', tag: 'All', search: '', sort: 'playlist', length: 'any', year: 'any'};
let loading = false;
let catalogComplete = false;
let activeVideoId = '';
let youtubePlayer = null;
let playerTimer = null;
let youtubeLoader = null;
let appliedTheme = '';
let appliedIcon = '';
let pendingVideoFromURL = '';
let pendingStartFromURL = 0;
let suppressCloseTeardown = false;
let unavailableCount = 0;

function saveProfile() {
  if (!safeWrite(PROFILE_KEY, profile)) toast('Could not save. This browser storage may be full or blocked.');
  if (typeof markDirty === 'function') markDirty();
}
function saveSettings() { safeWrite(SETTINGS_KEY, settings); }
function saveCatalog() { safeWrite(CATALOG_KEY, allVideos); safeWrite(CATALOG_META_KEY, catalogMeta); }

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
  Other: ['compass_00.png', 'map.png', 'paper.png']
};
const SPARK_TINTS = {
  All: ['#ffffff', '#8fd8ff', '#b5c2ff'], Wemmbu: ['#be85ff', '#e7c8ff', '#8a4dff'], Parrot: ['#77f59c', '#d4ffe0', '#2fbf6d'],
  FlameFrags: ['#ff6d78', '#ffb36b', '#ff3d3d'], Other: ['#ffffff', '#b9c3d6']
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
    storyline: (a, b) => byDate(a) - byDate(b) || a.position - b.position,
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
  const startParam = parseInt(params.get('t') || '', 10);
  if (Number.isFinite(startParam) && startParam > 0) pendingStartFromURL = startParam;
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
  const tier = TIERS[rating - 1];
  return `<div class="rating-row"${tier ? ` style="--tier-rgb:${tier.rgb}"` : ''}><span class="rating-caption">${tier ? `<span class="tier-name t${rating}">${tier.name.toUpperCase()} TIER</span>` : 'RATE IT'}</span><div class="shards tiers" role="group" aria-label="Rate ${escapeHTML(video.title)}">${TIERS.map((entry, index) => `<button class="shard tier t${index + 1} ${index < rating ? 'active' : ''} ${index + 1 === rating ? 'chosen' : ''}" type="button" data-rate="${index + 1}" data-id="${video.id}" aria-label="${entry.name} tier" title="${entry.name}" aria-pressed="${index + 1 === rating}" style="--tier-rgb:${entry.rgb}"><img src="${ITEM_ROOT}${entry.icon}" alt=""></button>`).join('')}</div></div>`;
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
  renderAnnouncement();
  renderFeatured();
  renderRecap();
  if (catalogComplete && !loading) checkAchievements();
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
  $('#profileSub').textContent = syncLabel();
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
  }).join('')}${top ? `<p class="stat-note">Your highest-rated creator so far: <strong>${escapeHTML(top.name)}</strong> (averaging ${TIERS[Math.round(top.average) - 1]?.name || 'Coal'} tier across ${top.ratedCount} of your ratings). This is your personal rating, not a community score.</p>` : ''}` : '';
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
      if (!hadCache) { allVideos = all.filter(keepVideo).map(enrich); videos = visibleOnly(allVideos); renderLibrary(); tryOpenPendingVideo(); }
    } while (pageToken);
    unavailableCount = all.filter(video => video.unavailable).length;
    allVideos = all.filter(keepVideo).map(enrich);
    videos = visibleOnly(allVideos);
    catalogComplete = true;
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
    if (currentView === 'scenes') renderScenes();
    if (currentView === 'library' && libraryData) renderLibraryView();
  }
}
let pendingAction = new URLSearchParams(location.search).get('action') || '';
function runPendingAction() {
  if (!pendingAction || !videos.length) return;
  const action = pendingAction;
  pendingAction = '';
  history.replaceState(null, '', location.pathname + location.search.replace(/[?&]action=[^&]*/, '').replace(/^&/, '?') + location.hash);
  if (action === 'continue') continueWatching();
  else if (action === 'storyline') startStoryline();
  else if (action === 'calendar') openCalendar();
}
function tryOpenPendingVideo() {
  runPendingAction();
  if (!pendingVideoFromURL || !getVideo(pendingVideoFromURL)) return;
  const id = pendingVideoFromURL;
  pendingVideoFromURL = '';
  openPlayer(id, pendingStartFromURL ? {start: pendingStartFromURL} : {});
  pendingStartFromURL = 0;
}

/* ==========================================================================
   Library actions
   ========================================================================== */
/* ==========================================================================
   Tier ratings: Coal → Copper → Iron → Diamond → Netherite (stored as 1–5).
   Each tier has its own reaction; the higher the tier, the bigger the moment.
   ========================================================================== */
const TIERS = [
  {name: 'Coal', icon: 'coal.png', rgb: '120,120,128', colors: ['#3a3a40', '#6b6b73', '#9a9aa3'], line: 'Into the furnace it goes.'},
  {name: 'Copper', icon: 'copper_ingot.png', rgb: '232,124,74', colors: ['#e87c4a', '#ffb07a', '#5fc8a8'], line: 'Decent. It’ll oxidize nicely.'},
  {name: 'Iron', icon: 'iron_ingot.png', rgb: '216,222,232', colors: ['#ffffff', '#d8dee8', '#9aa6b8'], line: 'Solid. Golem-approved.'},
  {name: 'Diamond', icon: 'diamond.png', rgb: '92,232,224', colors: ['#5ce8e0', '#c9fffb', '#2bb8d8', '#ffffff'], line: 'Diamonds! Certified banger.'},
  {name: 'Netherite', icon: 'netherite_ingot.png', rgb: '255,92,60', colors: ['#ff5c3c', '#ffb347', '#4a3436', '#ffe08a'], line: 'Fireproof. Legendary. Peak Unstable.'}
];
const TIER_SOUNDS = [
  bus => { noise(bus, 0, 0.35, {filter: 'lowpass', from: 420, to: 140, gain: 0.32, attack: 0.01}); tone(bus, 0, 0.22, {from: 110, to: 60, gain: 0.25}); },
  bus => { [988, 1318].forEach((f, i) => tone(bus, i * 0.07, 0.35, {type: 'triangle', from: f, gain: 0.09})); noise(bus, 0, 0.12, {from: 3500, gain: 0.08}); },
  bus => { noise(bus, 0, 0.08, {from: 5200, q: 3, gain: 0.25}); [1661, 2490, 3322].forEach(f => tone(bus, 0, 0.9, {type: 'sine', from: f, gain: 0.07})); tone(bus, 0, 0.5, {type: 'triangle', from: 830, gain: 0.08}); },
  bus => { [1568, 1976, 2349, 3136].forEach((f, i) => tone(bus, i * 0.075, 0.7, {from: f, gain: 0.08, attack: 0.005})); noise(bus, 0.05, 0.6, {filter: 'highpass', from: 7000, gain: 0.05, attack: 0.1}); },
  bus => { tone(bus, 0, 1.4, {from: 72, to: 34, gain: 0.95, attack: 0.005}); noise(bus, 0, 1.1, {filter: 'lowpass', from: 900, to: 120, gain: 0.45, attack: 0.01}); tone(bus, 0.35, 1.2, {type: 'sawtooth', from: 147, to: 140, gain: 0.05, attack: 0.2}); [587, 740, 880, 1175].forEach((f, i) => tone(bus, 0.45 + i * 0.09, 0.9, {type: 'triangle', from: f, gain: 0.06})); }
];
function tierReaction(value, rect, id) {
  const tier = TIERS[value - 1];
  if (!tier) return;
  const bus = audio.bus();
  if (bus) TIER_SOUNDS[value - 1](bus);
  const calm = effectiveFx() === 'minimal' || typeof Element.prototype.animate !== 'function';
  if (calm || !rect) { toast(`${tier.name} tier. ${tier.line}`); return; }
  const layer = document.createElement('div');
  layer.className = `tier-fx t${value}`;
  layer.style.setProperty('--tier-rgb', tier.rgb);
  document.body.append(layer);
  // The popover top layer keeps the reaction above the player dialog too.
  if (typeof layer.showPopover === 'function') { layer.popover = 'manual'; try { layer.showPopover(); } catch { /* stays in the page */ } }
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const rand = (min, max) => min + Math.random() * (max - min);
  const particle = (className, px, py, frames, options, extra = '') => {
    const el = document.createElement('i');
    el.className = className;
    el.style.cssText = `left:${px}px;top:${py}px;${extra}`;
    layer.append(el);
    el.animate(frames, {fill: 'forwards', ...options});
    return el;
  };
  // the ingot pops out of the button and floats up with its name
  const pop = document.createElement('div');
  pop.className = 'tier-pop';
  pop.style.cssText = `left:${x}px;top:${y}px`;
  pop.innerHTML = `<img src="${ITEM_ROOT}${tier.icon}" alt=""><b>${tier.name.toUpperCase()}</b><small>${escapeHTML(tier.line)}</small>`;
  if (value < 5) {
    layer.append(pop);
    const rise = 70 + value * 16;
    pop.animate([
      {transform: 'translate(-50%,-50%) scale(.2)', opacity: 0},
      {transform: `translate(-50%,calc(-50% - ${rise * 0.6}px)) scale(${1 + value * 0.08})`, opacity: 1, offset: 0.22},
      {transform: `translate(-50%,calc(-50% - ${rise}px)) scale(1)`, opacity: 1, offset: 0.75},
      {transform: `translate(-50%,calc(-50% - ${rise + 24}px)) scale(.9)`, opacity: 0}
    ], {duration: 1300 + value * 140, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards'});
  }
  if (value === 1) {
    // coal: a puff of soot that drifts up and fades
    for (let i = 0; i < 12; i += 1) particle('tp smoke', x + rand(-10, 10), y, [
      {transform: 'translate(-50%,-50%) scale(.4)', opacity: .8},
      {transform: `translate(calc(-50% + ${rand(-40, 40)}px), calc(-50% - ${rand(40, 110)}px)) scale(${rand(1.6, 2.6)})`, opacity: 0}
    ], {duration: rand(900, 1500), easing: 'ease-out', delay: i * 25}, `background:${tier.colors[i % 3]}`);
  } else if (value === 2) {
    // copper: warm sparks with a patina-green ring
    for (let i = 0; i < 18; i += 1) {
      const angle = rand(0, Math.PI * 2); const dist = rand(30, 80);
      particle('tp spark', x, y, [
        {transform: 'translate(-50%,-50%) scale(1)', opacity: 1},
        {transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 20}px)) scale(.3)`, opacity: 0}
      ], {duration: rand(500, 800), easing: 'cubic-bezier(.1,.7,.4,1)'}, `background:${tier.colors[i % 3]}`);
    }
    particle('tp ring', x, y, [{transform: 'translate(-50%,-50%) scale(.2)', opacity: .9}, {transform: 'translate(-50%,-50%) scale(2.4)', opacity: 0}], {duration: 700, easing: 'ease-out'}, `border-color:${tier.colors[2]}`);
  } else if (value === 3) {
    // iron: an anvil clang, a hard white ring and metal shards
    particle('tp ring', x, y, [{transform: 'translate(-50%,-50%) scale(.3)', opacity: 1}, {transform: 'translate(-50%,-50%) scale(3.2)', opacity: 0}], {duration: 600, easing: 'cubic-bezier(.1,.8,.3,1)'}, 'border-color:#fff;border-width:3px');
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2; const dist = rand(50, 95);
      particle('tp shard', x, y, [
        {transform: `translate(-50%,-50%) rotate(${angle}rad) scaleX(1)`, opacity: 1},
        {transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) rotate(${angle}rad) scaleX(.2)`, opacity: 0}
      ], {duration: 520, easing: 'cubic-bezier(.1,.8,.3,1)'}, `background:${tier.colors[i % 3]}`);
    }
    document.body.animate([{transform: 'translate(0,0)'}, {transform: 'translate(2px,-2px)'}, {transform: 'translate(-2px,1px)'}, {transform: 'translate(0,0)'}], {duration: 180});
  } else if (value === 4) {
    // diamond: glinting stars, light rays and a cyan glow over the screen
    particle('tp rays', x, y, [{transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 0}, {transform: 'translate(-50%,-50%) scale(1) rotate(25deg)', opacity: .85, offset: 0.3}, {transform: 'translate(-50%,-50%) scale(1.3) rotate(60deg)', opacity: 0}], {duration: 1400, easing: 'ease-out'});
    for (let i = 0; i < 22; i += 1) {
      const angle = rand(0, Math.PI * 2); const dist = rand(40, 150);
      particle('tp star', x, y, [
        {transform: 'translate(-50%,-50%) scale(0) rotate(0deg)', opacity: 1},
        {transform: `translate(calc(-50% + ${Math.cos(angle) * dist * 0.7}px), calc(-50% + ${Math.sin(angle) * dist * 0.7}px)) scale(${rand(0.8, 1.5)}) rotate(90deg)`, opacity: 1, offset: 0.5},
        {transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0) rotate(180deg)`, opacity: 0}
      ], {duration: rand(800, 1300), easing: 'ease-out', delay: rand(0, 220)}, `--star:${tier.colors[i % 4]}`);
    }
    particle('tp wash', 0, 0, [{opacity: 0}, {opacity: 1, offset: 0.2}, {opacity: 0}], {duration: 1100});
  } else {
    // netherite: the screen goes dark and hot, embers rise, the ingot slams down
    particle('tp wash', 0, 0, [{opacity: 0}, {opacity: 1, offset: 0.12}, {opacity: 1, offset: 0.7}, {opacity: 0}], {duration: 2400});
    const w = innerWidth; const h = innerHeight;
    for (let i = 0; i < 46; i += 1) particle('tp ember', rand(0, w), h + 10, [
      {transform: 'translate(-50%,0) scale(1)', opacity: 0},
      {opacity: 1, offset: 0.15},
      {transform: `translate(calc(-50% + ${rand(-60, 60)}px), ${-rand(h * 0.4, h * 1)}px) scale(.3)`, opacity: 0}
    ], {duration: rand(1400, 2400), easing: 'cubic-bezier(.3,.6,.4,1)', delay: rand(0, 600)}, `background:${tier.colors[i % 4 === 2 ? 0 : i % 4]}`);
    for (let i = 0; i < 24; i += 1) {
      const angle = rand(0, Math.PI * 2); const dist = rand(50, 130);
      particle('tp spark', x, y, [
        {transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1},
        {transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(.2)`, opacity: 0}
      ], {duration: rand(500, 900), easing: 'cubic-bezier(.1,.7,.4,1)'}, `background:${tier.colors[i % 2]}`);
    }
    const banner = document.createElement('div');
    banner.className = 'tier-banner';
    banner.innerHTML = `<img src="${ITEM_ROOT}${tier.icon}" alt=""><b>NETHERITE TIER</b><small>${escapeHTML(getVideo(id)?.title || '')}</small><em>${escapeHTML(tier.line)}</em>`;
    layer.append(banner);
    banner.animate([
      {transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0, filter: 'blur(8px)'},
      {transform: 'translate(-50%,-50%) scale(.94)', opacity: 1, filter: 'blur(0)', offset: 0.14, easing: 'cubic-bezier(.2,1.4,.4,1)'},
      {transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.78},
      {transform: 'translate(-50%,-50%) scale(1.04)', opacity: 0}
    ], {duration: 2500, fill: 'forwards'});
    if (effectiveFx() !== 'minimal') document.body.animate([{transform: 'translate(0,0)'}, {transform: 'translate(-6px,4px)'}, {transform: 'translate(5px,-3px)'}, {transform: 'translate(-3px,2px)'}, {transform: 'translate(0,0)'}], {duration: 360, delay: 300});
  }
  announce(`${tier.name} tier.`);
  setTimeout(() => layer.remove(), value === 5 ? 3000 : 1900);
}
function setRating(id, value, anchor) {
  const rect = anchor?.getBoundingClientRect?.();
  const card = anchor?.closest?.('.video-card, .player-rail, .ep-rating');
  profile.ratings[id] = ratingFor(id) === value ? 0 : value;
  saveProfile();
  renderLibrary();
  refreshPlayerButtons();
  if (profile.ratings[id]) tierReaction(value, rect, id);
  else toast('Rating cleared');
  if (card && profile.ratings[id] && card.isConnected) { card.classList.remove('tier-hit'); void card.offsetWidth; card.style.setProperty('--tier-rgb', TIERS[value - 1].rgb); card.classList.add('tier-hit'); setTimeout(() => card.classList.remove('tier-hit'), 1200); }
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
   Player: custom controls over the official YouTube embed (controls=0),
   chapter/bookmark/moment markers, multi-view, tabs, and the info rail.
   ========================================================================== */
const playerDialog = $('#playerDialog');
let playerOptions = {};
let controlsTimer = null;
let idleTimer = null;
let scrubbing = false;
let currentDuration = 0;
let secondPlayer = null;
let multiSync = true;
let multiOffset = 0;
let detailsCache = new Map();
let momentsPromise = null;
let momentsData = null;
let activePanel = 'perspectives';

function storyOrder() { return [...videos].sort((a, b) => byDate(a) - byDate(b) || a.position - b.position); }
function nextInStory(video) { const list = storyOrder(); const index = list.findIndex(candidate => candidate.id === video.id); return index >= 0 ? list[index + 1] : undefined; }
function nextUp(video) { return settings.storyline ? nextInStory(video) : nextInPlaylist(video); }
function nextInPlaylist(video) { return videos.filter(candidate => candidate.position > video.position).sort((a, b) => a.position - b.position)[0]; }
function nextFromCreator(video) { return videos.filter(candidate => candidate.creator === video.creator && candidate.position > video.position).sort((a, b) => a.position - b.position)[0]; }
function sameTimePerspectives(video, limit = 4) {
  const time = byDate(video);
  if (!time) return [];
  return videos.filter(candidate => candidate.creator !== video.creator && Math.abs(byDate(candidate) - time) <= 3 * 86400000)
    .sort((a, b) => Math.abs(byDate(a) - time) - Math.abs(byDate(b) - time)).slice(0, limit);
}
const thumbOf = (video, size = 'mqdefault') => escapeHTML(size === 'mqdefault' || !video.thumbnail ? `https://i.ytimg.com/vi/${video.id}/${size}.jpg` : video.thumbnail);
function sideCard(video, caption) {
  const theme = themes[video.creator] || themes.Other;
  const status = statusFor(video);
  return `<button class="side-card" type="button" data-play="${video.id}" style="--card-rgb:${theme.rgb}"><span class="side-thumb"><img src="${thumbOf(video)}" alt="" loading="lazy"><span class="duration-badge">${escapeHTML(video.length || '')}</span>${status !== 'Not started' ? `<span class="progress-track"><i style="--progress:${percentFor(video)}%"></i></span>` : ''}</span><span class="side-text"><span class="side-caption">${escapeHTML(caption)}</span><strong>${escapeHTML(video.title)}</strong><span class="shelf-creator"><img src="${item(video.creator)}" alt="">${escapeHTML(video.creator)} · ${escapeHTML(video.date || '')}</span></span></button>`;
}
function renderPlayerSide(video) {
  const next = nextUp(video);
  const creatorNext = nextFromCreator(video);
  const blocks = [];
  if (next) blocks.push(`<h3>${settings.storyline ? 'Up next in the storyline' : 'Up next'}</h3>${sideCard(next, settings.storyline ? `${next.creator} · ${next.date || ''}` : `#${next.position}`)}`);
  if (creatorNext && creatorNext.id !== next?.id) blocks.push(`<h3>Next from ${escapeHTML(video.creator)}</h3>${sideCard(creatorNext, `#${creatorNext.position}`)}`);
  $('#playerSide').innerHTML = blocks.join('') || '<p class="side-note">This is the last video in the playlist.</p>';
  $('#nextButton').disabled = !next;
  renderPerspectives(video);
  renderTimeline(video);
}

/* ---------- chapters, bookmarks, community moments ---------- */
function loadMoments() {
  if (!momentsPromise) momentsPromise = fetch('/api/moments').then(response => (response.ok ? response.json() : {videos: {}})).catch(() => ({videos: {}})).then(data => { momentsData = data; return data; });
  return momentsPromise;
}
function communityMomentsFor(id) { return (momentsData?.videos?.[id]?.items || []).filter(moment => moment.source === 'comment'); }
function chaptersFor(video) {
  if (video.chapters?.length) return {list: video.chapters, source: 'From the uploader'};
  const community = communityMomentsFor(video.id).slice().sort((a, b) => a.t - b.t);
  return community.length >= 2 ? {list: community.map(moment => ({t: moment.t, label: moment.label})), source: 'From viewer comments'} : {list: [], source: ''};
}
function chapterAt(seconds, video = getVideo(activeVideoId)) {
  const {list} = video ? chaptersFor(video) : {list: []};
  let found = null;
  for (const chapter of list) if (chapter.t <= seconds + 0.5) found = chapter;
  return found;
}
// YouTube's auto-generated frames 1/2/3 sit near 25/50/75% of the video.
function frameFor(video, seconds) {
  const duration = currentDuration || video.durationSeconds || 0;
  if (!duration || seconds < duration * 0.12) return `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
  const fraction = seconds / duration;
  return `https://i.ytimg.com/vi/${video.id}/${fraction < 0.375 ? 1 : fraction < 0.625 ? 2 : 3}.jpg`;
}
function renderChapters(video) {
  const {list, source} = chaptersFor(video);
  $('#chapterSource').textContent = source;
  $('#chapterPanel').hidden = !list.length;
  const now = youtubePlayer?.getCurrentTime ? youtubePlayer.getCurrentTime() : 0;
  const current = chapterAt(now, video);
  $('#chapterList').innerHTML = list.map(chapter => `<li><button class="chapter-row ${current && current.t === chapter.t ? 'current' : ''}" type="button" data-seek="${Number(chapter.t)}"><img src="${escapeHTML(frameFor(video, chapter.t))}" alt="" loading="lazy"><span class="time-link">${formatSeconds(chapter.t)}</span><span class="chapter-label">${escapeHTML(chapter.label)}</span></button></li>`).join('');
  renderMarkers(video);
}
function renderBookmarks() {
  const list = (profile.bookmarks[activeVideoId] || []).slice().sort((a, b) => a.t - b.t);
  $('#bookmarkList').innerHTML = list.length ? list.map((mark, index) => `<li><button class="time-link" type="button" data-seek="${mark.t}">${formatSeconds(mark.t)}</button><span>${escapeHTML(mark.label || 'Bookmarked moment')}</span><button class="text-button danger" type="button" data-remove-bookmark="${index}" aria-label="Delete bookmark at ${formatSeconds(mark.t)}">Delete</button></li>`).join('') : '<li class="muted">No bookmarks yet. Press B or the bookmark button while watching.</li>';
  const video = getVideo(activeVideoId);
  if (video) renderMarkers(video);
}
function renderCommunityMoments(video) {
  const list = communityMomentsFor(video.id);
  $('#communityMoments').innerHTML = list.length
    ? list.map(moment => `<li><button class="time-link" type="button" data-seek="${moment.t}">${formatSeconds(moment.t)}</button><span>${escapeHTML(moment.label)}</span><small>♥ ${Number(moment.likes || 0).toLocaleString()}</small></li>`).join('')
    : `<li class="muted">${momentsData ? 'No timestamped comments found for this video yet. The index updates every few hours.' : 'Loading…'}</li>`;
}
function renderMarkers(video) {
  const duration = currentDuration || video.durationSeconds || 0;
  if (!duration) { $('#vMarkers').innerHTML = ''; return; }
  const marks = [];
  for (const chapter of chaptersFor(video).list) if (chapter.t > 0) marks.push(`<i class="mk chapter" style="left:${chapter.t / duration * 100}%" title="${escapeHTML(`${formatSeconds(chapter.t)} ${chapter.label}`)}"></i>`);
  for (const mark of profile.bookmarks[video.id] || []) marks.push(`<i class="mk bookmark" style="left:${mark.t / duration * 100}%" title="${escapeHTML(`${formatSeconds(mark.t)} ${mark.label || 'Your bookmark'}`)}"></i>`);
  $('#vMarkers').innerHTML = marks.join('');
}

/* ---------- rail + tabs ---------- */
function refreshPlayerButtons() {
  if (!activeVideoId) return;
  const video = getVideo(activeVideoId);
  if (!video) return;
  const favorite = Boolean(profile.favorites[video.id]);
  const later = Boolean(profile.watchLater[video.id]);
  $('#playerFavorite').textContent = favorite ? '♥ Favorited' : '♡ Favorite';
  $('#playerFavorite').setAttribute('aria-pressed', String(favorite));
  $('#playerLater').textContent = later ? 'In watch later' : 'Watch later';
  $('#playerLater').setAttribute('aria-pressed', String(later));
  $('#playerWatched').textContent = statusFor(video) === 'Watched' ? '✓ Watched' : 'Mark watched';
  $('#playerWatched').setAttribute('aria-pressed', String(statusFor(video) === 'Watched'));
  $('#railRating').innerHTML = ratingMarkup(video);
}
function renderRail(video) {
  const theme = themes[video.creator] || themes.Other;
  $('#railThumb').src = thumbOf(video);
  $('#railKicker').innerHTML = `<img src="${item(video.creator)}" alt="">${escapeHTML(video.creator)}`;
  $('#railKicker').style.color = theme.accent;
  $('#railSub').textContent = `Unstable Universe · #${video.position}${settings.storyline ? ` · story #${storyOrder().findIndex(candidate => candidate.id === video.id) + 1}` : ''}`;
  $('#railTitle').textContent = video.title;
  $('#railDesc').textContent = video.description || '';
  refreshPlayerButtons();
}
function setPanel(name) {
  activePanel = name;
  document.querySelectorAll('[data-ptab]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.ptab === name)));
  document.querySelectorAll('[data-ppanel]').forEach(panel => { panel.hidden = panel.dataset.ppanel !== name; });
  const video = getVideo(activeVideoId);
  if (!video) return;
  if (name === 'context') renderContext(video);
  if (name === 'comments' && !$('#commentMount .comment-list')) loadComments();
  if (name === 'notes') $('#notesInput').focus({preventScroll: true});
}
function renderPerspectives(video) {
  const list = sameTimePerspectives(video, 6);
  $('#perspectivesPanel').innerHTML = `<div class="panel-head"><h3 class="pl-sub">Watch this from other perspectives</h3><span class="side-note">Uploads from other creators within three days</span></div>
    ${list.length ? `<div class="persp-row">${list.map(other => {
      const theme = themes[other.creator] || themes.Other;
      return `<div class="persp-card" style="--card-rgb:${theme.rgb}"><button class="persp-art" type="button" data-play="${other.id}"><img src="${thumbOf(other)}" alt="" loading="lazy"><span class="duration-badge">${escapeHTML(other.length || '')}</span></button><div class="persp-body"><span class="shelf-creator"><img src="${item(other.creator)}" alt="">${escapeHTML(other.creator)} · ${escapeHTML(other.date || '')}</span><strong>${escapeHTML(other.title)}</strong><div class="persp-actions"><button class="quiet-action compact" type="button" data-play="${other.id}">Switch</button><button class="quiet-action compact" type="button" data-multi="${other.id}">Side by side</button></div></div></div>`;
    }).join('')}</div>` : '<p class="side-note">No other creator uploaded within three days of this video. Try the Timeline tab.</p>'}`;
}
function renderTimeline(video) {
  const list = storyOrder();
  const index = list.findIndex(candidate => candidate.id === video.id);
  const windowed = list.slice(Math.max(0, index - 4), index + 5);
  $('#timelinePanel').innerHTML = `<div class="panel-head"><h3 class="pl-sub">Where this sits in the story</h3><span class="side-note">#${index + 1} of ${list.length} by upload date</span></div>
    <div class="tl-row">${windowed.map(other => {
      const theme = themes[other.creator] || themes.Other;
      return `<button class="tl-node ${other.id === video.id ? 'current' : ''} status-${statusFor(other).toLowerCase().replace(' ', '-')}" type="button" data-play="${other.id}" style="--card-rgb:${theme.rgb}"><span class="tl-dot"></span><span class="tl-date">${escapeHTML(other.date || '')}</span><img src="${thumbOf(other)}" alt="" loading="lazy"><span class="tl-creator">${escapeHTML(other.creator)}</span><span class="tl-title">${escapeHTML(other.title)}</span></button>`;
    }).join('')}</div>`;
}
async function renderContext(video) {
  const tags = video.tags.map(tag => `<span class="tag" title="Keyword match">${escapeHTML(tag)}</span>`).join('');
  const base = `<dl class="ctx-grid"><div><dt>Creator</dt><dd>${escapeHTML(video.creator)}</dd></div><div><dt>Uploaded</dt><dd>${escapeHTML(video.date || '')}</dd></div><div><dt>Length</dt><dd>${escapeHTML(video.length || '')}</dd></div><div><dt>Views</dt><dd>${escapeHTML(video.views || '')}</dd></div><div><dt>Playlist</dt><dd>#${video.position}</dd></div><div><dt>Story order</dt><dd>#${storyOrder().findIndex(candidate => candidate.id === video.id) + 1}</dd></div></dl>${tags ? `<div class="tag-row">${tags}</div>` : ''}`;
  $('#contextPanel').innerHTML = `${base}<h3 class="pl-sub">Full description</h3><div class="ctx-desc" id="ctxDesc">Loading…</div>`;
  try {
    if (!detailsCache.has(video.id)) detailsCache.set(video.id, await requestJSON(`/api/video?id=${encodeURIComponent(video.id)}`));
    if (activeVideoId !== video.id) return;
    const details = detailsCache.get(video.id);
    const linked = escapeHTML(details.description || 'No description.').replace(/(^|\s)((?:\d{1,2}:)?\d{1,2}:\d{2})(?=\s|$)/g, (all, space, stamp) => `${space}<button class="time-link" type="button" data-seek="${stamp.split(':').map(Number).reduce((total, part) => total * 60 + part, 0)}">${stamp}</button>`);
    $('#ctxDesc').innerHTML = linked;
    if (details.likes) $('#contextPanel .ctx-grid').insertAdjacentHTML('beforeend', `<div><dt>Likes</dt><dd>${details.likes.toLocaleString()}</dd></div><div><dt>Comments</dt><dd>${details.comments.toLocaleString()}</dd></div>`);
  } catch (error) {
    if (activeVideoId === video.id) $('#ctxDesc').textContent = video.description || error.message;
  }
}

/* ---------- notes ---------- */
let notesTimer = null;
function loadNotes() { $('#notesInput').value = profile.notes?.[activeVideoId] || ''; $('#notesStatus').textContent = ''; }
function saveNotes() {
  if (!activeVideoId) return;
  const text = $('#notesInput').value.slice(0, 4000);
  if (text.trim()) profile.notes[activeVideoId] = text; else delete profile.notes[activeVideoId];
  saveProfile();
  $('#notesStatus').textContent = account.user ? 'Saved and syncing.' : 'Saved on this device.';
}

/* ---------- custom controls ---------- */
const stage = $('#vstage');
function isPlaying() { try { return youtubePlayer?.getPlayerState?.() === 1; } catch { return false; } }
function updateControls() {
  if (!youtubePlayer?.getCurrentTime) return;
  let current = 0;
  try { current = youtubePlayer.getCurrentTime() || 0; currentDuration = youtubePlayer.getDuration() || currentDuration; } catch { return; }
  const duration = currentDuration || 1;
  if (!scrubbing) {
    const share = Math.min(100, current / duration * 100);
    $('#vPlayed').style.width = `${share}%`;
    $('#vKnob').style.left = `${share}%`;
  }
  try { $('#vBuffer').style.width = `${Math.min(100, (youtubePlayer.getVideoLoadedFraction?.() || 0) * 100)}%`; } catch { /* not ready */ }
  $('#vTime').textContent = `${formatSeconds(current)} / ${formatSeconds(currentDuration)}`;
  $('#vScrub').setAttribute('aria-valuemax', String(Math.round(currentDuration)));
  $('#vScrub').setAttribute('aria-valuenow', String(Math.round(current)));
  $('#vScrub').setAttribute('aria-valuetext', `${formatSeconds(current)} of ${formatSeconds(currentDuration)}`);
  const chapter = chapterAt(current);
  const label = chapter ? chapter.label : '';
  if ($('#vChapter').textContent !== label) {
    $('#vChapter').textContent = label;
    document.querySelectorAll('#chapterList .chapter-row').forEach(row => row.classList.toggle('current', Boolean(chapter) && Number(row.dataset.seek) === chapter.t));
  }
  stage.classList.toggle('playing', isPlaying());
  $('#miniPlay').classList.toggle('playing', isPlaying());
  $('#miniPlay').setAttribute('aria-label', isPlaying() ? 'Pause' : 'Play');
  $('#vPlay').setAttribute('aria-label', isPlaying() ? 'Pause (K)' : 'Play (K)');
  if (secondPlayer && multiSync && secondPlayer.getCurrentTime) {
    try {
      const target = current + multiOffset;
      if (Math.abs((secondPlayer.getCurrentTime() || 0) - target) > 2.5) secondPlayer.seekTo(Math.max(0, target), true);
      const secondPlaying = secondPlayer.getPlayerState() === 1;
      if (isPlaying() && !secondPlaying) secondPlayer.playVideo();
      if (!isPlaying() && secondPlaying) secondPlayer.pauseVideo();
    } catch { /* second view not ready */ }
  }
}
function startControlLoop() { clearInterval(controlsTimer); controlsTimer = setInterval(updateControls, 250); updateControls(); }
function flash(kind) {
  const element = $('#vFlash');
  element.dataset.kind = kind;
  element.classList.remove('show');
  void element.offsetWidth;
  element.classList.add('show');
}
function togglePlay() {
  if (!youtubePlayer?.getPlayerState) return;
  if (isPlaying()) { youtubePlayer.pauseVideo(); flash('pause'); }
  else { youtubePlayer.playVideo(); flash('play'); }
  setTimeout(updateControls, 120);
}
function seekBy(delta) {
  if (!youtubePlayer?.getCurrentTime) return;
  const target = Math.max(0, Math.min(currentDuration || Infinity, (youtubePlayer.getCurrentTime() || 0) + delta));
  youtubePlayer.seekTo(target, true);
  flash(delta < 0 ? 'back' : 'fwd');
  setTimeout(updateControls, 120);
}
function seekTo(seconds) {
  if (!youtubePlayer?.seekTo) { toast('Seeking needs the YouTube player to finish loading.'); return; }
  youtubePlayer.seekTo(Math.max(0, seconds), true);
  youtubePlayer.playVideo?.();
  setTimeout(updateControls, 150);
}
function applyVolume() {
  if (!youtubePlayer?.setVolume) return;
  youtubePlayer.setVolume(settings.videoVolume);
  if (settings.videoMuted) youtubePlayer.mute(); else youtubePlayer.unMute();
  $('#vVolume').value = String(settings.videoMuted ? 0 : settings.videoVolume);
  $('#vVolume').style.setProperty('--fill', `${settings.videoMuted ? 0 : settings.videoVolume}%`);
  stage.classList.toggle('muted', settings.videoMuted || settings.videoVolume === 0);
}
function setVideoVolume(value) { settings.videoVolume = clamp(Math.round(value), 0, 100); settings.videoMuted = settings.videoVolume === 0; saveSettings(); applyVolume(); }
function toggleMute() { settings.videoMuted = !settings.videoMuted; if (!settings.videoMuted && settings.videoVolume === 0) settings.videoVolume = 60; saveSettings(); applyVolume(); flash(settings.videoMuted ? 'mute' : 'unmute'); }
function setCaptions(on) {
  settings.captions = on;
  saveSettings();
  $('#vCC').setAttribute('aria-pressed', String(on));
  try {
    if (on) { youtubePlayer.loadModule('captions'); youtubePlayer.setOption('captions', 'track', {languageCode: 'en'}); }
    else { youtubePlayer.setOption('captions', 'track', {}); youtubePlayer.unloadModule('captions'); }
  } catch { /* captions not available for this video */ }
}
function setSpeed(rate) {
  try { youtubePlayer.setPlaybackRate(rate); } catch { return; }
  settings.speed = rate;
  saveSettings();
  toast(`Speed ${rate}×`);
  renderMenu();
}
function stepSpeed(direction) {
  const rates = youtubePlayer?.getAvailablePlaybackRates?.() || [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const current = youtubePlayer?.getPlaybackRate?.() || 1;
  const index = rates.indexOf(current);
  const next = rates[clamp(index + direction, 0, rates.length - 1)];
  if (next && next !== current) setSpeed(next);
}
function renderMenu() {
  const rates = youtubePlayer?.getAvailablePlaybackRates?.() || [0.5, 0.75, 1, 1.25, 1.5, 2];
  const current = youtubePlayer?.getPlaybackRate?.() || 1;
  $('#vMenu').innerHTML = `<p class="v-menu-label">Speed</p><div class="v-speeds">${rates.map(rate => `<button type="button" data-speed="${rate}" aria-pressed="${rate === current}">${rate === 1 ? 'Normal' : `${rate}×`}</button>`).join('')}</div>
    <label class="side-toggle"><span>Captions</span><input type="checkbox" data-menu="captions" ${settings.captions ? 'checked' : ''} /></label>
    <label class="side-toggle"><span>Auto-play next</span><input type="checkbox" data-menu="autoplay" ${settings.autoplay ? 'checked' : ''} /></label>
    <label class="side-toggle"><span>Storyline order</span><input type="checkbox" data-menu="storyline" ${settings.storyline ? 'checked' : ''} /></label>
    <p class="v-menu-note">Video quality is chosen automatically by YouTube.</p>`;
}
function toggleMenu(force) {
  const open = typeof force === 'boolean' ? force : $('#vMenu').hidden;
  if (open) renderMenu();
  $('#vMenu').hidden = !open;
  $('#vSettings').setAttribute('aria-expanded', String(open));
  stage.classList.toggle('menu-open', open);
}
function fullscreenElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
/* Fullscreen: real Fullscreen API where the browser allows it on an element (desktop,
   Android, iPad); otherwise (iPhone, some Home Screen apps) a CSS fullscreen that fills
   the whole viewport, including the safe areas. */
function lockLandscape() { try { screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch { /* not allowed */ } }
function enterFakeFullscreen() {
  playerDialog.classList.add('fake-full');
  stage.classList.add('is-full');
  document.documentElement.classList.add('fake-full-lock');
  lockLandscape();
  wake();
}
function exitFakeFullscreen() {
  playerDialog.classList.remove('fake-full');
  stage.classList.remove('is-full');
  document.documentElement.classList.remove('fake-full-lock');
  try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
}
function toggleFullscreen() {
  if (playerDialog.classList.contains('fake-full')) { exitFakeFullscreen(); return; }
  if (fullscreenElement()) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); return; }
  if (playerDialog.classList.contains('mini')) minimizeOrExpand();
  const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
  const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled;
  if (request && enabled !== false) {
    try {
      const result = request.call(stage, {navigationUI: 'hide'});
      if (result?.then) result.then(lockLandscape).catch(enterFakeFullscreen);
      else setTimeout(() => { if (!fullscreenElement()) enterFakeFullscreen(); else lockLandscape(); }, 250);
      return;
    } catch { /* fall through */ }
  }
  enterFakeFullscreen();
}
playerDialog.addEventListener('cancel', event => { if (playerDialog.classList.contains('fake-full')) { event.preventDefault(); exitFakeFullscreen(); } });

/* Pop out: a floating window that keeps playing outside the page, where the platform allows. */
const canDocumentPip = () => 'documentPictureInPicture' in window;
let pipWindow = null;
async function popOut() {
  const video = getVideo(activeVideoId);
  if (!video) return;
  const t = Math.floor(youtubePlayer?.getCurrentTime?.() || progressFor(video.id).seconds || 0);
  recordPlayerProgress();
  if (canDocumentPip()) {
    try {
      pipWindow?.close();
      pipWindow = await window.documentPictureInPicture.requestWindow({width: 480, height: 270});
      const doc = pipWindow.document;
      doc.title = video.title;
      doc.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
      const frame = doc.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0&playsinline=1&start=${t}`;
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
      doc.body.append(frame);
      youtubePlayer?.pauseVideo?.();
      toast('Popped out. The floating window stays on top of other apps.');
      pipWindow.addEventListener('pagehide', () => { pipWindow = null; });
      return;
    } catch { /* fall back below */ }
  }
  if (isIOS() && isStandalone()) { showPopOutHelp(video, t, 'standalone'); return; }
  // Safari / Android: switch to YouTube's own player, whose fullscreen view supports
  // the system picture-in-picture window.
  if (fullscreenElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  exitFakeFullscreen();
  const wasMini = playerDialog.classList.contains('mini');
  teardownPlayer();
  await openPlayer(video.id, {start: t, popout: true, native: true});
  if (wasMini) minimizeOrExpand();
}
function showPopOutHelp(video, t, mode) {
  const link = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}&t=${t}s`;
  const site = `${location.origin}/?v=${encodeURIComponent(video.id)}&t=${t}`;
  $('#popoutBody').innerHTML = mode === 'standalone'
    ? `<p class="dialog-copy">Apple doesn't allow picture-in-picture in apps added to the Home Screen yet, so the video can't float from here.</p>
       <ol class="install-steps"><li><strong>Open in Safari</strong>, tap <strong>Pop out</strong> there, then tap YouTube's full-screen button and the picture-in-picture button (or swipe home).</li><li>Or open it in the <strong>YouTube app</strong> at the same moment.</li></ol>
       <div class="profile-actions"><a class="primary-action" href="${escapeHTML(site)}" target="_blank" rel="noopener">Open in Safari at ${formatSeconds(t)}</a><a class="quiet-action" href="${escapeHTML(link)}" target="_blank" rel="noopener">Open in YouTube</a></div>`
    : '';
  $('#popoutDialog').showModal();
}
function useOurControls() {
  const video = getVideo(activeVideoId);
  if (!video) return;
  const t = Math.floor(youtubePlayer?.getCurrentTime?.() || 0);
  teardownPlayer();
  openPlayer(video.id, {start: t});
}
function toggleTheater() { settings.theater = !settings.theater; saveSettings(); if (playerDialog.classList.contains('mini')) minimizeOrExpand(); else showPlayerDialog('modal'); }
['fullscreenchange', 'webkitfullscreenchange'].forEach(type => document.addEventListener(type, () => stage.classList.toggle('is-full', Boolean(fullscreenElement()))));
function wake() {
  stage.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (isPlaying() && !scrubbing && $('#vMenu').hidden) stage.classList.add('idle'); }, 2600);
}
function scrubFraction(event) {
  const rect = $('#vScrub').getBoundingClientRect();
  return clamp((event.clientX - rect.left) / rect.width, 0, 1);
}
function showTip(event) {
  const video = getVideo(activeVideoId);
  if (!video || !currentDuration) return;
  const fraction = scrubFraction(event);
  const seconds = fraction * currentDuration;
  const chapter = chapterAt(seconds, video);
  const tip = $('#vTip');
  tip.innerHTML = `${chapter ? `<span>${escapeHTML(chapter.label)}</span>` : ''}<b>${formatSeconds(seconds)}</b>`;
  tip.style.left = `${fraction * 100}%`;
  tip.classList.add('show');
  if (scrubbing) { $('#vPlayed').style.width = `${fraction * 100}%`; $('#vKnob').style.left = `${fraction * 100}%`; }
}
$('#vScrub').addEventListener('pointerdown', event => { if (!currentDuration) return; scrubbing = true; $('#vScrub').setPointerCapture(event.pointerId); stage.classList.add('scrubbing'); showTip(event); });
$('#vScrub').addEventListener('pointermove', showTip);
$('#vScrub').addEventListener('pointerleave', () => { if (!scrubbing) $('#vTip').classList.remove('show'); });
$('#vScrub').addEventListener('pointerup', event => { if (!scrubbing) return; scrubbing = false; stage.classList.remove('scrubbing'); $('#vTip').classList.remove('show'); seekTo(scrubFraction(event) * currentDuration); });
$('#vScrub').addEventListener('keydown', event => {
  const steps = {ArrowLeft: -5, ArrowRight: 5, PageDown: -30, PageUp: 30};
  if (steps[event.key]) { event.preventDefault(); event.stopPropagation(); seekBy(steps[event.key]); }
  else if (event.key === 'Home') { event.preventDefault(); seekTo(0); }
  else if (event.key === 'End') { event.preventDefault(); seekTo(Math.max(0, currentDuration - 2)); }
});
stage.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') wake(); });
// Touch: when the controls are hidden, the first tap only brings them back (like YouTube).
let tapRevealed = false;
stage.addEventListener('pointerdown', event => { tapRevealed = event.pointerType !== 'mouse' && stage.classList.contains('idle'); wake(); }, true);
const phoneMini = () => playerDialog.classList.contains('mini') && matchMedia('(max-width: 680px)').matches;
$('#vHit').addEventListener('click', () => {
  if (phoneMini()) { tapRevealed = false; minimizeOrExpand(); return; }
  if (tapRevealed) { tapRevealed = false; return; }
  if (!$('#vMenu').hidden) { toggleMenu(false); return; }
  togglePlay();
});
$('#vHit').addEventListener('dblclick', toggleFullscreen);
$('#vPlay').addEventListener('click', togglePlay);
$('#miniPlay').addEventListener('click', () => { togglePlay(); setTimeout(updateControls, 120); });
{
  let swipe = null;
  playerDialog.addEventListener('touchstart', event => {
    swipe = playerDialog.classList.contains('mini') && event.touches.length === 1 && !event.target.closest('button') ? {y: event.touches[0].clientY, x: event.touches[0].clientX} : null;
  }, {passive: true});
  playerDialog.addEventListener('touchmove', event => {
    if (!swipe) return;
    const dy = event.touches[0].clientY - swipe.y;
    playerDialog.style.transform = dy > 0 ? `translateY(${dy}px)` : `translateY(${dy / 3}px)`;
    playerDialog.style.opacity = dy > 0 ? String(Math.max(0.3, 1 - dy / 200)) : '';
    swipe.dy = dy;
  }, {passive: true});
  playerDialog.addEventListener('touchend', () => {
    if (!swipe) return;
    const dy = swipe.dy || 0;
    swipe = null;
    playerDialog.style.transform = '';
    playerDialog.style.opacity = '';
    if (dy > 70) $('#playerClose').click();
    else if (dy < -50) minimizeOrExpand();
  });
}
$('#vBack').addEventListener('click', () => seekBy(-10));
$('#vFwd').addEventListener('click', () => seekBy(10));
$('#vNext').addEventListener('click', () => $('#nextButton').click());
$('#vMute').addEventListener('click', toggleMute);
$('#vVolume').addEventListener('input', event => setVideoVolume(Number(event.target.value)));
$('#vCC').addEventListener('click', () => setCaptions(!settings.captions));
$('#vSettings').addEventListener('click', event => { event.stopPropagation(); toggleMenu(); });
$('#vMenu').addEventListener('click', event => { event.stopPropagation(); const speed = event.target.closest('[data-speed]'); if (speed) setSpeed(Number(speed.dataset.speed)); });
$('#vMenu').addEventListener('change', event => {
  const key = event.target.dataset.menu;
  if (key === 'captions') setCaptions(event.target.checked);
  if (key === 'autoplay') { settings.autoplay = event.target.checked; saveSettings(); syncSettingsControls(); }
  if (key === 'storyline') setStoryline(event.target.checked);
});
$('#vBookmark').addEventListener('click', () => addBookmark());
$('#vMini').addEventListener('click', () => minimizeOrExpand());
$('#vTheater').addEventListener('click', toggleTheater);
$('#vFull').addEventListener('click', toggleFullscreen);
$('#vPop').addEventListener('click', popOut);
$('#resumeNote').addEventListener('click', event => { if (event.target.closest('[data-own-controls]')) useOurControls(); });
document.querySelectorAll('[data-ptab]').forEach(tab => tab.addEventListener('click', () => setPanel(tab.dataset.ptab)));
$('#notesInput').addEventListener('input', () => { clearTimeout(notesTimer); $('#notesStatus').textContent = 'Saving…'; notesTimer = setTimeout(saveNotes, 600); });
$('#notesStamp').addEventListener('click', () => {
  const t = youtubePlayer?.getCurrentTime ? Math.floor(youtubePlayer.getCurrentTime()) : 0;
  const input = $('#notesInput');
  const stamp = `[${formatSeconds(t)}] `;
  const at = input.selectionStart ?? input.value.length;
  input.value = `${input.value.slice(0, at)}${at && input.value[at - 1] !== '\n' ? '\n' : ''}${stamp}${input.value.slice(at)}`;
  input.focus();
  saveNotes();
});

/* ---------- multi-view ---------- */
async function openMulti(otherId) {
  const video = getVideo(activeVideoId);
  const other = getVideo(otherId) || sameTimePerspectives(video || {}, 1)[0];
  if (!video || !other) { toast('No other perspective to show side by side.'); return; }
  closeMulti(false);
  $('#plStages').classList.add('split');
  $('#vstage2').hidden = false;
  $('#multiButton').setAttribute('aria-pressed', 'true');
  const options = [...new Set([other, ...sameTimePerspectives(video, 8), ...storyOrder().filter(candidate => candidate.id !== video.id)])].slice(0, 40);
  $('#multiSelect').innerHTML = options.map(candidate => `<option value="${candidate.id}" ${candidate.id === other.id ? 'selected' : ''}>${escapeHTML(`${candidate.creator} · ${candidate.title}`.slice(0, 70))}</option>`).join('');
  try {
    const YT = await loadYouTubeAPI();
    $('#playerMount2').innerHTML = '<div id="youtubePlayer2"></div>';
    secondPlayer = new YT.Player('youtubePlayer2', {
      videoId: other.id, host: 'https://www.youtube-nocookie.com',
      playerVars: {autoplay: 1, rel: 0, playsinline: 1, controls: 1, iv_load_policy: 3, modestbranding: 1, origin: location.origin, mute: 1},
      events: {onReady: event => { event.target.mute(); const t = youtubePlayer?.getCurrentTime?.() || 0; multiOffset = 0; event.target.seekTo(t, true); if (isPlaying()) event.target.playVideo(); }}
    });
  } catch { toast('The second player could not load.'); closeMulti(); }
}
function closeMulti(updateButton = true) {
  try { secondPlayer?.destroy(); } catch { /* gone */ }
  secondPlayer = null;
  $('#playerMount2').innerHTML = '';
  $('#vstage2').hidden = true;
  $('#plStages').classList.remove('split');
  if (updateButton) $('#multiButton').setAttribute('aria-pressed', 'false');
}
$('#multiButton').addEventListener('click', () => (secondPlayer ? closeMulti() : openMulti()));
$('#multiClose').addEventListener('click', () => closeMulti());
$('#multiSelect').addEventListener('change', event => openMulti(event.target.value));
$('#multiSync').addEventListener('click', () => {
  multiSync = !multiSync;
  $('#multiSync').setAttribute('aria-pressed', String(multiSync));
  if (multiSync && secondPlayer?.getCurrentTime) multiOffset = (secondPlayer.getCurrentTime() || 0) - (youtubePlayer?.getCurrentTime?.() || 0);
  toast(multiSync ? 'Synced: both videos play, pause and seek together.' : 'Sync off: control each video on its own.');
});
$('#multiAudio').addEventListener('click', () => {
  if (!secondPlayer?.isMuted) return;
  if (secondPlayer.isMuted()) { secondPlayer.unMute(); youtubePlayer?.mute(); settings.videoMuted = true; }
  else { secondPlayer.mute(); settings.videoMuted = false; youtubePlayer?.unMute(); }
  applyVolume();
});

/* ---------- lifecycle ---------- */
function teardownPlayer() {
  recordPlayerProgress();
  if (playerTimer) window.clearInterval(playerTimer);
  playerTimer = null;
  clearInterval(controlsTimer);
  controlsTimer = null;
  closeMulti();
  toggleMenu(false);
  if (fullscreenElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  exitFakeFullscreen();
  try { youtubePlayer?.destroy(); } catch { /* player may already be gone */ }
  youtubePlayer = null;
  currentDuration = 0;
  stage.classList.remove('native', 'playing', 'idle');
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
    if (completed && !old.completed) noteCompletion(activeVideoId, old);
    noteActivity();
    profile.progress[activeVideoId] = {seconds, duration, completed, updatedAt: Date.now()};
    if (completed && profile.watchLater[activeVideoId]) delete profile.watchLater[activeVideoId];
    profile.lastVideoId = activeVideoId;
    saveProfile();
    $('#playerProgressText').textContent = `${formatSeconds(seconds)} of ${formatSeconds(duration)} saved${account.user ? ' to your account' : ' on this device'}.`;
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
  const saved = progressFor(video.id);
  const startAt = playerOptions.start >= 0 ? playerOptions.start : saved.seconds > 4 && !saved.completed ? saved.seconds : 0;
  stage.classList.add('native');
  $('#playerMount').innerHTML = `<iframe title="${escapeHTML(video.title)}" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?rel=0${startAt ? `&start=${Math.floor(startAt)}` : ''}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  $('#playerProgressText').textContent = 'Embedded player loaded. Automatic progress saving needs the YouTube player API, which did not load.';
}
function showPlayerDialog(mode = 'modal') {
  if (mode === 'modal' && playerDialog.open && !playerDialog.matches(':modal')) { suppressCloseTeardown = true; playerDialog.close(); }
  if (!playerDialog.open) { if (mode === 'modal') playerDialog.showModal(); else playerDialog.show(); }
  playerDialog.classList.toggle('mini', mode === 'mini');
  playerDialog.classList.toggle('theater', settings.theater && mode === 'modal');
  $('#theaterButton').setAttribute('aria-pressed', String(settings.theater));
  $('#vTheater').setAttribute('aria-pressed', String(settings.theater));
  $('#miniButton').querySelector('span').textContent = mode === 'mini' ? 'Expand' : 'Mini player';
}
async function openPlayer(id, options = {}) {
  const video = getVideo(id);
  if (!video) return;
  playerOptions = options;
  if (activeVideoId && activeVideoId !== id) teardownPlayer();
  else if (activeVideoId === id && youtubePlayer) { showPlayerDialog('modal'); if (options.start >= 0) seekTo(options.start); return; }
  activeVideoId = id;
  const theme = themes[video.creator] || themes.Other;
  $('#playerTitle').textContent = video.title;
  $('#playerEyebrow').innerHTML = `<span style="color:${theme.accent}">${escapeHTML(video.creator)}</span> · Unstable Universe · #${video.position} · ${escapeHTML(video.date || '')} · ${escapeHTML(video.length || '')}`;
  $('#playerBadgeIcon').src = item(video.creator);
  playerDialog.style.setProperty('--card-rgb', theme.rgb);
  playerDialog.style.setProperty('--card-accent', theme.accent);
  $('#playerMount').innerHTML = '<div class="player-loading"><span></span>Loading embedded player…</div>';
  $('#playerProgressBar').style.setProperty('--progress', `${percentFor(video)}%`);
  $('#playerProgressText').textContent = `${percentFor(video)}% watched${account.user ? ' · synced to your account' : ''}.`;
  $('#resumeNote').hidden = true;
  $('#vChapter').textContent = '';
  $('#vTime').textContent = `0:00 / ${video.length || '0:00'}`;
  $('#vPlayed').style.width = '0%';
  $('#vKnob').style.left = '0%';
  currentDuration = video.durationSeconds || 0;
  cancelAutoplay();
  openedThisSession = true;
  renderRecap();
  $('#commentMount').innerHTML = '<button class="quiet-action" id="loadComments" type="button">Show comments</button>';
  $('#bookmarkLabel').value = '';
  renderRail(video);
  renderBookmarks();
  renderChapters(video);
  renderPlayerSide(video);
  renderCommunityMoments(video);
  renderRelatedLibrary(video);
  loadNotes();
  setPanel(activePanel === 'comments' || activePanel === 'context' ? 'perspectives' : activePanel);
  showPlayerDialog('modal');
  writeURL();
  loadMoments().then(() => { if (activeVideoId === id) { renderChapters(video); renderCommunityMoments(video); } });
  try {
    const YT = await loadYouTubeAPI();
    if (activeVideoId !== id || !playerDialog.open) return;
    $('#playerMount').innerHTML = '<div id="youtubePlayer"></div>';
    youtubePlayer = new YT.Player('youtubePlayer', {
      videoId: id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: playerOptions.native
        ? {autoplay: 1, rel: 0, playsinline: 1, controls: 1, fs: 1, iv_load_policy: 3, modestbranding: 1, origin: location.origin}
        : {autoplay: 1, rel: 0, playsinline: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, cc_load_policy: settings.captions ? 1 : 0, origin: location.origin},
      events: {
        onReady: event => {
          if (activeVideoId !== id) return;
          const saved = progressFor(id);
          currentDuration = event.target.getDuration() || currentDuration;
          stage.classList.toggle('native', Boolean(playerOptions.native));
          if (playerOptions.native) {
            if (playerOptions.start >= 0) event.target.seekTo(playerOptions.start, true);
            $('#resumeNote').innerHTML = `${playerOptions.popout ? '<strong>Ready to float.</strong> Press play, tap YouTube’s full-screen button ⛶, then the picture-in-picture button ⧉ (or just swipe home while it plays) and it keeps going in a floating window over other apps. ' : 'You’re using YouTube’s own player controls. '}<button class="text-button" type="button" data-own-controls>Switch back to our controls</button>`;
            $('#resumeNote').hidden = false;
          } else if (playerOptions.start >= 0) {
            event.target.seekTo(playerOptions.start, true);
            $('#resumeNote').innerHTML = `Jumped to <strong>${formatSeconds(playerOptions.start)}</strong>${playerOptions.label ? `: ${escapeHTML(playerOptions.label)}` : ''}. <button class="text-button" type="button" data-seek="0">Watch from the start</button>`;
            $('#resumeNote').hidden = false;
          } else if (!saved.completed && saved.seconds > 4 && (!saved.duration || saved.seconds < saved.duration - 8)) {
            event.target.seekTo(saved.seconds, true);
            $('#resumeNote').innerHTML = `Resumed at <strong>${formatSeconds(saved.seconds)}</strong>, where you left off. <button class="text-button" type="button" data-seek="0">Start over</button>`;
            $('#resumeNote').hidden = false;
          }
          applyVolume();
          if (settings.speed && settings.speed !== 1) { try { event.target.setPlaybackRate(settings.speed); } catch { /* unsupported */ } }
          if (settings.captions) setCaptions(true);
          event.target.playVideo();
          renderMarkers(video);
          startControlLoop();
          wake();
          if (playerTimer) window.clearInterval(playerTimer);
          playerTimer = window.setInterval(recordPlayerProgress, 4000);
        },
        onStateChange: event => {
          if (activeVideoId !== id) return;
          updateControls();
          wake();
          if (event.data === YT.PlayerState.ENDED) {
            const duration = Math.floor(event.target.getDuration() || 0);
            noteCompletion(id, profile.progress[id]);
            profile.progress[id] = {seconds: duration, duration, completed: true, updatedAt: Date.now()};
            if (profile.watchLater[id]) delete profile.watchLater[id];
            profile.lastVideoId = id;
            saveProfile();
            refreshPlayerButtons();
            const next = nextUp(video);
            if (next && settings.autoplay) startAutoplay(next);
            else if (next) toast(`Finished. Up next: ${next.title}`);
          }
          if (event.data === YT.PlayerState.PAUSED) recordPlayerProgress();
        },
        onError: () => { if (activeVideoId === id) toast('YouTube could not play this video here. Try "Open on YouTube".'); }
      }
    });
  } catch {
    if (activeVideoId === id) fallbackPlayer(video);
  }
}
function closePlayer() { playerDialog.close(); }
function minimizeOrExpand() {
  if (!playerDialog.open) return;
  if (fullscreenElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  if (playerDialog.classList.contains('mini')) { suppressCloseTeardown = true; playerDialog.close(); showPlayerDialog('modal'); }
  else { closeMulti(); suppressCloseTeardown = true; playerDialog.close(); showPlayerDialog('mini'); toast('Mini player on. Keep browsing.'); }
}
function addBookmark(event) {
  event?.preventDefault();
  if (!activeVideoId) return;
  if (!youtubePlayer?.getCurrentTime) { toast('Bookmarks need the YouTube player to finish loading.'); return; }
  const t = Math.floor(youtubePlayer.getCurrentTime() || 0);
  const list = profile.bookmarks[activeVideoId] || [];
  const label = $('#bookmarkLabel').value.trim().slice(0, 60) || chapterAt(t)?.label || '';
  list.push({t, label, at: Date.now()});
  profile.bookmarks[activeVideoId] = list.slice(-50);
  saveProfile();
  $('#bookmarkLabel').value = '';
  renderBookmarks();
  flash('bookmark');
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
    const withStamps = text => escapeHTML(text).replace(/(^|[\s(])((?:\d{1,2}:)?\d{1,2}:\d{2})(?=[\s).,!?]|$)/g, (all, space, stamp) => `${space}<button class="time-link" type="button" data-seek="${stamp.split(':').map(Number).reduce((total, part) => total * 60 + part, 0)}">${stamp}</button>`);
    $('#commentMount').innerHTML = comments.length ? `<p class="side-note">Top comments from YouTube. They may contain spoilers. Timestamps are clickable.</p><ul class="comment-list">${comments.map(comment => `<li><div class="comment-head"><strong>${escapeHTML(comment.author)}</strong><span>${escapeHTML(comment.publishedAt)} · ${Number(comment.likes || 0).toLocaleString()} likes</span></div><p>${withStamps(comment.text)}</p></li>`).join('')}</ul>` : '<p class="muted">No comments are available for this video.</p>';
  } catch (error) {
    if (id === activeVideoId) $('#commentMount').innerHTML = `<p class="muted">${escapeHTML(error.message || 'Comments could not load.')}</p>`;
  }
}
// Player keyboard: returns true when the key was handled.
function playerKey(event) {
  const key = event.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;
  if (event.target instanceof HTMLElement && event.target.closest('button, select, a') && (key === ' ' || key === 'Enter')) return false;
  const actions = {
    ' ': togglePlay, k: togglePlay, j: () => seekBy(-10), l: () => seekBy(10), ArrowLeft: () => seekBy(-5), ArrowRight: () => seekBy(5),
    ArrowUp: () => setVideoVolume(settings.videoVolume + 5), ArrowDown: () => setVideoVolume(settings.videoVolume - 5), m: toggleMute,
    f: toggleFullscreen, t: toggleTheater, i: minimizeOrExpand, v: () => (secondPlayer ? closeMulti() : openMulti()), n: () => $('#nextButton').click(),
    b: () => addBookmark(), c: () => setCaptions(!settings.captions), ',': () => stepSpeed(-1), '.': () => stepSpeed(1), '<': () => stepSpeed(-1), '>': () => stepSpeed(1),
    s: () => toggleFavorite(activeVideoId), w: () => toggleLater(activeVideoId), p: popOut
  };
  if (/^[0-9]$/.test(key) && currentDuration) { event.preventDefault(); seekTo(currentDuration * Number(key) / 10); return true; }
  const action = actions[lower];
  if (!action) return false;
  event.preventDefault();
  action();
  wake();
  return true;
}

/* ==========================================================================
   Accounts + cross-device sync (server: /api/account, Cloudflare D1).
   The local profile stays the working copy; when signed in it is pushed to the
   account after changes and pulled on load / when the tab comes back.
   ========================================================================== */
const SYNC_KEY = 'unstable-universe-library-sync-v1';
const account = {available: null, user: '', status: 'idle', lastSync: 0, error: '', mode: 'signin', pushing: false};
let syncMeta = (() => { const raw = safeRead(SYNC_KEY, {}); return {username: String(raw.username || ''), syncedAt: Number(raw.syncedAt) || 0, dirty: Boolean(raw.dirty)}; })();
let syncTimer = null;
let lastPull = 0;
function saveSyncMeta() { safeWrite(SYNC_KEY, syncMeta); }

async function accountRequest(path, method = 'GET', body) {
  const response = await fetch(`/api/account${path}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body ? {'Content-Type': 'application/json'} : {},
    body: body ? JSON.stringify(body) : undefined,
    keepalive: method === 'PUT' && JSON.stringify(body || {}).length < 60000
  });
  const payload = await response.json().catch(() => ({}));
  return {status: response.status, ok: response.ok, data: payload};
}
function newerProgress(a, b) {
  if (!isObject(a)) return b;
  if (!isObject(b)) return a;
  const aTime = Number(a.updatedAt) || 0;
  const bTime = Number(b.updatedAt) || 0;
  if (aTime !== bTime) return aTime > bTime ? a : b;
  if (Boolean(a.completed) !== Boolean(b.completed)) return a.completed ? a : b;
  return (Number(a.seconds) || 0) >= (Number(b.seconds) || 0) ? a : b;
}
// Used only when both sides changed since the last sync (or on first sign-in): keep everything from both.
function mergeProfiles(localRaw, remoteRaw) {
  const local = normalizeProfile(localRaw);
  const remote = normalizeProfile(remoteRaw);
  const merged = defaultProfile();
  merged.name = local.name || remote.name;
  merged.favoriteCreator = local.favoriteCreator || remote.favoriteCreator;
  merged.lastVideoId = local.lastVideoId || remote.lastVideoId;
  merged.equipped = local.equipped || remote.equipped;
  merged.notes = {...remote.notes, ...local.notes};
  for (const id of new Set([...Object.keys(local.achievements), ...Object.keys(remote.achievements)])) merged.achievements[id] = Math.min(...[local.achievements[id], remote.achievements[id]].filter(Boolean));
  merged.days = {...remote.days, ...local.days};
  for (const key of new Set([...Object.keys(local.counters), ...Object.keys(remote.counters)])) merged.counters[key] = Math.max(local.counters[key] || 0, remote.counters[key] || 0);
  for (const id of new Set([...Object.keys(local.progress), ...Object.keys(remote.progress)])) merged.progress[id] = newerProgress(local.progress[id], remote.progress[id]);
  merged.ratings = {...remote.ratings, ...Object.fromEntries(Object.entries(local.ratings).filter(([, value]) => Number(value) > 0))};
  for (const id of new Set([...Object.keys(local.favorites), ...Object.keys(remote.favorites)])) if (local.favorites[id] || remote.favorites[id]) merged.favorites[id] = true;
  for (const id of new Set([...Object.keys(local.watchLater), ...Object.keys(remote.watchLater)])) {
    const value = Math.max(Number(local.watchLater[id]) || 0, Number(remote.watchLater[id]) || 0);
    if (value) merged.watchLater[id] = value;
  }
  for (const id of new Set([...Object.keys(local.bookmarks), ...Object.keys(remote.bookmarks)])) {
    const seen = new Set();
    const list = [...(remote.bookmarks[id] || []), ...(local.bookmarks[id] || [])].filter(mark => { const key = `${mark.t}|${mark.label}`; if (seen.has(key)) return false; seen.add(key); return true; });
    if (list.length) merged.bookmarks[id] = list.sort((a, b) => a.t - b.t).slice(-50);
  }
  return merged;
}
function adoptProfile(next) {
  profile = normalizeProfile(next);
  safeWrite(PROFILE_KEY, profile);
  renderLibrary();
}
function markDirty() {
  if (!account.user) return;
  syncMeta.dirty = true;
  saveSyncMeta();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushProfile, 2500);
}
async function pushProfile(attempt = 0) {
  if (!account.user || account.pushing) return;
  account.pushing = true;
  account.status = 'syncing';
  renderAccount();
  try {
    const result = await accountRequest('/profile', 'PUT', {profile, baseUpdatedAt: syncMeta.syncedAt});
    if (result.ok) {
      syncMeta = {username: account.user, syncedAt: result.data.updatedAt, dirty: false};
      account.status = 'synced';
      account.lastSync = Date.now();
    } else if (result.status === 409 && attempt < 2) {
      adoptProfile(mergeProfiles(profile, result.data.profile || {}));
      syncMeta.syncedAt = Number(result.data.updatedAt) || 0;
      account.pushing = false;
      return pushProfile(attempt + 1);
    } else if (result.status === 401) {
      signedOutLocally('Your session ended. Sign in again to keep syncing.');
    } else {
      account.status = 'error';
      account.error = result.data.error || 'Could not sync.';
    }
  } catch {
    account.status = 'error';
    account.error = 'Offline. Changes will sync when you are back online.';
  } finally {
    account.pushing = false;
    saveSyncMeta();
    renderAccount();
  }
}
async function pullProfile({force = false} = {}) {
  if (!force && Date.now() - lastPull < 15000) return;
  lastPull = Date.now();
  try {
    const result = await accountRequest('/me');
    if (result.status === 503) { account.available = false; renderAccount(); return; }
    account.available = true;
    if (!result.ok) throw new Error(result.data.error || 'Could not reach your account.');
    if (!result.data.user) {
      if (syncMeta.username) signedOutLocally(account.user ? 'You were signed out.' : '');
      renderAccount();
      return;
    }
    account.user = result.data.user.username;
    if (syncMeta.username && syncMeta.username.toLowerCase() !== account.user.toLowerCase()) syncMeta = {username: account.user, syncedAt: 0, dirty: true};
    syncMeta.username = account.user;
    const serverTime = Number(result.data.updatedAt) || 0;
    if (result.data.profile && serverTime > syncMeta.syncedAt) {
      if (!syncMeta.dirty) { adoptProfile(result.data.profile); syncMeta.syncedAt = serverTime; }
      else { adoptProfile(mergeProfiles(profile, result.data.profile)); syncMeta.syncedAt = serverTime; syncMeta.dirty = true; }
    }
    saveSyncMeta();
    if (syncMeta.dirty || !result.data.profile) await pushProfile();
    else { account.status = 'synced'; account.lastSync = Date.now(); }
  } catch {
    account.status = 'error';
    account.error = 'Could not reach your account. Your changes are saved here and will sync later.';
  }
  renderAccount();
}
function signedOutLocally(message = '') {
  if (typeof isAdmin !== 'undefined' && isAdmin) { isAdmin = false; $('#adminTrigger').hidden = true; }
  account.user = '';
  account.status = 'idle';
  account.error = message;
  syncMeta = {username: '', syncedAt: 0, dirty: false};
  saveSyncMeta();
  renderAccount();
}
async function submitAccountForm(event) {
  event.preventDefault();
  const form = event.target;
  const username = form.elements.username.value.trim();
  const password = form.elements.password.value;
  const register = account.mode === 'register';
  if (register && password !== form.elements.confirm.value) { account.error = 'The two passwords do not match.'; renderAccount(); return; }
  account.status = 'working';
  account.error = '';
  renderAccount();
  try {
    const result = await accountRequest(register ? '/register' : '/login', 'POST', {username, password});
    if (!result.ok) { account.status = 'idle'; account.error = result.data.error || 'Something went wrong.'; renderAccount(); return; }
    account.available = true;
    account.user = result.data.user.username;
    const serverProfile = result.data.profile;
    syncMeta = {username: account.user, syncedAt: Number(result.data.updatedAt) || 0, dirty: true};
    if (serverProfile) adoptProfile(mergeProfiles(profile, serverProfile));
    saveSyncMeta();
    await pushProfile();
    toast(register ? `Account created. Welcome, ${account.user}!` : `Signed in as ${account.user}`);
    checkAdmin();
    checkAchievements();
  } catch {
    account.status = 'idle';
    account.error = 'Could not reach the server. Check your connection.';
    renderAccount();
  }
}
async function signOut() {
  if (syncMeta.dirty) await pushProfile();
  try { await accountRequest('/logout', 'POST', {}); } catch { /* still sign out here */ }
  signedOutLocally();
  toast('Signed out. Your progress stays on this device too.');
}
async function deleteAccount(event) {
  event.preventDefault();
  const password = event.target.elements.password.value;
  if (!confirm(`Delete the account "${account.user}" and everything synced to it? Progress saved on this device is kept.`)) return;
  const result = await accountRequest('', 'DELETE', {password}).catch(() => ({ok: false, data: {error: 'Could not reach the server.'}}));
  if (!result.ok) { account.error = result.data.error || 'Could not delete the account.'; renderAccount(); return; }
  signedOutLocally();
  toast('Account deleted.');
}
function syncLabel() {
  if (!account.user) return account.available === false ? 'Saved in this browser' : 'Sign in to sync devices';
  if (account.status === 'syncing') return 'Syncing…';
  if (account.status === 'error') return 'Not synced yet';
  return account.lastSync ? `Synced ${timeAgo(account.lastSync)}` : 'Synced';
}
function renderAccount() {
  const box = $('#accountBox');
  $('#profileSub').textContent = syncLabel();
  $('#profileTrigger').classList.toggle('signed-in', Boolean(account.user));
  $('#footerPrivacy').textContent = account.user ? `Signed in as ${account.user}. Progress syncs to your account.` : 'Profile, ratings, and progress stay in this browser unless you sign in.';
  if (!box) return;
  const error = account.error ? `<p class="account-error" role="alert">${escapeHTML(account.error)}</p>` : '';
  if (account.available === false) {
    box.innerHTML = `<p class="account-note">Accounts aren't switched on for this site yet, so everything stays in this browser.</p>`;
    $('#profileCopy').textContent = 'This is a browser-local profile. Your progress, ratings, and favorites stay on this device unless you export them.';
    return;
  }
  if (account.user) {
    $('#profileCopy').textContent = 'Your progress, ratings, favorites, watch later list, and bookmarks sync to your account. Sign in with the same username on any device to pick up where you left off.';
    box.innerHTML = `<div class="account-row"><span class="avatar big">${escapeHTML(account.user.charAt(0).toUpperCase())}</span><div><strong>${escapeHTML(account.user)}</strong><small class="sync-state ${account.status}">${escapeHTML(syncLabel())}</small></div>
      <div class="account-actions"><button class="quiet-action compact" type="button" id="syncNow">Sync now</button><button class="quiet-action compact" type="button" id="signOut">Sign out</button></div></div>${error}
      <details class="danger-zone"><summary>Delete account</summary><form id="deleteAccountForm"><p>This deletes your account and everything synced to it. Progress saved on this device is kept.</p><input name="password" type="password" autocomplete="current-password" placeholder="Your password" required aria-label="Password" /><button class="danger-action" type="submit">Delete my account</button></form></details>`;
    $('#syncNow').addEventListener('click', () => pullProfile({force: true}));
    $('#signOut').addEventListener('click', signOut);
    $('#deleteAccountForm').addEventListener('submit', deleteAccount);
    return;
  }
  $('#profileCopy').textContent = 'You are using a browser-local profile. Sign in to sync your progress between devices, like your computer and iPad.';
  const typedName = box.querySelector('input[name="username"]')?.value || '';
  const register = account.mode === 'register';
  const working = account.status === 'working';
  box.innerHTML = `<div class="account-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!register}" data-account-mode="signin">Sign in</button><button type="button" role="tab" aria-selected="${register}" data-account-mode="register">Create account</button></div>
    <form id="accountForm" class="account-form" novalidate>
      <label>Username<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" required placeholder="3–20 letters, numbers or _" /></label>
      <label>Password<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="8" maxlength="200" required placeholder="${register ? 'At least 8 characters' : 'Your password'}" /></label>
      ${register ? '<label>Confirm password<input name="confirm" type="password" autocomplete="new-password" required placeholder="Type it again" /></label>' : ''}
      ${error}
      <button class="primary-action" type="submit" ${working ? 'disabled' : ''}>${working ? 'One moment…' : register ? 'Create account' : 'Sign in'}</button>
      <p class="account-note">${register ? 'Your current progress on this device is added to the new account. There is no email, so keep your password safe: it cannot be reset.' : 'Progress already on this device is merged into your account.'}</p>
    </form>`;
  box.querySelectorAll('[data-account-mode]').forEach(button => button.addEventListener('click', () => { account.mode = button.dataset.accountMode; account.error = ''; renderAccount(); box.querySelector('input')?.focus(); }));
  $('#accountForm').addEventListener('submit', submitAccountForm);
  if (typedName) { $('#accountForm').elements.username.value = typedName; if (account.error) $('#accountForm').elements.password.focus(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && account.user) pullProfile(); });
window.addEventListener('online', () => { if (account.user) pullProfile({force: true}); });
window.addEventListener('pagehide', () => { if (account.user && syncMeta.dirty) pushProfile(); });

/* ==========================================================================
   Profile + settings dialogs
   ========================================================================== */
function openProfile() {
  $('#profileNameInput').value = profile.name || '';
  $('#favoriteCreatorSelect').innerHTML = '<option value="">No favorite</option>' + CREATORS.map(name => `<option value="${name}">${name}</option>`).join('');
  $('#favoriteCreatorSelect').value = profile.favoriteCreator || '';
  updateProfileUI();
  renderAccount();
  $('#profileDialog').showModal();
  if (account.available === null) pullProfile({force: true});
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
  $('#storylineToggle').checked = settings.storyline;
  $('#autoplayToggle').checked = settings.autoplay;
  $('#storyPill').hidden = !settings.storyline;
  $('#storylineButton').textContent = settings.storyline ? 'Continue storyline' : 'Start storyline';
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
  {key: String(CREATORS.length + 2), icon: 'Watch later', label: 'Watch later', action: () => setFilter('collection', filters.collection === 'Watch later' ? 'All' : 'Watch later')},
  {key: String(CREATORS.length + 3), icon: 'In progress', label: 'Continue watching', action: continueWatching},
  {key: String(CREATORS.length + 4), icon: 'Search', label: 'Command palette', action: () => openPalette()}
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
    {label: settings.storyline ? 'Turn storyline mode off' : 'Start storyline mode', icon: 'Bookmarked', run: () => (settings.storyline ? setStoryline(false) : startStoryline())},
    {label: 'Open the Library', icon: 'Bookmarked', run: () => { location.hash = '#/library'; }},
    {label: 'Open Scene Finder', icon: 'Search', run: () => { location.hash = '#/scenes'; }},
    {label: 'Back to the videos', icon: 'All', run: () => { location.hash = '#/'; }},
    {label: 'Open the upload calendar', icon: 'Watch later', run: () => openCalendar()},
    {label: 'Open advancements', icon: 'Rated', run: () => openVault('advancements')},
    {label: 'Open inventory', icon: 'Favorites', run: () => openVault('inventory')},
    ...(isStandalone() ? [] : [{label: 'Install the app', icon: 'All', run: installApp}]),
    ...(isAdmin ? [{label: 'Open the admin panel', icon: 'Settings', run: openAdmin}] : []),
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
  if (playerModal && playerKey(event)) return;
  if (playerDialog.open && !modalOpen && key.toLowerCase() === 'i') { event.preventDefault(); minimizeOrExpand(); return; }
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
  else if (button.dataset.rate) setRating(button.dataset.id, Number(button.dataset.rate), button);
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
$('#resetProfile').addEventListener('click', () => { if (confirm(`Reset your profile, ratings, favorites, watch later list, bookmarks, and saved watch progress${account.user ? ' on this device and in your account' : ' on this device'}?`)) { profile = defaultProfile(); try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ } if (account.user) saveProfile(); renderLibrary(); $('#profileDialog').close(); } });

$('#playerWatched').addEventListener('click', () => { if (activeVideoId) toggleWatched(activeVideoId); });
$('#playerFavorite').addEventListener('click', () => { if (activeVideoId) toggleFavorite(activeVideoId); });
$('#playerLater').addEventListener('click', () => { if (activeVideoId) toggleLater(activeVideoId); });
$('#playerShare').addEventListener('click', () => { if (activeVideoId) copyText(shareURL(activeVideoId), 'Link to this video copied'); });
$('#nextButton').addEventListener('click', () => { const current = getVideo(activeVideoId); const next = current && nextUp(current); if (next) openPlayer(next.id); });
$('#playerClose').addEventListener('click', closePlayer);
$('#theaterButton').addEventListener('click', toggleTheater);
$('#miniButton').addEventListener('click', minimizeOrExpand);
$('#bookmarkForm').addEventListener('submit', addBookmark);
playerDialog.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.seek !== undefined) { seekTo(Number(target.dataset.seek)); if (target.closest('#resumeNote')) $('#resumeNote').hidden = true; }
  else if (target.dataset.removeBookmark !== undefined) removeBookmark(Number(target.dataset.removeBookmark));
  else if (target.dataset.play) openPlayer(target.dataset.play);
  else if (target.dataset.multi) openMulti(target.dataset.multi);
  else if (target.dataset.rate) setRating(target.dataset.id, Number(target.dataset.rate), target);
  else if (target.id === 'loadComments') loadComments();
});
playerDialog.addEventListener('close', () => {
  if (suppressCloseTeardown) { suppressCloseTeardown = false; return; }
  cancelAutoplay();
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

/* ==========================================================================
   Storyline mode, auto-play next, "Where was I?", announcement + featured
   ========================================================================== */
function setStoryline(on, {announceIt = true} = {}) {
  settings.storyline = on;
  saveSettings();
  if (on && filters.sort === 'playlist') filters.sort = 'storyline';
  if (!on && filters.sort === 'storyline') filters.sort = 'playlist';
  syncSettingsControls();
  renderLibrary();
  if (activeVideoId && getVideo(activeVideoId)) { renderPlayerSide(getVideo(activeVideoId)); $('#nextButton').disabled = !nextUp(getVideo(activeVideoId)); }
  if (announceIt) toast(on ? 'Storyline mode on: next videos follow upload order across every creator.' : 'Storyline mode off: back to playlist order.');
}
function startStoryline() {
  if (!settings.storyline) setStoryline(true, {announceIt: false});
  const list = storyOrder();
  const resume = list.find(video => statusFor(video) === 'In progress') || list.find(video => statusFor(video) !== 'Watched');
  if (!resume) { toast('You have finished the whole storyline!'); return; }
  toast(`Storyline: ${resume.creator} · ${resume.date || ''}`);
  openPlayer(resume.id);
}

let autoplayTimer = null;
function cancelAutoplay() {
  clearInterval(autoplayTimer);
  autoplayTimer = null;
  const card = $('#autoplayCard');
  if (card) { card.hidden = true; card.innerHTML = ''; }
}
function startAutoplay(next) {
  cancelAutoplay();
  const card = $('#autoplayCard');
  let left = 10;
  const theme = themes[next.creator] || themes.Other;
  card.style.setProperty('--card-rgb', theme.rgb);
  card.innerHTML = `<div class="autoplay-inner lg"><p class="eyebrow">${settings.storyline ? 'NEXT IN THE STORYLINE' : 'UP NEXT'}</p>
    <div class="autoplay-row"><span class="autoplay-thumb"><img src="${escapeHTML(next.thumbnail || `https://i.ytimg.com/vi/${next.id}/mqdefault.jpg`)}" alt=""><svg class="autoplay-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/></svg><strong class="autoplay-count" id="autoplayCount">${left}</strong></span>
    <span class="autoplay-text"><strong>${escapeHTML(next.title)}</strong><span class="shelf-creator"><img src="${item(next.creator)}" alt="">${escapeHTML(next.creator)} · ${escapeHTML(next.length || '')}</span></span></div>
    <div class="autoplay-actions"><button class="primary-action" type="button" data-autoplay="go">Play now</button><button class="quiet-action" type="button" data-autoplay="cancel">Cancel</button></div></div>`;
  card.hidden = false;
  card.querySelector('[data-autoplay="go"]').focus({preventScroll: true});
  autoplayTimer = setInterval(() => {
    left -= 1;
    const counter = $('#autoplayCount');
    if (counter) counter.textContent = String(left);
    if (left <= 0) { cancelAutoplay(); openPlayer(next.id); }
  }, 1000);
  card.onclick = event => {
    const action = event.target.closest('[data-autoplay]')?.dataset.autoplay;
    if (action === 'go') { cancelAutoplay(); openPlayer(next.id); }
    if (action === 'cancel') { cancelAutoplay(); toast('Auto-play cancelled'); }
  };
}

const RECAP_KEY = 'uux-recap-dismissed';
function renderRecap() {
  const section = $('#recap');
  if (!section) return;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(RECAP_KEY) === '1'; } catch { /* private mode */ }
  const before = Object.entries(profile.progress).filter(([, entry]) => isObject(entry) && Number(entry.updatedAt) && Number(entry.updatedAt) < sessionStart);
  const lastActivity = before.reduce((latest, [, entry]) => Math.max(latest, Number(entry.updatedAt)), 0);
  const away = sessionStart - lastActivity;
  if (dismissed || openedThisSession || !videos.length || !lastActivity || away < 8 * 3600000) { section.hidden = true; return; }
  const recent = before.sort((a, b) => b[1].updatedAt - a[1].updatedAt).map(([id, entry]) => ({video: getVideo(id), entry})).filter(row => row.video);
  const rows = recent.filter(row => !row.entry.completed).slice(0, 3);
  const lastDone = recent.find(row => row.entry.completed);
  const next = lastDone ? nextUp(lastDone.video) : null;
  if (next && rows.length < 3 && !rows.some(row => row.video.id === next.id) && statusFor(next) !== 'Watched') rows.push({video: next, entry: null, isNext: true});
  if (!rows.length) { section.hidden = true; return; }
  const days = Math.round(away / 86400000);
  section.innerHTML = `<div class="recap-head"><div><p class="eyebrow">WHERE WAS I?</p><h2 id="recapTitle">Welcome back${profile.name ? `, ${escapeHTML(profile.name)}` : ''}.</h2><p class="recap-sub">It's been ${days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.round(away / 3600000)} hours`}. Here's where you left off.</p></div><button class="text-button" type="button" data-recap="dismiss">Hide</button></div>
    <div class="recap-row">${rows.map(({video, entry, isNext}) => {
      const theme = themes[video.creator] || themes.Other;
      const percent = percentFor(video);
      const label = isNext ? `Next after "${lastDone.video.title.slice(0, 40)}${lastDone.video.title.length > 40 ? '…' : ''}"` : `Stopped at ${formatSeconds(entry.seconds)} of ${formatSeconds(entry.duration || video.durationSeconds)} · ${timeAgo(entry.updatedAt)}`;
      return `<button class="recap-card" type="button" data-play="${video.id}" style="--card-rgb:${theme.rgb}"><span class="shelf-thumb"><img src="${escapeHTML(video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`)}" alt=""><span class="recap-play">${isNext ? 'Start' : 'Resume'}</span>${isNext ? '' : `<span class="progress-track"><i style="--progress:${percent}%"></i></span>`}</span><span class="shelf-text"><span class="shelf-creator"><img src="${item(video.creator)}" alt="">${escapeHTML(video.creator)}</span><strong>${escapeHTML(video.title)}</strong><span class="shelf-meta">${escapeHTML(label)}</span></span></button>`;
    }).join('')}</div>`;
  section.hidden = false;
}

function renderAnnouncement() {
  const box = $('#announcement');
  const note = siteConfig.announcement;
  let dismissed = '';
  try { dismissed = localStorage.getItem('uux-announcement-dismissed') || ''; } catch { /* ignore */ }
  if (!note || !note.text || dismissed === String(note.id)) { box.hidden = true; return; }
  box.className = `announcement tone-${note.tone || 'info'}`;
  box.innerHTML = `<span class="announcement-dot"></span><p>${escapeHTML(note.text)}${note.link ? ` <a href="${escapeHTML(note.link)}" target="_blank" rel="noreferrer">Learn more</a>` : ''}</p><button class="close-button small" type="button" data-announcement-close aria-label="Dismiss announcement">×</button>`;
  box.hidden = false;
}
function renderFeatured() {
  const section = $('#featured');
  const pick = siteConfig.featured && getVideo(siteConfig.featured.videoId);
  if (!pick) { section.hidden = true; section.innerHTML = ''; return; }
  const theme = themes[pick.creator] || themes.Other;
  section.style.setProperty('--card-rgb', theme.rgb);
  section.innerHTML = `<div class="featured-inner lg"><span class="featured-art"><img src="${escapeHTML(pick.thumbnail || `https://i.ytimg.com/vi/${pick.id}/hqdefault.jpg`)}" alt=""></span>
    <div class="featured-copy"><p class="eyebrow">★ FEATURED</p><h2>${escapeHTML(pick.title)}</h2>${siteConfig.featured.note ? `<p class="featured-note">${escapeHTML(siteConfig.featured.note)}</p>` : ''}
    <p class="new-meta"><img src="${item(pick.creator)}" alt="">${escapeHTML(pick.creator)} · ${escapeHTML(pick.date || '')} · ${escapeHTML(pick.length || '')}</p>
    <button class="primary-action" type="button" data-play="${pick.id}">${statusFor(pick) === 'In progress' ? 'Resume' : 'Watch'}</button></div></div>`;
  section.hidden = false;
}
async function loadSiteConfig() {
  try {
    const response = await fetch('/api/site', {cache: 'no-store'});
    if (!response.ok) return;
    const next = await response.json();
    siteConfig = {featured: next.featured || null, announcement: next.announcement || null, hidden: Array.isArray(next.hidden) ? next.hidden : []};
    safeWrite(SITE_KEY, siteConfig);
    if (allVideos.length) videos = visibleOnly(allVideos);
    renderLibrary();
  } catch { /* keep the cached copy */ }
}

/* ==========================================================================
   Upload calendar
   ========================================================================== */
const calendar = {year: 0, month: 0, day: ''};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function uploadsByDay() {
  const map = new Map();
  for (const video of videos) {
    const time = byDate(video);
    if (!time) continue;
    const key = dayKey(new Date(time));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(video);
  }
  for (const list of map.values()) list.sort((a, b) => byDate(a) - byDate(b));
  return map;
}
function openCalendar(targetKey = '') {
  const latest = videos.reduce((best, video) => Math.max(best, byDate(video)), 0);
  const anchor = targetKey ? new Date(`${targetKey}T12:00:00`) : new Date(latest || Date.now());
  calendar.year = anchor.getFullYear();
  calendar.month = anchor.getMonth();
  calendar.day = targetKey || (latest ? dayKey(new Date(latest)) : '');
  profile.counters.calendar = (profile.counters.calendar || 0) + 1;
  saveProfile();
  renderCalendar();
  $('#calendarDialog').showModal();
  checkAchievements();
}
function renderCalendar() {
  const map = uploadsByDay();
  const first = new Date(calendar.year, calendar.month, 1);
  const daysInMonth = new Date(calendar.year, calendar.month + 1, 0).getDate();
  const todayKey = dayKey(new Date());
  $('#calendarTitle').textContent = `${MONTHS[calendar.month]} ${calendar.year}`;
  const monthCount = [...map.entries()].filter(([key]) => key.startsWith(`${calendar.year}-${String(calendar.month + 1).padStart(2, '0')}`)).reduce((sum, [, list]) => sum + list.length, 0);
  $('#calLegend').innerHTML = `${CREATORS.map(name => `<span><i style="background:${themes[name].accent}"></i>${name}</span>`).join('')}<span class="cal-total">${monthCount} upload${monthCount === 1 ? '' : 's'} this month</span>`;
  const cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(name => `<span class="cal-weekday">${name}</span>`);
  for (let blank = 0; blank < first.getDay(); blank += 1) cells.push('<span class="cal-cell empty"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dayKey(new Date(calendar.year, calendar.month, day));
    const list = map.get(key) || [];
    const watchedAll = list.length && list.every(video => statusFor(video) === 'Watched');
    const dots = list.slice(0, 6).map(video => `<i style="background:${(themes[video.creator] || themes.Other).accent}"></i>`).join('');
    cells.push(list.length
      ? `<button class="cal-cell has ${calendar.day === key ? 'selected' : ''} ${watchedAll ? 'done' : ''} ${key === todayKey ? 'today' : ''}" type="button" data-cal-day="${key}" aria-label="${MONTHS[calendar.month]} ${day}: ${list.length} upload${list.length === 1 ? '' : 's'}${watchedAll ? ', all watched' : ''}"><span class="cal-num">${day}</span><span class="cal-dots">${dots}</span>${list.length > 1 ? `<span class="cal-badge">${list.length}</span>` : ''}</button>`
      : `<span class="cal-cell ${key === todayKey ? 'today' : ''}"><span class="cal-num">${day}</span></span>`);
  }
  $('#calGrid').innerHTML = cells.join('');
  const list = map.get(calendar.day) || [];
  const date = calendar.day ? new Date(`${calendar.day}T12:00:00`) : null;
  $('#calDay').innerHTML = list.length
    ? `<h3>${date.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'})}</h3><p class="side-note">${list.length} upload${list.length === 1 ? '' : 's'}${list.length > 1 ? ' · watch them in any order to see every perspective' : ''}</p>${list.map(video => sideCard(video, statusFor(video) === 'Watched' ? 'Watched' : statusFor(video) === 'In progress' ? `${percentFor(video)}% watched` : video.creator)).join('')}`
    : '<p class="side-note">Pick a highlighted day to see what was uploaded.</p>';
  const months = [...map.keys()].map(key => key.slice(0, 7)).sort();
  const current = `${calendar.year}-${String(calendar.month + 1).padStart(2, '0')}`;
  $('#calPrev').disabled = !months.length || current <= months[0];
  $('#calNext').disabled = !months.length || current >= months[months.length - 1];
}
function shiftMonth(step) {
  const map = uploadsByDay();
  const months = [...new Set([...map.keys()].map(key => key.slice(0, 7)))].sort();
  const current = `${calendar.year}-${String(calendar.month + 1).padStart(2, '0')}`;
  const target = step > 0 ? months.find(month => month > current) : [...months].reverse().find(month => month < current);
  if (!target) return;
  calendar.year = Number(target.slice(0, 4));
  calendar.month = Number(target.slice(5, 7)) - 1;
  calendar.day = [...map.keys()].filter(key => key.startsWith(target)).sort()[0] || '';
  renderCalendar();
}

/* ==========================================================================
   Achievements ("advancements") + collectible inventory
   Every advancement unlocks one cosmetic item. Unlocks sync with the account.
   ========================================================================== */
const RARITY = {
  common: {label: 'Common', color: '#ffffff'},
  rare: {label: 'Rare', color: '#55ffff'},
  epic: {label: 'Epic', color: '#ff7cff'},
  legendary: {label: 'Legendary', color: '#ffbf3f'},
  mythic: {label: 'Mythic', color: '#ff5555'}
};
const todayKey = () => dayKey(new Date());
function noteActivity() {
  const key = todayKey();
  if (!profile.days[key]) profile.days[key] = 1;
  const hour = new Date().getHours();
  if (hour < 5) profile.counters.nightOwl = 1;
}
function noteCompletion(id, previous) {
  if (previous && previous.completed) return;
  const video = getVideo(id);
  if (settings.storyline) profile.counters.storyline = (profile.counters.storyline || 0) + 1;
  if (video && Date.now() - byDate(video) <= 2 * 86400000) profile.counters.dayOne = 1;
  noteActivity();
}
function streaks() {
  const days = Object.keys(profile.days).sort();
  if (!days.length) return {current: 0, best: 0};
  let best = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    const gap = Math.round((new Date(`${days[index]}T12:00:00`) - new Date(`${days[index - 1]}T12:00:00`)) / 86400000);
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const last = days[days.length - 1];
  const sinceLast = Math.round((new Date(`${todayKey()}T12:00:00`) - new Date(`${last}T12:00:00`)) / 86400000);
  return {current: sinceLast <= 1 ? run : 0, best};
}
function collectionStats() {
  const watched = videos.filter(video => statusFor(video) === 'Watched');
  const byCreator = Object.fromEntries(CREATORS.map(name => {
    const list = videos.filter(video => video.creator === name);
    return [name, {done: list.filter(video => statusFor(video) === 'Watched').length, total: list.length}];
  }));
  return {
    watched: watched.length, total: videos.length, byCreator,
    creatorsTouched: CREATORS.filter(name => byCreator[name].done > 0).length,
    hours: hoursWatched(), ratings: Object.values(profile.ratings).filter(value => Number(value) > 0).length,
    favorites: Object.values(profile.favorites).filter(Boolean).length,
    bookmarks: Object.values(profile.bookmarks).reduce((sum, list) => sum + list.length, 0),
    streak: streaks(), counters: profile.counters, signedIn: Boolean(account.user),
    installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  };
}
const creatorGoal = (name) => stats => [stats.byCreator[name].done, stats.byCreator[name].total || 1];
const ACHIEVEMENTS = [
  {id: 'first', title: 'Taking Inventory', desc: 'Finish your first video.', item: 'book.png', rarity: 'common', goal: s => [s.watched, 1]},
  {id: 'ten', title: 'Getting an Upgrade', desc: 'Finish 10 videos.', item: 'stone_pickaxe.png', rarity: 'common', goal: s => [s.watched, 10]},
  {id: 'fifty', title: 'Diamonds!', desc: 'Finish 50 videos.', item: 'diamond.png', rarity: 'rare', goal: s => [s.watched, 50]},
  {id: 'everything', title: 'The End?', desc: 'Finish every video in the playlist.', item: 'nether_star.png', rarity: 'mythic', goal: s => [s.watched, s.total || 1]},
  {id: 'explorer', title: 'Adventuring Time', desc: 'Finish at least one video from every creator.', item: 'compass_00.png', rarity: 'rare', goal: s => [s.creatorsTouched, CREATORS.length]},
  {id: 'wemmbu', title: 'Mace Master', desc: 'Finish every Wemmbu video.', item: 'mace.png', rarity: 'legendary', goal: creatorGoal('Wemmbu')},
  {id: 'parrot', title: 'Eagle Eye', desc: 'Finish every Parrot video.', item: 'spyglass.png', rarity: 'legendary', goal: creatorGoal('Parrot')},
  {id: 'spoke', title: 'Postmortal', desc: 'Finish every Spoke video.', item: 'totem_of_undying.png', rarity: 'legendary', goal: creatorGoal('Spoke')},
  {id: 'flamefrags', title: 'Netherite Edge', desc: 'Finish every FlameFrags video.', item: 'netherite_sword.png', rarity: 'legendary', goal: creatorGoal('FlameFrags')},
  {id: 'fullserver', title: 'The Full Server', desc: 'Unlock all four creator advancements.', item: 'golden_helmet.png', rarity: 'mythic', goal: () => [['wemmbu', 'parrot', 'spoke', 'flamefrags'].filter(id => profile.achievements[id]).length, 4]},
  {id: 'marathon', title: 'Marathon', desc: 'Watch 10 hours in total.', item: 'clock_00.png', rarity: 'rare', goal: s => [Math.floor(s.hours), 10]},
  {id: 'timelord', title: 'Time Lord', desc: 'Watch 50 hours in total.', item: 'recovery_compass_00.png', rarity: 'epic', goal: s => [Math.floor(s.hours), 50]},
  {id: 'critic', title: 'Critic', desc: 'Rate 10 videos.', item: 'iron_ingot.png', rarity: 'common', goal: s => [s.ratings, 10]},
  {id: 'headcritic', title: 'Head Critic', desc: 'Rate 50 videos.', item: 'echo_shard.png', rarity: 'epic', goal: s => [s.ratings, 50]},
  {id: 'collector', title: 'Collector', desc: 'Favorite 5 videos.', item: 'bundle.png', rarity: 'rare', goal: s => [s.favorites, 5]},
  {id: 'cartographer', title: 'Cartographer', desc: 'Bookmark 5 moments.', item: 'map.png', rarity: 'rare', goal: s => [s.bookmarks, 5]},
  {id: 'streak3', title: 'Hot Streak', desc: 'Watch on 3 days in a row.', item: 'blaze_powder.png', rarity: 'rare', goal: s => [s.streak.best, 3]},
  {id: 'streak7', title: 'On Fire', desc: 'Watch on 7 days in a row.', item: 'fire_charge.png', rarity: 'epic', goal: s => [s.streak.best, 7]},
  {id: 'streak30', title: 'Unstoppable', desc: 'Watch on 30 days in a row.', item: 'netherite_ingot.png', rarity: 'mythic', goal: s => [s.streak.best, 30]},
  {id: 'lore', title: 'Lorekeeper', desc: 'Finish 10 videos in storyline mode.', item: 'enchanted_book.png', rarity: 'epic', goal: s => [s.counters.storyline || 0, 10]},
  {id: 'calendar', title: 'Time Traveler', desc: 'Open the upload calendar.', item: 'ender_eye.png', rarity: 'common', goal: s => [Math.min(1, s.counters.calendar || 0), 1]},
  {id: 'cloud', title: 'Cloud Walker', desc: 'Sign in to sync your progress.', item: 'elytra.png', rarity: 'epic', goal: s => [s.signedIn ? 1 : 0, 1]},
  {id: 'home', title: 'Home Sweet Home', desc: 'Open the site as an installed app.', item: 'cake.png', rarity: 'rare', goal: s => [s.installed ? 1 : 0, 1]},
  {id: 'nightowl', title: 'Night Owl', desc: 'Watch something between midnight and 5 a.m.', item: 'phantom_membrane.png', rarity: 'rare', secret: true, goal: s => [s.counters.nightOwl ? 1 : 0, 1]},
  {id: 'dayone', title: 'Day One', desc: 'Finish a video within 2 days of its upload.', item: 'firework_rocket.png', rarity: 'epic', secret: true, goal: s => [s.counters.dayOne ? 1 : 0, 1]}
];
let achievementsSeeded = false;
const advancementQueue = [];
function checkAchievements() {
  if (!videos.length) return;
  const stats = collectionStats();
  const fresh = [];
  for (let pass = 0; pass < 2; pass += 1) {
    for (const entry of ACHIEVEMENTS) {
      if (profile.achievements[entry.id]) continue;
      const [current, goal] = entry.goal(stats);
      if (current >= goal) { profile.achievements[entry.id] = Date.now(); fresh.push(entry); }
    }
  }
  const firstEver = !achievementsSeeded && !profile.counters.seeded;
  achievementsSeeded = true;
  if (firstEver) { profile.counters.seeded = 1; safeWrite(PROFILE_KEY, profile); if (typeof markDirty === 'function') markDirty(); }
  if (fresh.length) {
    safeWrite(PROFILE_KEY, profile);
    if (typeof markDirty === 'function') markDirty();
    if (!firstEver) fresh.forEach(entry => advancementQueue.push(entry));
    else if (fresh.length) toast(`You already earned ${fresh.length} advancement${fresh.length === 1 ? '' : 's'}! Open your collection to see them.`);
    pumpAdvancements();
  }
  updateVaultCount();
}
let advancementBusy = false;
function pumpAdvancements() {
  if (advancementBusy || !advancementQueue.length) return;
  advancementBusy = true;
  const entry = advancementQueue.shift();
  const rarity = RARITY[entry.rarity];
  const element = document.createElement('div');
  element.className = `advancement rarity-${entry.rarity}`;
  element.innerHTML = `<span class="adv-frame"><img src="${ITEM_ROOT}${entry.item}" alt=""></span><span><strong style="color:${entry.rarity === 'mythic' || entry.rarity === 'legendary' ? rarity.color : '#ffff55'}">${entry.rarity === 'mythic' || entry.rarity === 'legendary' ? 'Challenge Complete!' : 'Advancement Made!'}</strong><span>${escapeHTML(entry.title)}</span></span>`;
  element.addEventListener('click', () => openVault('advancements'));
  $('#advancements').append(element);
  const bus = audio.bus();
  if (bus) { [523, 659, 784, 1046].forEach((frequency, index) => tone(bus, index * 0.09, 0.6, {type: 'triangle', from: frequency, gain: 0.06})); setTimeout(() => bus.disconnect(), 1500); }
  setTimeout(() => element.classList.add('out'), 4200);
  setTimeout(() => { element.remove(); advancementBusy = false; pumpAdvancements(); }, 4700);
}
function updateVaultCount() {
  const count = Object.keys(profile.achievements).filter(id => ACHIEVEMENTS.some(entry => entry.id === id)).length;
  $('#vaultCount').textContent = count ? String(count) : '';
  const equipped = ACHIEVEMENTS.find(entry => entry.item === profile.equipped && profile.achievements[entry.id]);
  $('#avatarItem').hidden = !equipped;
  if (equipped) { $('#avatarItem').src = `${ITEM_ROOT}${equipped.item}`; $('#avatarItem').title = equipped.title; }
}

let vaultTab = 'advancements';
let vaultSelected = '';
function openVault(tab = vaultTab) {
  vaultTab = tab;
  checkAchievements();
  renderVault();
  if (!$('#vaultDialog').open) $('#vaultDialog').showModal();
}
function renderVault() {
  const stats = collectionStats();
  const unlocked = ACHIEVEMENTS.filter(entry => profile.achievements[entry.id]);
  $('#vaultSummary').textContent = `${unlocked.length} of ${ACHIEVEMENTS.length} advancements · ${stats.streak.current}-day streak (best ${stats.streak.best}) · ${stats.watched} of ${stats.total} videos finished. Items are cosmetic, earned by watching, and never sold.`;
  document.querySelectorAll('[data-vault-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.vaultTab === vaultTab)));
  if (vaultTab === 'advancements') {
    $('#vaultBody').innerHTML = `<div class="adv-grid">${ACHIEVEMENTS.map(entry => {
      const done = Boolean(profile.achievements[entry.id]);
      const [current, goal] = entry.goal(stats);
      const hidden = entry.secret && !done;
      const share = Math.min(100, Math.round(Math.min(current, goal) / goal * 100));
      return `<article class="adv-card ${done ? 'done' : ''} rarity-${entry.rarity}" style="--rarity:${RARITY[entry.rarity].color}"><span class="adv-frame"><img src="${ITEM_ROOT}${hidden ? 'barrier.png' : entry.item}" alt="" ${done ? '' : 'class="locked"'}></span>
        <div><h3>${hidden ? '???' : escapeHTML(entry.title)}</h3><p>${hidden ? 'Secret advancement. Keep watching.' : escapeHTML(entry.desc)}</p>
        ${done ? `<p class="adv-date">Unlocked ${new Date(profile.achievements[entry.id]).toLocaleDateString()}</p>` : hidden ? '' : `<div class="adv-progress"><i style="width:${share}%"></i></div><p class="adv-date">${Math.min(current, goal)} / ${goal}</p>`}</div></article>`;
    }).join('')}</div>`;
    return;
  }
  const slots = [...ACHIEVEMENTS].sort((a, b) => Number(Boolean(profile.achievements[b.id])) - Number(Boolean(profile.achievements[a.id])));
  const selected = ACHIEVEMENTS.find(entry => entry.id === vaultSelected && profile.achievements[entry.id]) || unlocked[0];
  const totalSlots = Math.max(36, Math.ceil(slots.length / 9) * 9);
  const slotHTML = Array.from({length: totalSlots}, (_, index) => {
    const entry = slots[index];
    if (!entry) return '<span class="inv-slot"></span>';
    const have = Boolean(profile.achievements[entry.id]);
    const name = have || !entry.secret ? entry.title : '???';
    const itemName = entry.item.replace(/_00\.png|\.png/, '').replace(/_/g, ' ');
    return `<button class="inv-slot ${have ? 'have' : 'missing'} ${['epic', 'legendary', 'mythic'].includes(entry.rarity) && have ? 'glint' : ''} ${selected?.id === entry.id ? 'selected' : ''}" type="button" data-inv="${entry.id}" style="--rarity:${RARITY[entry.rarity].color};--item:url('${ITEM_ROOT}${entry.item}')" aria-label="${escapeHTML(have ? `${itemName}, ${RARITY[entry.rarity].label}` : `Locked item from ${name}`)}"><img src="${ITEM_ROOT}${entry.item}" alt=""><span class="inv-tip"><b style="color:${RARITY[entry.rarity].color}">${escapeHTML(have ? itemName.replace(/\b\w/g, c => c.toUpperCase()) : 'Locked')}</b><i>${escapeHTML(RARITY[entry.rarity].label)}</i><i>${escapeHTML(have ? `From: ${entry.title}` : entry.secret ? 'Secret advancement' : `Unlock: ${entry.desc}`)}</i></span></button>`;
  }).join('');
  $('#vaultBody').innerHTML = `<div class="inv-layout"><div class="inv-panel"><p class="inv-title">Inventory</p><div class="inv-grid">${slotHTML}</div></div>
    <aside class="inv-detail">${selected ? `<div class="inv-preview ${['epic', 'legendary', 'mythic'].includes(selected.rarity) ? 'glint' : ''}" style="--item:url('${ITEM_ROOT}${selected.item}');--rarity:${RARITY[selected.rarity].color}"><img src="${ITEM_ROOT}${selected.item}" alt=""></div>
      <h3 style="color:${RARITY[selected.rarity].color}">${escapeHTML(selected.item.replace(/_00\.png|\.png/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}</h3><p class="inv-rarity">${RARITY[selected.rarity].label} · from <em>${escapeHTML(selected.title)}</em></p>
      <button class="${profile.equipped === selected.item ? 'quiet-action' : 'primary-action'}" type="button" data-equip="${selected.item}">${profile.equipped === selected.item ? 'Remove from profile' : 'Show on my profile'}</button>
      <p class="side-note">Drag to spin. Shown items appear next to your name in the sidebar.</p>` : '<p class="side-note">Finish your first video to earn your first item.</p>'}</aside></div>`;
  const preview = $('#vaultBody .inv-preview');
  if (preview) {
    let startX = 0;
    let base = 0;
    preview.addEventListener('pointerdown', event => { startX = event.clientX; base = Number(preview.dataset.spin || 0); preview.setPointerCapture(event.pointerId); preview.classList.add('dragging'); });
    preview.addEventListener('pointermove', event => { if (!preview.classList.contains('dragging')) return; const spin = base + (event.clientX - startX) * 1.2; preview.dataset.spin = String(spin); preview.style.setProperty('--spin', `${spin}deg`); });
    preview.addEventListener('pointerup', () => preview.classList.remove('dragging'));
  }
}

/* ==========================================================================
   Install as an app + new-upload notifications
   ========================================================================== */
let installPrompt = null;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; renderAppPanel(); });
window.addEventListener('appinstalled', () => { installPrompt = null; toast('Installed! Open Unstable UX from your home screen or apps.'); renderAppPanel(); });
async function installApp() {
  if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice.catch(() => null); installPrompt = null; renderAppPanel(); return; }
  $('#installDialog').showModal();
}
function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}
function base64ToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}
async function enablePush() {
  if (!pushSupported()) {
    if (isIOS() && !isStandalone()) { toast('On iPad and iPhone, install the app to your Home Screen first, then turn alerts on from there.'); $('#installDialog').showModal(); }
    else toast('This browser does not support notifications.');
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') { toast('Notifications are blocked. You can allow them in your browser settings.'); return false; }
  const keyResponse = await fetch('/api/push/key');
  if (!keyResponse.ok) { toast('Notifications are not available on this site yet.'); return false; }
  const {publicKey} = await keyResponse.json();
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey)});
  const saved = await fetch('/api/push/subscribe', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({endpoint: subscription.endpoint})});
  if (!saved.ok) { toast('Could not turn on alerts. Try again.'); return false; }
  toast('Alerts on. You will get a notification when a new Unstable video is added.');
  return true;
}
async function disablePush() {
  const subscription = await currentPushSubscription();
  if (subscription) {
    await fetch('/api/push/subscribe', {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({endpoint: subscription.endpoint})}).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }
  toast('New-upload alerts off.');
}
async function renderAppPanel() {
  const installed = isStandalone();
  $('#installButton').hidden = installed || (!installPrompt && !isIOS());
  $('#installButton').textContent = isIOS() ? 'Add to Home Screen' : 'Install the app';
  let subscribed = false;
  try { subscribed = Boolean(await currentPushSubscription()); } catch { /* not ready */ }
  $('#pushToggle').checked = subscribed && Notification.permission === 'granted';
  $('#appNote').textContent = installed
    ? 'Running as an installed app.'
    : isIOS() ? 'On iPad and iPhone, add the site to your Home Screen to get alerts.' : installPrompt ? 'Install it for a full-screen app with its own icon.' : 'Get a notification when a new video lands in the playlist.';
}

/* ==========================================================================
   Admin panel (only for usernames in ADMIN_USERNAMES on the server)
   ========================================================================== */
let isAdmin = false;
async function checkAdmin() {
  try {
    const response = await fetch('/api/admin/me', {cache: 'no-store'});
    isAdmin = response.ok && (await response.json()).admin === true;
  } catch { isAdmin = false; }
  $('#adminTrigger').hidden = !isAdmin;
}
const adminDraft = {featured: null, announcement: null, hidden: []};
async function openAdmin() {
  if (!isAdmin) return;
  Object.assign(adminDraft, JSON.parse(JSON.stringify(siteConfig)));
  $('#adminBody').innerHTML = '<p class="side-note">Loading…</p>';
  $('#adminDialog').showModal();
  let stats = null;
  try { const response = await fetch('/api/admin/stats', {cache: 'no-store'}); stats = response.ok ? await response.json() : null; } catch { /* offline */ }
  renderAdmin(stats);
}
function videoOptions(selected = '') {
  return `<option value="">Choose a video…</option>${[...allVideos].sort((a, b) => byDate(b) - byDate(a)).map(video => `<option value="${video.id}" ${video.id === selected ? 'selected' : ''}>${escapeHTML(`${video.creator} · ${video.title}`.slice(0, 90))}</option>`).join('')}`;
}
function renderAdmin(stats) {
  const hidden = adminDraft.hidden.map(id => allVideos.find(video => video.id === id) || {id, title: id, creator: '?'});
  const last = stats?.lastCheck;
  $('#adminBody').innerHTML = `
    ${stats ? `<div class="admin-stats"><div><strong>${stats.users}</strong><span>accounts</span></div><div><strong>${stats.subscribers}</strong><span>alert subscribers</span></div><div><strong>${stats.knownVideos}</strong><span>videos tracked</span></div><div><strong>${last ? timeAgo(last.at) : 'never'}</strong><span>last playlist check</span></div></div>` : ''}
    ${stats && !stats.youtubeKey ? '<p class="account-error">The YouTube API key is missing, so automatic upload checks cannot run.</p>' : ''}
    <section class="admin-block"><h3>Announcement banner</h3><p class="side-note">Shown at the top of the site for everyone until they dismiss it.</p>
      <textarea id="adminAnnouncement" maxlength="240" rows="2" placeholder="e.g. New season starts Friday!">${escapeHTML(adminDraft.announcement?.text || '')}</textarea>
      <div class="admin-row"><label class="side-select"><span>Style</span><select id="adminTone"><option value="info">Info</option><option value="hype">Hype</option><option value="warning">Warning</option></select></label><input id="adminLink" type="url" placeholder="Optional https:// link" value="${escapeHTML(adminDraft.announcement?.link || '')}" /></div></section>
    <section class="admin-block"><h3>Featured video</h3><p class="side-note">A spotlight card near the top of the home page.</p>
      <select id="adminFeatured">${videoOptions(adminDraft.featured?.videoId)}</select>
      <input id="adminFeaturedNote" maxlength="160" placeholder="Optional note, e.g. 'Must-watch before the finale'" value="${escapeHTML(adminDraft.featured?.note || '')}" /></section>
    <section class="admin-block"><h3>Hidden videos</h3><p class="side-note">Hidden videos disappear from the library for everyone and never trigger alerts.</p>
      <div class="admin-row"><select id="adminHideSelect">${videoOptions()}</select><button class="quiet-action compact" type="button" id="adminHide">Hide</button></div>
      <ul class="admin-hidden">${hidden.length ? hidden.map(video => `<li><span>${escapeHTML(`${video.creator} · ${video.title}`)}</span><button class="text-button" type="button" data-unhide="${video.id}">Unhide</button></li>`).join('') : '<li class="muted">No hidden videos.</li>'}</ul></section>
    <section class="admin-block"><h3>Notifications</h3><p class="side-note">The site checks the playlist every 30 minutes and alerts subscribers about uploads from the last 7 days.${stats?.lastPush ? ` Last alert: “${escapeHTML(stats.lastPush.title)}” ${timeAgo(stats.lastPush.sentAt)}.` : ''}</p>
      <div class="admin-row"><button class="quiet-action compact" type="button" id="adminTestPush">Send a test to this device</button><button class="quiet-action compact" type="button" id="adminCheckNow">Check playlist now</button></div><p class="side-note" id="adminPushNote"></p></section>
    <div class="profile-actions"><button class="primary-action" type="button" id="adminSave">Save changes</button><span class="side-note" id="adminSaveNote"></span></div>`;
  $('#adminTone').value = adminDraft.announcement?.tone || 'info';
}
function readAdminForm() {
  const text = $('#adminAnnouncement').value.trim();
  const previous = siteConfig.announcement;
  adminDraft.announcement = text ? {text, tone: $('#adminTone').value, link: $('#adminLink').value.trim(), id: previous && previous.text === text ? previous.id : String(Date.now())} : null;
  const featured = $('#adminFeatured').value;
  adminDraft.featured = featured ? {videoId: featured, note: $('#adminFeaturedNote').value.trim()} : null;
}
async function saveAdmin() {
  readAdminForm();
  $('#adminSaveNote').textContent = 'Saving…';
  const response = await fetch('/api/admin/site', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(adminDraft)}).catch(() => null);
  if (!response || !response.ok) { $('#adminSaveNote').textContent = 'Could not save. Are you still signed in?'; return; }
  siteConfig = await response.json();
  safeWrite(SITE_KEY, siteConfig);
  try { localStorage.removeItem('uux-announcement-dismissed'); } catch { /* ignore */ }
  videos = visibleOnly(allVideos);
  renderLibrary();
  $('#adminSaveNote').textContent = 'Saved. Everyone sees it on their next visit.';
}
$('#adminDialog').addEventListener('click', async event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.id === 'adminSave') saveAdmin();
  if (target.id === 'adminHide') { const id = $('#adminHideSelect').value; if (id && !adminDraft.hidden.includes(id)) { readAdminForm(); adminDraft.hidden.push(id); renderAdmin(null); } }
  if (target.dataset.unhide) { readAdminForm(); adminDraft.hidden = adminDraft.hidden.filter(id => id !== target.dataset.unhide); renderAdmin(null); }
  if (target.id === 'adminTestPush') {
    const subscription = await currentPushSubscription().catch(() => null);
    if (!subscription) { $('#adminPushNote').textContent = 'Turn on New-upload alerts in the sidebar first.'; return; }
    const response = await fetch('/api/admin/test-push', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({endpoint: subscription.endpoint})});
    const data = await response.json().catch(() => ({}));
    $('#adminPushNote').textContent = response.ok && data.ok ? 'Test sent. It should arrive in a few seconds.' : (data.error || `Push service answered ${data.status || response.status}.`);
  }
  if (target.id === 'adminCheckNow') {
    $('#adminPushNote').textContent = 'Checking the playlist…';
    const response = await fetch('/api/admin/check-now', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
    const data = await response.json().catch(() => ({}));
    $('#adminPushNote').textContent = !response.ok ? (data.error || 'Check failed.') : data.seeded ? `First check done: ${data.seeded} videos recorded. Alerts start with the next new upload.` : data.skipped ? 'Skipped: the YouTube key is missing.' : `${data.added || 0} new video${data.added === 1 ? '' : 's'} found${data.notified ? `, alerts sent to ${data.sent} device${data.sent === 1 ? '' : 's'}` : ''}.`;
  }
});

/* ---------- wiring for this round ---------- */
$('#storylineToggle').addEventListener('change', event => setStoryline(event.target.checked));
$('#autoplayToggle').addEventListener('change', event => { settings.autoplay = event.target.checked; saveSettings(); });
$('#storylineButton').addEventListener('click', startStoryline);
$('#calendarTrigger').addEventListener('click', () => openCalendar());
$('#vaultTrigger').addEventListener('click', () => openVault());
$('#adminTrigger').addEventListener('click', openAdmin);
$('#installButton').addEventListener('click', installApp);
$('#pushToggle').addEventListener('change', async event => {
  const want = event.target.checked;
  event.target.disabled = true;
  try { const ok = want ? await enablePush() : (await disablePush(), true); if (!ok) event.target.checked = false; }
  catch { toast('Could not change alerts. Try again.'); event.target.checked = !want; }
  finally { event.target.disabled = false; renderAppPanel(); }
});
$('#calPrev').addEventListener('click', () => shiftMonth(-1));
$('#calNext').addEventListener('click', () => shiftMonth(1));
$('#calLatest').addEventListener('click', () => { $('#calendarDialog').close(); openCalendar(); });
$('#calGrid').addEventListener('click', event => { const cell = event.target.closest('[data-cal-day]'); if (cell) { calendar.day = cell.dataset.calDay; renderCalendar(); } });
$('#calDay').addEventListener('click', event => { const card = event.target.closest('[data-play]'); if (card) { $('#calendarDialog').close(); openPlayer(card.dataset.play); } });
document.querySelectorAll('[data-vault-tab]').forEach(button => button.addEventListener('click', () => { vaultTab = button.dataset.vaultTab; renderVault(); }));
$('#vaultBody').addEventListener('click', event => {
  const slot = event.target.closest('[data-inv]');
  if (slot && slot.classList.contains('have')) { vaultSelected = slot.dataset.inv; renderVault(); return; }
  const equip = event.target.closest('[data-equip]');
  if (equip) { profile.equipped = profile.equipped === equip.dataset.equip ? '' : equip.dataset.equip; saveProfile(); updateVaultCount(); renderVault(); }
});
$('#recap').addEventListener('click', event => {
  if (event.target.closest('[data-recap="dismiss"]')) { try { sessionStorage.setItem(RECAP_KEY, '1'); } catch { /* ignore */ } renderRecap(); return; }
  handleCardClick(event);
});
$('#featured').addEventListener('click', handleCardClick);
$('#announcement').addEventListener('click', event => {
  if (!event.target.closest('[data-announcement-close]')) return;
  try { localStorage.setItem('uux-announcement-dismissed', String(siteConfig.announcement?.id || '')); } catch { /* ignore */ }
  renderAnnouncement();
});
document.querySelectorAll('.calendar-dialog, .vault-dialog, .install-dialog, .admin-dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));

/* ==========================================================================
   Views: Videos (home) · Library (entered through an End portal) · Scene Finder
   ========================================================================== */
let currentView = 'home';
const VIEW_IDS = {home: '#homeView', library: '#libraryView', scenes: '#sceneView'};
function viewFromHash() { const hash = location.hash.replace(/^#\/?/, ''); return hash.startsWith('library') ? 'library' : hash.startsWith('scenes') ? 'scenes' : 'home'; }
function showView(name) {
  currentView = name;
  for (const [key, selector] of Object.entries(VIEW_IDS)) $(selector).hidden = key !== name;
  document.querySelectorAll('.top-tabs a').forEach(link => { if (link.dataset.view === name) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  document.body.dataset.view = name;
  if (name === 'library') openLibrary();
  if (name === 'scenes') openScenes();
  if (name !== 'library') window.scrollTo({top: 0, behavior: 'auto'});
}
function route() {
  const name = viewFromHash();
  if (name === currentView) { if (name === 'library') libraryRoute(); return; }
  if (name === 'library' && currentView !== 'library' && canAnimate() && !reducedMotion.matches) playPortal(() => showView('library'));
  else showView(name);
}
window.addEventListener('hashchange', route);
document.querySelectorAll('.top-tabs a').forEach(link => link.addEventListener('click', event => {
  if (link.dataset.view === currentView && link.dataset.view !== 'home') { event.preventDefault(); window.scrollTo({top: 0, behavior: 'smooth'}); }
  if (link.dataset.view === 'home' && location.hash.replace(/^#\/?/, '') === '') { event.preventDefault(); showView('home'); }
}));

/* The End portal and the Library live in library.js. */
function highlight(text, words) {
  let safe = escapeHTML(text);
  for (const word of words) if (word.length >= 2) safe = safe.replace(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  return safe;
}

/* ---------- Scene Finder ---------- */
let sceneSource = 'all';
let sceneCreator = 'All';
const SCENE_SOURCES = [['all', 'All moments'], ['chapter', 'Chapters'], ['comment', 'Community'], ['bookmark', 'My bookmarks']];
async function openScenes() {
  $('#sceneSources').innerHTML = SCENE_SOURCES.map(([key, label]) => `<button type="button" class="side-chip ${sceneSource === key ? 'active' : ''}" data-scenesource="${key}" aria-pressed="${sceneSource === key}">${label}</button>`).join('');
  $('#sceneCreators').innerHTML = ['All', ...CREATORS].map(name => `<button type="button" class="side-chip ${sceneCreator === name ? 'active' : ''}" data-scenecreator="${name}" aria-pressed="${sceneCreator === name}" style="--row-rgb:${(themes[name] || themes.All).rgb}"><img src="${item(name)}" alt="">${name === 'All' ? 'All creators' : name}</button>`).join('');
  if (!momentsData) { $('#sceneResults').innerHTML = '<div class="lib-loading"><span class="player-loading"><span></span></span>Loading moments…</div>'; await loadMoments(); }
  renderScenes();
}
function allMoments() {
  const list = [];
  for (const video of videos) {
    const indexed = momentsData?.videos?.[video.id]?.items || [];
    const chapters = video.chapters?.length ? video.chapters.map(chapter => ({t: chapter.t, label: chapter.label, source: 'chapter'})) : indexed.filter(moment => moment.source === 'chapter');
    for (const moment of [...chapters, ...indexed.filter(entry => entry.source === 'comment')]) list.push({...moment, video});
    for (const mark of profile.bookmarks[video.id] || []) list.push({t: mark.t, label: mark.label || 'Your bookmark', source: 'bookmark', video});
  }
  return list;
}
function renderScenes() {
  const indexed = Object.keys(momentsData?.videos || {}).length;
  $('#sceneStatus').textContent = `${indexed} of ${videos.length} videos scanned for community timestamps${momentsData?.updatedAt ? ` · updated ${timeAgo(momentsData.updatedAt)}` : ''}. New videos are added every 30 minutes.`;
  const query = $('#sceneSearch').value.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  let list = allMoments().filter(moment => (sceneSource === 'all' || moment.source === sceneSource) && (sceneCreator === 'All' || moment.video.creator === sceneCreator));
  if (words.length) {
    list = list.map(moment => {
      const text = moment.label.toLowerCase();
      const title = moment.video.title.toLowerCase();
      const hits = words.filter(word => text.includes(word)).length;
      const titleHits = words.filter(word => title.includes(word) || moment.video.creator.toLowerCase().includes(word)).length;
      return {moment, score: hits * 3 + titleHits + Math.log10((moment.likes || 0) + 1) * 0.6 + (moment.source === 'bookmark' ? 1 : 0)};
    }).filter(entry => words.every(word => `${entry.moment.label} ${entry.moment.video.title} ${entry.moment.video.creator}`.toLowerCase().includes(word))).sort((a, b) => b.score - a.score).map(entry => entry.moment);
  } else {
    list = list.sort((a, b) => (b.source === 'bookmark') - (a.source === 'bookmark') || (b.likes || 0) - (a.likes || 0) || byDate(b.video) - byDate(a.video));
  }
  const total = list.length;
  list = list.slice(0, 80);
  if (!total) {
    $('#sceneResults').innerHTML = `<div class="empty-state"><img src="${ITEM_ROOT}spyglass.png" alt=""><h3>${words.length ? `No moments match “${escapeHTML(query)}”.` : 'No moments here yet.'}</h3><p>${sceneSource === 'bookmark' ? 'Bookmark moments while you watch (press B) and they show up here.' : 'Community timestamps are collected from top YouTube comments as the index builds.'}</p></div>`;
    return;
  }
  $('#sceneResults').innerHTML = `<p class="scene-count">${words.length ? `${total} moment${total === 1 ? '' : 's'} found` : 'Most-loved moments'}${total > 80 ? ' · showing the top 80' : ''}</p><div class="scene-grid">${list.map(moment => {
    const theme = themes[moment.video.creator] || themes.Other;
    const badge = moment.source === 'chapter' ? 'Chapter' : moment.source === 'bookmark' ? 'Your bookmark' : `♥ ${Number(moment.likes || 0).toLocaleString()}`;
    return `<button type="button" class="scene-card lg" data-scene="${moment.video.id}" data-t="${moment.t}" data-label="${escapeHTML(moment.label.slice(0, 80))}" style="--card-rgb:${theme.rgb}"><span class="scene-thumb"><img src="${escapeHTML(frameFor(moment.video, moment.t))}" alt="" loading="lazy"><span class="scene-time">${formatSeconds(moment.t)}</span><span class="scene-play" aria-hidden="true"></span></span><span class="scene-body"><span class="scene-badge src-${moment.source}">${badge}</span><strong>${highlight(moment.label, words)}</strong><span class="shelf-creator"><img src="${item(moment.video.creator)}" alt="">${escapeHTML(moment.video.creator)} · ${escapeHTML(moment.video.date || '')}</span><span class="scene-video">${highlight(moment.video.title, words)}</span></span></button>`;
  }).join('')}</div>`;
}
$('#sceneSearch').addEventListener('input', () => { clearTimeout(window.__sceneTimer); window.__sceneTimer = setTimeout(renderScenes, 120); });
$('#sceneView').addEventListener('click', event => {
  const source = event.target.closest('[data-scenesource]');
  if (source) { sceneSource = source.dataset.scenesource; openScenes(); return; }
  const creator = event.target.closest('[data-scenecreator]');
  if (creator) { sceneCreator = creator.dataset.scenecreator; openScenes(); return; }
  const card = event.target.closest('[data-scene]');
  if (card) openPlayer(card.dataset.scene, {start: Number(card.dataset.t), label: card.dataset.label});
});

/* ---------- boot ---------- */
allVideos = videos.filter(keepVideo).map(enrich);
videos = visibleOnly(allVideos);
catalogComplete = allVideos.length > 0;
const creatorFromURL = readURL();
if (!creatorFromURL && profile.favoriteCreator) filters.creator = profile.favoriteCreator;
$('#searchInput').value = filters.search;
applySidebarState();
applySettings();
renderLibrary();
showHotbar(3000);
if (catalogMeta.refreshedAt && videos.length) setNotice(`<strong>Showing your saved copy</strong> from ${timeAgo(catalogMeta.refreshedAt)}. Checking the official playlist for changes…`);
tryOpenPendingVideo();
renderAccount();
if (syncMeta.username) pullProfile({force: true});
else accountRequest('/me').then(result => { account.available = result.status !== 503 && result.status !== 404; if (result.ok && result.data.user) pullProfile({force: true}); else renderAccount(); }).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(() => renderAppPanel()).catch(() => {});
renderAppPanel();
loadSiteConfig();
checkAdmin().then(() => { if (currentView === 'library') libraryAdminCheck(); });
// library.js loads after this file, so the first route waits for it.
document.addEventListener('DOMContentLoaded', () => { if (viewFromHash() !== 'home') showView(viewFromHash()); });
refreshPlaylist();
