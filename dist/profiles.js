'use strict';
/* ==========================================================================
   "Who's watching?" — Netflix-style profiles (loaded after app.js).

   Every profile on this device keeps its own progress, ratings, favorites and
   watch later list. Account profiles sync to the server; accounts signed in on
   this device open with one tap (the server remembers their sign-in in an
   HttpOnly cookie), others ask for the password. Device profiles never leave
   this browser.

   Storage: the active profile still lives in PROFILE_KEY / SYNC_KEY (so the rest
   of the app is unchanged); inactive profiles are parked under STASH_PREFIX + id.
   ========================================================================== */
const PROFILES_KEY = 'uux-profiles-v1';
const ACTIVE_PROFILE_KEY = 'uux-active-profile-v1';
const STASH_PREFIX = 'uux-profile-data-v1:';
const WHO_OFF_KEY = 'uux-who-off';
const WHO_SESSION_KEY = 'uux-who-picked';
const AVATAR_ITEMS = ['mace.png', 'netherite_sword.png', 'totem_of_undying.png', 'ender_pearl.png', 'golden_apple.png', 'spyglass.png', 'trident.png', 'elytra.png', 'nether_star.png', 'heart_of_the_sea.png', 'enchanted_book.png', 'goat_horn.png', 'trial_key.png', 'ender_eye.png', 'diamond.png', 'netherite_ingot.png', 'cake.png', 'cookie.png'];
const AVATAR_COLORS = ['#8b5cf6', '#ff5c8a', '#22c7a0', '#ffb347', '#3b9dff', '#ff6b3c', '#e5484d', '#64748b'];

// app.js's safeRead only returns objects; these settings are plain strings/booleans.
const readValue = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
let deviceProfiles = [];
let rememberedAccounts = null;
const who = {mode: 'pick', target: null, error: '', busy: false};

