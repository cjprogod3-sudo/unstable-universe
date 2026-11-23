const PLAYLIST_ID = 'PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg';
const ITEM_ROOT = 'https://assets.mcasset.cloud/1.21.4/assets/minecraft/textures/item/';
const PROFILE_KEY = 'unstable-universe-library-profile-v1';
const CATALOG_KEY = 'unstable-universe-library-catalog-v1';

const icons = {
  All: 'nether_star.png', Wemmbu: 'mace.png', Parrot: 'spyglass.png', Spoke: 'totem_of_undying.png', FlameFrags: 'netherite_sword.png', Other: 'compass_00.png',
  'In progress': 'recovery_compass.png', Watched: 'experience_bottle.png', 'Not started': 'map.png', Favorites: 'amethyst_shard.png', Rated: 'amethyst_shard.png', Longform: 'clock_00.png',
  Civilization: 'end_crystal.png', Law: 'book.png', Dimension: 'ender_eye.png', War: 'netherite_sword.png', Mafia: 'echo_shard.png', Prison: 'iron_bars.png', 'Bases & vaults': 'chest.png'
};
const themes = {
  All: {key: 'all', accent: '#b17cff', rgb: '177,124,255'},
  Wemmbu: {key: 'wemmbu', accent: '#be85ff', rgb: '190,133,255'},
  Parrot: {key: 'parrot', accent: '#77f59c', rgb: '119,245,156'},
  Spoke: {key: 'spoke', accent: '#ff85d3', rgb: '255,133,211'},
  FlameFrags: {key: 'flamefrags', accent: '#ff6d78', rgb: '255,109,120'},
  Civilization: {key: 'civilization', accent: '#e0bf6b', rgb: '224,191,107'},
  War: {key: 'war', accent: '#ff9b62', rgb: '255,155,98'},
  Mafia: {key: 'mafia', accent: '#c49cff', rgb: '196,156,255'}
};

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));
const item = name => `${ITEM_ROOT}${icons[name] || icons.All}`;
const safeRead = (key, fallback) => { try { const parsed = JSON.parse(localStorage.getItem(key)); return parsed && typeof parsed === 'object' ? parsed : fallback; } catch { return fallback; } };
const defaultProfile = () => ({name: '', progress: {}, ratings: {}, favorites: {}, lastVideoId: ''});
const normalizeProfile = raw => ({...defaultProfile(), ...raw, progress: raw?.progress || {}, ratings: raw?.ratings || {}, favorites: raw?.favorites || {}});

let profile = normalizeProfile(safeRead(PROFILE_KEY, defaultProfile()));
let videos = Array.isArray(safeRead(CATALOG_KEY, [])) ? safeRead(CATALOG_KEY, []) : [];
let filters = {creator: 'All', collection: 'All', tag: 'All', search: '', sort: 'playlist'};
let loading = false;
let activeVideoId = '';
let youtubePlayer = null;
let playerTimer = null;
let youtubeLoader = null;