function loadDeviceProfiles() {
  const raw = safeRead(PROFILES_KEY, []);
  deviceProfiles = (Array.isArray(raw) ? raw : []).filter(entry => entry && typeof entry.id === 'string' && (entry.kind === 'account' || entry.kind === 'local')).slice(0, 12).map(entry => ({
    id: entry.id, kind: entry.kind, name: String(entry.name || 'Profile').slice(0, 24),
    avatar: AVATAR_ITEMS.includes(entry.avatar) ? entry.avatar : AVATAR_ITEMS[0], color: AVATAR_COLORS.includes(entry.color) ? entry.color : AVATAR_COLORS[0]
  }));
  if (!deviceProfiles.length) {
    // First visit since profiles arrived: whatever is on this device becomes the first profile.
    deviceProfiles = [syncMeta.username ? newProfileEntry('account', syncMeta.username) : newProfileEntry('local', profile.name || 'Me')];
    safeWrite(ACTIVE_PROFILE_KEY, deviceProfiles[0].id);
    saveDeviceProfiles();
  }
  if (!deviceProfiles.some(entry => entry.id === activeProfileId())) safeWrite(ACTIVE_PROFILE_KEY, deviceProfiles[0].id);
}
function saveDeviceProfiles() { safeWrite(PROFILES_KEY, deviceProfiles); }
function activeProfileId() { return String(readValue(ACTIVE_PROFILE_KEY, '') || ''); }
function activeProfile() { return deviceProfiles.find(entry => entry.id === activeProfileId()) || null; }
function newProfileEntry(kind, name) {
  const used = new Set(deviceProfiles.map(entry => entry.color));
  const color = AVATAR_COLORS.find(value => !used.has(value)) || AVATAR_COLORS[deviceProfiles.length % AVATAR_COLORS.length];
  const seed = [...String(name)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {id: kind === 'account' ? `acct:${name.toLowerCase()}` : `local:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind, name: String(name).slice(0, 24), avatar: AVATAR_ITEMS[seed % AVATAR_ITEMS.length], color};
}
function stashActive() {
  const id = activeProfileId();
  if (id) safeWrite(STASH_PREFIX + id, {profile, syncMeta});
}
function readStash(id) {
  const saved = safeRead(STASH_PREFIX + id, null);
  return saved && typeof saved === 'object' ? saved : {};
}
async function loadRemembered() {
  try {
    const result = await accountRequest('/remembered');
    rememberedAccounts = result.ok ? result.data.accounts.map(name => name.toLowerCase()) : [];
  } catch { rememberedAccounts = []; }
  return rememberedAccounts;
}
function needsPassword(entry) {
  if (entry.kind !== 'account') return false;
  if (account.user && account.user.toLowerCase() === entry.name.toLowerCase()) return false;
  return !(rememberedAccounts || []).includes(entry.name.toLowerCase());
}

// Move this device from the active profile to `target`. Nothing changes unless it works.
async function switchProfile(target, password = '') {
  const current = activeProfile();
  const sameAccount = target.kind === 'account' && account.user && account.user.toLowerCase() === target.name.toLowerCase();
  if (current?.id === target.id && (target.kind === 'local' ? !account.user : sameAccount)) return {ok: true};
  if (account.user && syncMeta.dirty) { clearTimeout(syncTimer); await pushProfile(); }
  let payload = null;
  if (target.kind === 'account' && !sameAccount) {
    const result = password
      ? await accountRequest('/login', 'POST', {username: target.name, password})
      : await accountRequest('/switch', 'POST', {username: target.name});
    if (!result.ok) return {ok: false, needPassword: Boolean(result.data.needPassword) || (!password && result.status === 401), error: result.data.error || 'Could not open that profile.'};
    payload = result.data;
  }
  if (target.kind === 'local' && account.user) {
    const result = await accountRequest('/switch', 'POST', {username: ''}).catch(() => null);
    if (!result?.ok) return {ok: false, error: 'Could not switch right now. Check your connection.'};
  }
  stashActive();
  const saved = readStash(target.id);
  if (target.kind === 'account') {
    account.user = payload ? payload.user.username : account.user;
    const lower = account.user.toLowerCase();
    const savedMeta = saved.syncMeta && String(saved.syncMeta.username || '').toLowerCase() === lower ? saved.syncMeta : null;
    let next = normalizeProfile(saved.profile || defaultProfile());
    syncMeta = {username: account.user, syncedAt: Number(savedMeta?.syncedAt) || 0, dirty: Boolean(savedMeta?.dirty)};
    if (payload) {
      const serverTime = Number(payload.updatedAt) || 0;
      if (payload.profile) {
        // no copy here yet, or nothing changed here since the last sync: the server's copy wins
        if (!saved.profile || (!syncMeta.dirty && serverTime >= syncMeta.syncedAt)) next = payload.profile;
        else { next = mergeProfiles(next, payload.profile); syncMeta.dirty = true; }
        syncMeta.syncedAt = serverTime;
      } else syncMeta.dirty = true;
    }
    adoptProfile(next);
    target.name = account.user;
    account.status = 'synced';
    account.lastSync = Date.now();
    account.error = '';
  } else {
    account.user = '';
    account.status = 'idle';
    account.error = '';
    syncMeta = {username: '', syncedAt: 0, dirty: false};
    adoptProfile(saved.profile || defaultProfile());
  }
  saveSyncMeta();
  safeWrite(ACTIVE_PROFILE_KEY, target.id);
  saveDeviceProfiles();
  isAdmin = false;
  $('#adminTrigger').hidden = true;
  if (account.user) { checkAdmin(); if (syncMeta.dirty) pushProfile(); }
  renderAccount();
  renderLibrary();
  if (typeof renderRecap === 'function') renderRecap();
  if (typeof libraryAdminCheck === 'function' && currentView === 'library') libraryAdminCheck();
  return {ok: true};
}

// Hooks used by the profile dialog's own sign in / sign out / delete.
function profilesAfterSignIn(username) {
  const id = `acct:${username.toLowerCase()}`;
  const active = activeProfile();
  const existing = deviceProfiles.find(entry => entry.id === id);
  if (active && active.kind === 'local' && !existing) {
    // the device profile was merged into the account, so it becomes that account
    Object.assign(active, {id, kind: 'account', name: username});
  } else if (!existing) deviceProfiles.push(newProfileEntry('account', username));
  else existing.name = username;
  deviceProfiles = deviceProfiles.filter((entry, index, list) => list.findIndex(other => other.id === entry.id) === index);
  safeWrite(ACTIVE_PROFILE_KEY, id);
  saveDeviceProfiles();
  rememberedAccounts = [...new Set([...(rememberedAccounts || []), username.toLowerCase()])];
}
async function profilesAfterSignOut({deleted = false} = {}) {
  const active = activeProfile();
  if (active?.kind === 'account') {
    if (deleted) { deviceProfiles = deviceProfiles.filter(entry => entry !== active); try { localStorage.removeItem(STASH_PREFIX + active.id); } catch { /* ignore */ } }
    else stashActive();
    rememberedAccounts = (rememberedAccounts || []).filter(name => name !== active.name.toLowerCase());
  }
  let local = deviceProfiles.find(entry => entry.kind === 'local');
  if (!local) { local = newProfileEntry('local', 'Guest'); deviceProfiles.push(local); }
  const saved = readStash(local.id);
  adoptProfile(saved.profile || defaultProfile());
  safeWrite(ACTIVE_PROFILE_KEY, local.id);
  saveDeviceProfiles();
  openWho();
}

/* ---------- the screen ---------- */
function avatarHTML(entry, size = '') {
  return `<span class="who-av ${size}" style="--c:${entry.color}"><img src="${ITEM_ROOT}${entry.avatar}" alt=""></span>`;
}
function renderWho() {
  const box = $('#whoBody');
  if (!box) return;
  // keep what was typed when the same form re-renders (busy state, errors); passwords clear after an error
  const typed = {};
  if (who.lastMode === who.mode && who.lastKind === who.addKind) box.querySelectorAll('input[name]').forEach(input => { if (!(who.error && input.type === 'password')) typed[input.name] = input.value; });
  who.lastMode = who.mode;
  who.lastKind = who.addKind;
  requestAnimationFrame(() => { for (const [name, value] of Object.entries(typed)) { const input = box.querySelector(`input[name="${name}"]`); if (input && !input.value) input.value = value; } });
  const active = activeProfileId();
  $('#whoTitle').textContent = who.mode === 'manage' ? 'Manage profiles' : who.mode === 'add' ? 'Add a profile' : who.mode === 'edit' ? 'Edit profile' : who.mode === 'password' ? `Welcome back, ${who.target.name}` : "Who's watching?";
  $('#whoManage').hidden = !['pick', 'manage'].includes(who.mode);
  $('#whoManage').textContent = who.mode === 'manage' ? 'Done' : 'Manage profiles';
  const error = who.error ? `<p class="who-error" role="alert">${escapeHTML(who.error)}</p>` : '';
  if (who.mode === 'pick' || who.mode === 'manage') {
    box.innerHTML = `<div class="who-grid ${who.mode}">${deviceProfiles.map((entry, index) => `
      <button type="button" class="who-tile" data-who="${escapeHTML(entry.id)}" style="--i:${index}">
        ${avatarHTML(entry)}
        ${who.mode === 'manage' ? '<span class="who-edit" aria-hidden="true">✎</span>' : ''}
        <span class="who-name">${escapeHTML(entry.name)}</span>
        <span class="who-tag">${entry.kind === 'local' ? 'This device only' : needsPassword(entry) ? '🔒 Account' : 'Account'}${entry.id === active ? ' · last used' : ''}</span>
      </button>`).join('')}
      ${deviceProfiles.length < 12 ? `<button type="button" class="who-tile add" data-who-add style="--i:${deviceProfiles.length}"><span class="who-av add"><b>+</b></span><span class="who-name">Add profile</span><span class="who-tag">&nbsp;</span></button>` : ''}
    </div>${error}`;
    return;
  }
  if (who.mode === 'password') {
    box.innerHTML = `<form class="who-form" id="whoPassword">${avatarHTML(who.target, 'big')}
      <p>This profile is an account. Enter its password once and this device will remember it.</p>
      <input name="password" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" required minlength="8" maxlength="200">
      ${error}
      <div class="who-actions"><button type="button" class="quiet-action" data-who-back>Back</button><button class="primary-action" type="submit" ${who.busy ? 'disabled' : ''}>${who.busy ? 'Opening…' : 'Open profile'}</button></div></form>`;
    setTimeout(() => box.querySelector('input')?.focus(), 50);
    return;
  }
  if (who.mode === 'add') {
    const kind = who.addKind || 'local';
    box.innerHTML = `<form class="who-form" id="whoAdd">
      <div class="who-choice" role="tablist">
        <button type="button" role="tab" aria-selected="${kind === 'local'}" data-add-kind="local"><b>Just this device</b><small>No account. Stays in this browser.</small></button>
        <button type="button" role="tab" aria-selected="${kind === 'signin'}" data-add-kind="signin"><b>Sign in</b><small>An account you already have.</small></button>
        <button type="button" role="tab" aria-selected="${kind === 'register'}" data-add-kind="register"><b>New account</b><small>Syncs to your other devices.</small></button>
      </div>
      ${kind === 'local'
        ? '<input name="name" maxlength="24" placeholder="Profile name" aria-label="Profile name" required>'
        : `<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="Username" aria-label="Username" required>
           <input name="password" type="password" autocomplete="${kind === 'register' ? 'new-password' : 'current-password'}" minlength="8" maxlength="200" placeholder="${kind === 'register' ? 'Password (at least 8 characters)' : 'Password'}" aria-label="Password" required>
           ${kind === 'register' ? '<input name="confirm" type="password" autocomplete="new-password" placeholder="Type the password again" aria-label="Confirm password" required>' : ''}`}
      ${error}
      <p class="who-note">${kind === 'register' ? 'There is no email, so keep your password safe: it cannot be reset.' : kind === 'signin' ? 'Its progress, ratings and lists come with it.' : 'Starts fresh. You can turn it into an account later in Profile.'}</p>
      <div class="who-actions"><button type="button" class="quiet-action" data-who-back>Back</button><button class="primary-action" type="submit" ${who.busy ? 'disabled' : ''}>${who.busy ? 'One moment…' : kind === 'local' ? 'Add profile' : kind === 'register' ? 'Create account' : 'Sign in'}</button></div></form>`;
    setTimeout(() => box.querySelector('input')?.focus(), 50);
    return;
  }
  if (who.mode === 'edit') {
    const entry = who.target;
    box.innerHTML = `<form class="who-form edit" id="whoEdit">${avatarHTML(entry, 'big')}
      ${entry.kind === 'local' ? `<input name="name" maxlength="24" value="${escapeHTML(entry.name)}" aria-label="Profile name" required>` : `<p><b>${escapeHTML(entry.name)}</b> · account</p>`}
      <p class="who-label">Icon</p><div class="who-icons">${AVATAR_ITEMS.map(file => `<button type="button" data-avatar="${file}" class="${entry.avatar === file ? 'on' : ''}" aria-label="${file.replace('.png', '').replace(/_/g, ' ')}"><img src="${ITEM_ROOT}${file}" alt=""></button>`).join('')}</div>
      <p class="who-label">Color</p><div class="who-colors">${AVATAR_COLORS.map(color => `<button type="button" data-color="${color}" class="${entry.color === color ? 'on' : ''}" style="--c:${color}" aria-label="Color ${color}"></button>`).join('')}</div>
      ${error}
      <div class="who-actions">${entry.id !== activeProfileId() ? '<button type="button" class="danger-action" data-who-remove>Remove from this device</button>' : ''}<button class="primary-action" type="submit">Save</button></div></form>`;
  }
}
function openWho() {
  const layer = $('#who');
  if (!layer) return;
  loadDeviceProfiles();
  who.mode = 'pick';
  who.error = '';
  who.busy = false;
  $('#whoAsk').checked = readValue(WHO_OFF_KEY, false) !== true;
  document.documentElement.classList.add('who-open');
  layer.hidden = false;
  layer.classList.remove('leaving');
  renderWho();
  loadRemembered().then(() => { if (who.mode === 'pick' || who.mode === 'manage') renderWho(); });
  setTimeout(() => layer.querySelector('.who-tile')?.focus({preventScroll: true}), 80);
}
function closeWho(tile) {
  const layer = $('#who');
  try { sessionStorage.setItem(WHO_SESSION_KEY, '1'); } catch { /* ignore */ }
  if (tile && canAnimate() && !reducedMotion.matches) {
    tile.classList.add('chosen');
    layer.classList.add('leaving');
    setTimeout(() => { layer.hidden = true; document.documentElement.classList.remove('who-open', 'who-pending'); }, 650);
  } else {
    layer.hidden = true;
    document.documentElement.classList.remove('who-open', 'who-pending');
  }
}
async function pickProfile(entry, tile) {
  if (who.busy) return;
  if (needsPassword(entry) && !(account.user && account.user.toLowerCase() === entry.name.toLowerCase())) {
    if (rememberedAccounts === null) await loadRemembered();
    if (needsPassword(entry)) { who.mode = 'password'; who.target = entry; who.error = ''; renderWho(); return; }
  }
  who.busy = true;
  tile?.classList.add('loading');
  const result = await switchProfile(entry).catch(() => ({ok: false, error: 'Could not reach the server.'}));
  who.busy = false;
  if (result.ok) { closeWho(tile); toast(`Welcome back, ${entry.name}!`); return; }
  if (result.needPassword) { who.mode = 'password'; who.target = entry; who.error = ''; renderWho(); return; }
  who.error = result.error;
  renderWho();
}

/* ---------- events ---------- */
function setupWho() {
  const layer = $('#who');
  if (!layer) return;
  layer.addEventListener('click', async event => {
    const tile = event.target.closest('[data-who]');
    if (tile) {
      const entry = deviceProfiles.find(item => item.id === tile.dataset.who);
      if (!entry) return;
      if (who.mode === 'manage') { who.mode = 'edit'; who.target = {...entry}; who.error = ''; renderWho(); return; }
      pickProfile(entry, tile);
      return;
    }
    if (event.target.closest('[data-who-add]')) { who.mode = 'add'; who.addKind = 'local'; who.error = ''; renderWho(); return; }
    if (event.target.closest('[data-who-back]')) { who.mode = 'pick'; who.error = ''; renderWho(); return; }
    if (event.target.closest('#whoManage')) { who.mode = who.mode === 'manage' ? 'pick' : 'manage'; who.error = ''; renderWho(); return; }
    const kind = event.target.closest('[data-add-kind]');
    if (kind) { who.addKind = kind.dataset.addKind; who.error = ''; renderWho(); return; }
    const avatar = event.target.closest('[data-avatar]');
    if (avatar) { who.target.avatar = avatar.dataset.avatar; renderWho(); return; }
    const color = event.target.closest('[data-color]');
    if (color) { who.target.color = color.dataset.color; renderWho(); return; }
    if (event.target.closest('[data-who-remove]')) {
      const entry = who.target;
      if (!confirm(`Remove “${entry.name}” from this device?${entry.kind === 'local' ? ' Its progress on this device is deleted.' : ' The account itself is kept; you can sign in again any time.'}`)) return;
      if (entry.kind === 'account') await accountRequest('/forget', 'POST', {username: entry.name}).catch(() => null);
      deviceProfiles = deviceProfiles.filter(item => item.id !== entry.id);
      try { localStorage.removeItem(STASH_PREFIX + entry.id); } catch { /* ignore */ }
      saveDeviceProfiles();
      await loadRemembered();
      who.mode = 'manage';
      renderWho();
    }
  });
  layer.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    if (form.id === 'whoEdit') {
      const entry = deviceProfiles.find(item => item.id === who.target.id);
      if (entry) Object.assign(entry, {avatar: who.target.avatar, color: who.target.color, ...(entry.kind === 'local' ? {name: form.elements.name.value.trim().slice(0, 24) || entry.name} : {})});
      saveDeviceProfiles();
      who.mode = 'manage';
      renderWho();
      return;
    }
    if (form.id === 'whoPassword') {
      who.busy = true;
      renderWho();
      const result = await switchProfile(who.target, form.elements?.password?.value || event.target.querySelector('input')?.value || '').catch(() => ({ok: false, error: 'Could not reach the server.'}));
      who.busy = false;
      if (result.ok) { await loadRemembered(); closeWho(); toast(`Welcome back, ${who.target.name}!`); return; }
      who.error = result.error;
      renderWho();
      return;
    }
    if (form.id === 'whoAdd') {
      const kind = who.addKind || 'local';
      if (kind === 'local') {
        const entry = newProfileEntry('local', form.elements.name.value.trim() || 'Profile');
        deviceProfiles.push(entry);
        saveDeviceProfiles();
        const result = await switchProfile(entry);
        if (result.ok) { closeWho(); toast(`Hi, ${entry.name}! This profile starts fresh.`); } else { deviceProfiles = deviceProfiles.filter(item => item !== entry); saveDeviceProfiles(); who.error = result.error; renderWho(); }
        return;
      }
      const username = form.elements.username.value.trim();
      const password = form.elements.password.value;
      if (kind === 'register' && password !== form.elements.confirm.value) { who.error = 'The two passwords do not match.'; renderWho(); return; }
      if (deviceProfiles.some(item => item.id === `acct:${username.toLowerCase()}`)) { who.error = 'That account is already on this device. Pick it from the list.'; renderWho(); return; }
      who.busy = true;
      renderWho();
      let result;
      if (kind === 'register') {
        // create it first, then open it like any other profile (starting fresh)
        if (account.user && syncMeta.dirty) { clearTimeout(syncTimer); await pushProfile(); }
        const created = await accountRequest('/register', 'POST', {username, password}).catch(() => ({ok: false, data: {error: 'Could not reach the server.'}}));
        if (!created.ok) { who.busy = false; who.error = created.data.error || 'Could not create the account.'; renderWho(); return; }
        // the new session is already active and remembered
        const entry = newProfileEntry('account', created.data.user.username);
        deviceProfiles.push(entry);
        await accountRequest('/switch', 'POST', {username: ''}).catch(() => null);
        await loadRemembered();
        result = await switchProfile(entry);
        if (result.ok) checkAchievements();
      } else {
        const entry = newProfileEntry('account', username);
        deviceProfiles.push(entry);
        result = await switchProfile(entry, password).catch(() => ({ok: false, error: 'Could not reach the server.'}));
        if (!result.ok) deviceProfiles = deviceProfiles.filter(item => item !== entry);
      }
      who.busy = false;
      saveDeviceProfiles();
      if (result.ok) { await loadRemembered(); closeWho(); toast(kind === 'register' ? `Account created. Welcome, ${account.user}!` : `Signed in as ${account.user}`); return; }
      who.error = result.error;
      renderWho();
    }
  });
  layer.addEventListener('keydown', event => {
    if (event.key === 'Escape' && who.mode !== 'pick') { who.mode = 'pick'; who.error = ''; renderWho(); event.preventDefault(); }
  });
  $('#whoAsk').addEventListener('change', event => safeWrite(WHO_OFF_KEY, !event.target.checked));
  document.querySelectorAll('[data-switch-profile]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    openWho();
  }));
}

loadDeviceProfiles();
setupWho();
renderLibrary();
if (document.documentElement.classList.contains('who-pending')) openWho();