function saveProfile() { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
function saveCatalog() { localStorage.setItem(CATALOG_KEY, JSON.stringify(videos)); }
function progressFor(id) { return profile.progress[id] || {seconds: 0, duration: 0, completed: false}; }
function ratingFor(id) { return Math.max(0, Math.min(5, Number(profile.ratings[id] || 0))); }
function statusFor(video) {
  const progress = progressFor(video.id);
  if (progress.completed) return 'Watched';
  if (progress.seconds > 3) return 'In progress';
  return 'Not started';
}
function percentFor(video) {
  const progress = progressFor(video.id);
  return progress.completed ? 100 : progress.duration > 0 ? Math.max(0, Math.min(100, Math.round(progress.seconds / progress.duration * 100))) : 0;
}
function formatSeconds(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}
function tagsFor(video) {
  const text = `${video.title || ''} ${video.description || ''}`.toLowerCase();
  const tags = [];
  if (text.includes('civilization')) tags.push('Civilization');
  if (/\blaw\b|lawless/.test(text)) tags.push('Law');
  if (text.includes('dimension') || text.includes('end dimension')) tags.push('Dimension');
  if (/\bwar\b|battle|empire/.test(text)) tags.push('War');
  if (text.includes('mafia')) tags.push('Mafia');
  if (text.includes('prison')) tags.push('Prison');
  if (text.includes('base') || text.includes('vault')) tags.push('Bases & vaults');
  return tags;
}
function knownCreator(value) { return ['Wemmbu', 'Parrot', 'Spoke', 'FlameFrags'].includes(value) ? value : 'Other'; }
function enrich(video, index) {
  return {...video, position: Number(video.position || index + 1), creator: knownCreator(video.creator), tags: tagsFor(video)};
}
function iconForActiveTheme() { return filters.creator !== 'All' ? filters.creator : filters.tag !== 'All' ? filters.tag : 'All'; }
function currentTheme() { return themes[iconForActiveTheme()] || themes.All; }
function applyTheme() {
  const theme = currentTheme();
  document.body.dataset.theme = theme.key;
  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--accent-rgb', theme.rgb);
  $('#activeItem').src = item(iconForActiveTheme());
  $('#activeMode').textContent = `${iconForActiveTheme().toUpperCase()} MODE`;
  $('#artifactField').innerHTML = Array.from({length: 8}, (_, index) => {
    const left = (index * 17 + 3) % 95;
    const top = (index * 23 + 11) % 86;
    return `<img class="artifact" src="${item(iconForActiveTheme())}" alt="" style="--artifact-rgb:${theme.rgb};--drift-time:${6 + index}s;--drift-x:${index % 2 ? 22 : -22}px;--drift-y:${15 + index * 5}px;left:${left}%;top:${top}%">`;
  }).join('');
}
function allTags() { return [...new Set(videos.flatMap(video => video.tags))]; }
function filterDefinitions() {
  return [
    {key: 'creator', label: 'CREATORS', values: ['All', 'Wemmbu', 'Parrot', 'Spoke', 'FlameFrags', 'Other']},
    {key: 'collection', label: 'MY LIBRARY', values: ['All', 'In progress', 'Watched', 'Not started', 'Favorites', 'Rated', 'Longform']},
    {key: 'tag', label: 'AUTO TAGS', values: ['All', ...allTags()]}
  ];
}
function chipColor(value) {
  const theme = themes[value] || themes.All;
  return {accent: theme.accent, rgb: theme.rgb};
}
function renderFilters() {
  $('#filterGroups').innerHTML = filterDefinitions().map(group => {
    const chips = group.values.map(value => {
      const color = chipColor(value);
      const active = filters[group.key] === value;
      return `<button class="chip ${active ? 'active' : ''}" type="button" data-filter-group="${group.key}" data-filter-value="${escapeHTML(value)}" style="--chip-color:${color.accent};--chip-rgb:${color.rgb}"><img src="${item(value)}" alt="">${escapeHTML(value)}</button>`;
    }).join('');
    return `<div class="filter-group"><span class="filter-group-label">${group.label}</span><div class="chip-scroller">${chips}</div></div>`;
  }).join('');
}
function matches(video) {
  if (filters.creator !== 'All' && video.creator !== filters.creator) return false;
  const status = statusFor(video);
  if (filters.collection === 'In progress' && status !== 'In progress') return false;
  if (filters.collection === 'Watched' && status !== 'Watched') return false;
  if (filters.collection === 'Not started' && status !== 'Not started') return false;
  if (filters.collection === 'Favorites' && !profile.favorites[video.id]) return false;
  if (filters.collection === 'Rated' && !ratingFor(video.id)) return false;
  if (filters.collection === 'Longform' && !/^([1-9]\d*):/.test(video.length || '')) return false;
  if (filters.tag !== 'All' && !video.tags.includes(filters.tag)) return false;
  const needle = filters.search.trim().toLowerCase();
  return !needle || `${video.title} ${video.creator} ${video.description} ${video.tags.join(' ')}`.toLowerCase().includes(needle);
}
function orderedVideos() {
  const found = videos.filter(matches);
  if (filters.sort === 'newest') return [...found].sort((a, b) => new Date(b.publishedAt || b.date) - new Date(a.publishedAt || a.date));
  if (filters.sort === 'rating') return [...found].sort((a, b) => ratingFor(b.id) - ratingFor(a.id) || a.position - b.position);
  return [...found].sort((a, b) => a.position - b.position);
}
function ratingMarkup(video) {
  const rating = ratingFor(video.id);
  return `<div class="rating-row"><span class="rating-caption">YOUR RATING ${rating ? `· ${rating}/5` : ''}</span><div class="shards" aria-label="Rate ${escapeHTML(video.title)}">${Array.from({length: 5}, (_, index) => `<button class="shard ${index < rating ? 'active' : ''}" type="button" data-rate="${index + 1}" data-id="${video.id}" aria-label="Rate ${index + 1} out of 5"><img src="${item('Rated')}" alt=""></button>`).join('')}</div></div>`;
}
function cardMarkup(video) {
  const rating = ratingFor(video.id);
  const status = statusFor(video);
  const progress = percentFor(video);
  const favorite = Boolean(profile.favorites[video.id]);
  const tagHTML = video.tags.length ? video.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('') : '<span class="tag">Playlist</span>';
  const description = escapeHTML(video.description || 'No description was provided by the playlist.');
  const thumbnail = escapeHTML(video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`);
  return `<article class="video-card" style="--rating-glow:${rating / 5}">
    <div class="card-art"><img src="${thumbnail}" alt="" loading="lazy"><span class="episode-order">#${String(video.position).padStart(2, '0')}</span><span class="duration-badge">${escapeHTML(video.length || '—')}</span><span class="video-status">${status}</span></div>
    <div class="card-content"><div class="creator-line"><span>${escapeHTML(video.creator)}</span><span>${escapeHTML(video.views || '—')} views</span></div>
      <h3 class="video-title">${escapeHTML(video.title)}</h3><p class="video-meta">${escapeHTML(video.date || 'Unknown date')} · ${escapeHTML(video.ago || '')}</p>
      <p class="video-description" id="description-${video.id}">${description}</p>
      <div class="tag-row">${tagHTML}</div>
      <div class="progress-track" title="${progress}% watched"><i style="--progress:${progress}%"></i></div>
      ${ratingMarkup(video)}
      <div class="card-actions"><button class="card-action" type="button" data-play="${video.id}">Watch</button><button class="card-action ${favorite ? 'favorited' : ''}" type="button" data-favorite="${video.id}">${favorite ? 'Saved' : 'Save'}</button><button class="card-action" type="button" data-watched="${video.id}">${status === 'Watched' ? 'Unmark' : 'Mark watched'}</button><a class="card-action" href="https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}&list=${PLAYLIST_ID}" target="_blank" rel="noreferrer">YouTube</a></div>
    </div></article>`;
}
function renderSkeletons() { $('#videoGrid').innerHTML = Array.from({length: 8}, () => $('#loadingCard').innerHTML).join(''); }
function renderLibrary() {
  applyTheme();
  renderFilters();
  const found = orderedVideos();
  $('#catalogCount').textContent = String(videos.length);
  $('#resultsText').textContent = videos.length ? `${found.length} of ${videos.length} videos` : 'Loading official playlist…';
  $('#emptyState').hidden = Boolean(found.length || loading);
  if (!videos.length && loading) { renderSkeletons(); return; }
  $('#videoGrid').innerHTML = found.map(cardMarkup).join('');
  updateProfileUI();
}
function updateProfileUI() {
  const watched = videos.filter(video => statusFor(video) === 'Watched').length;
  const inProgress = videos.filter(video => statusFor(video) === 'In progress').length;
  const percent = videos.length ? Math.round(watched / videos.length * 100) : 0;
  $('#watchedCount').textContent = String(watched);
  $('#inProgressCount').textContent = String(inProgress);
  $('#watchedPercent').textContent = `${percent}%`;
  $('#profileLabel').textContent = profile.name || 'This device';
  $('#profileSummary').innerHTML = `<div class="profile-stat"><strong>${watched}</strong><span>watched</span></div><div class="profile-stat"><strong>${inProgress}</strong><span>in progress</span></div><div class="profile-stat"><strong>${Object.keys(profile.ratings).filter(id => ratingFor(id)).length}</strong><span>ratings saved</span></div>`;
}
function setNotice(message, isError = false) { $('#catalogNotice').innerHTML = isError ? `<strong>Playlist unavailable.</strong> ${escapeHTML(message)}` : message; }
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
  if (!videos.length) renderLibrary();
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
      videos = all.map(enrich);
      renderLibrary();
    } while (pageToken);
    videos = all.map(enrich);
    saveCatalog();
    setNotice(`<strong>Playlist synced.</strong> ${videos.length} verified videos loaded in official playlist order. Refresh again whenever the playlist changes.`);
  } catch (error) {
    setNotice(error.message || 'Unable to retrieve the official playlist.', true);
  } finally {
    loading = false;
    $('#refreshButton').disabled = false;
    $('#refreshButton').textContent = 'Refresh playlist';
    renderLibrary();
  }
}
function setRating(id, value) {
  profile.ratings[id] = ratingFor(id) === value ? 0 : value;
  saveProfile();
  renderLibrary();
}
function toggleFavorite(id) { profile.favorites[id] = !profile.favorites[id]; saveProfile(); renderLibrary(); }
function toggleWatched(id) {
  const old = progressFor(id);
  profile.progress[id] = {...old, completed: !old.completed, seconds: old.completed ? 0 : Math.max(old.duration || 1, old.seconds || 1), updatedAt: Date.now()};
  profile.lastVideoId = id;
  saveProfile();
  renderLibrary();
}
function getVideo(id) { return videos.find(video => video.id === id); }
function teardownPlayer() {
  recordPlayerProgress();
  if (playerTimer) window.clearInterval(playerTimer);
  playerTimer = null;
  try { youtubePlayer?.destroy(); } catch { /* player may already be gone */ }
  youtubePlayer = null;
  activeVideoId = '';
  $('#playerMount').innerHTML = '';
}
function recordPlayerProgress() {
  if (!youtubePlayer || !activeVideoId) return;
  try {
    const seconds = Math.floor(youtubePlayer.getCurrentTime() || 0);
    const duration = Math.floor(youtubePlayer.getDuration() || 0);
    if (!duration || !seconds) return;
    const old = progressFor(activeVideoId);
    profile.progress[activeVideoId] = {seconds, duration, completed: seconds / duration >= .93, updatedAt: Date.now()};
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
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => reject(new Error('The embedded YouTube player could not load.'));
    document.head.append(script);
  });
  return youtubeLoader;
}
function fallbackPlayer(video) {
  $('#playerMount').innerHTML = `<iframe title="${escapeHTML(video.title)}" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?rel=0&list=${PLAYLIST_ID}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  $('#playerProgressText').textContent = 'Embedded player loaded. Resume tracking needs the YouTube player API.';
}
async function openPlayer(id) {
  const video = getVideo(id);
  if (!video) return;
  if ($('#playerDialog').open) $('#playerDialog').close();
  activeVideoId = id;
  $('#playerTitle').textContent = video.title;
  $('#playerMount').innerHTML = '<div class="player-loading">Loading embedded player…</div>';
  $('#playerProgressBar').style.setProperty('--progress', `${percentFor(video)}%`);
  $('#playerProgressText').textContent = `${percentFor(video)}% of this video is saved on this device.`;
  $('#playerWatched').textContent = statusFor(video) === 'Watched' ? 'Unmark watched' : 'Mark watched';
  $('#nextButton').disabled = !videos.find(next => next.position === video.position + 1);
  $('#playerDialog').showModal();
  try {
    const YT = await loadYouTubeAPI();
    if (activeVideoId !== id || !$('#playerDialog').open) return;
    $('#playerMount').innerHTML = '<div id="youtubePlayer"></div>';
    youtubePlayer = new YT.Player('youtubePlayer', {
      videoId: id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {autoplay: 1, rel: 0, playsinline: 1, origin: location.origin},
      events: {
        onReady: event => {
          const saved = progressFor(id);
          if (saved.seconds > 4 && (!saved.duration || saved.seconds < saved.duration - 8)) event.target.seekTo(saved.seconds, true);
          event.target.playVideo();
          playerTimer = window.setInterval(recordPlayerProgress, 4000);
        },
        onStateChange: event => {
          if (event.data === YT.PlayerState.ENDED) {
            const duration = Math.floor(event.target.getDuration() || 0);
            profile.progress[id] = {seconds: duration, duration, completed: true, updatedAt: Date.now()};
            profile.lastVideoId = id;
            saveProfile();
            $('#playerWatched').textContent = 'Unmark watched';
            recordPlayerProgress();
          }
          if (event.data === YT.PlayerState.PAUSED) recordPlayerProgress();
        }
      }
    });
  } catch {
    fallbackPlayer(video);
  }
}
function openProfile() {
  $('#profileNameInput').value = profile.name || '';
  updateProfileUI();
  $('#profileDialog').showModal();
}
function exportProfile() {
  const payload = JSON.stringify({profile, exportedAt: new Date().toISOString(), playlistId: PLAYLIST_ID}, null, 2);
  const url = URL.createObjectURL(new Blob([payload], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'unstable-universe-device-profile.json';
  link.click();
  URL.revokeObjectURL(url);
}
function continueWatching() {
  const candidate = getVideo(profile.lastVideoId) || videos.find(video => statusFor(video) === 'In progress') || videos[0];
  if (candidate) openPlayer(candidate.id);
}
function clearFilters() { filters = {...filters, creator: 'All', collection: 'All', tag: 'All', search: ''}; $('#searchInput').value = ''; renderLibrary(); }

$('#filterGroups').addEventListener('click', event => {
  const button = event.target.closest('[data-filter-group]');
  if (!button) return;
  filters[button.dataset.filterGroup] = button.dataset.filterValue;
  renderLibrary();
});
$('#videoGrid').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.play) openPlayer(button.dataset.play);
  if (button.dataset.rate) setRating(button.dataset.id, Number(button.dataset.rate));
  if (button.dataset.favorite) toggleFavorite(button.dataset.favorite);
  if (button.dataset.watched) toggleWatched(button.dataset.watched);
});
$('#searchInput').addEventListener('input', event => { filters.search = event.target.value; renderLibrary(); });
$('#sortSelect').addEventListener('change', event => { filters.sort = event.target.value; renderLibrary(); });
$('#refreshButton').addEventListener('click', refreshPlaylist);
$('#continueButton').addEventListener('click', continueWatching);
$('#profileTrigger').addEventListener('click', openProfile);
$('#profileShortcut').addEventListener('click', openProfile);
$('#clearFilters').addEventListener('click', clearFilters);
$('#saveProfile').addEventListener('click', () => { profile.name = $('#profileNameInput').value.trim(); saveProfile(); updateProfileUI(); $('#profileDialog').close(); });
$('#exportProfile').addEventListener('click', exportProfile);
$('#resetProfile').addEventListener('click', () => { if (confirm('Reset your local profile, ratings, favorites, and saved watch progress on this device?')) { profile = defaultProfile(); localStorage.removeItem(PROFILE_KEY); updateProfileUI(); renderLibrary(); $('#profileDialog').close(); } });
$('#playerWatched').addEventListener('click', () => { if (activeVideoId) { toggleWatched(activeVideoId); const video = getVideo(activeVideoId); $('#playerWatched').textContent = statusFor(video) === 'Watched' ? 'Unmark watched' : 'Mark watched'; } });
$('#nextButton').addEventListener('click', () => { const current = getVideo(activeVideoId); const next = current && videos.find(video => video.position === current.position + 1); if (next) openPlayer(next.id); });
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.closeDialog}`).close()));
$('#playerDialog').addEventListener('close', () => { teardownPlayer(); renderLibrary(); });

videos = videos.map(enrich);
renderLibrary();
refreshPlaylist();
