/* Unstable Universe Experience service worker.
   App files are network-first (so deploys show up right away) with an offline
   fallback; images are cached; push messages carry no payload, so the worker
   asks the site what's new and shows that. */
const VERSION = 'uux-v5';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/library.js', '/profiles.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png', '/icons/favicon-32.png'];
const IMAGE_CACHE = `${VERSION}-images`;
const IMAGE_LIMIT = 400;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request, cacheName = VERSION) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, {ignoreSearch: request.mode === 'navigate'});
    if (cached) return cached;
    if (request.mode === 'navigate') return (await cache.match('/index.html')) || Response.error();
    return Response.error();
  }
}
async function trimImages() {
  const cache = await caches.open(IMAGE_CACHE);
  const keys = await cache.keys();
  for (let index = 0; index < keys.length - IMAGE_LIMIT; index += 1) await cache.delete(keys[index]);
}
async function imageCache(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(response => {
    if (response.ok || response.type === 'opaque') { cache.put(request, response.clone()); trimImages(); }
    return response;
  }).catch(() => cached);
  return cached || refresh;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === location.origin) {
    if (url.pathname === '/api/catalog') { event.respondWith(networkFirst(request, `${VERSION}-catalog`)); return; }
    if (url.pathname.startsWith('/api/')) return;
    event.respondWith(networkFirst(request));
    return;
  }
  if (request.destination === 'image' && /(^|\.)(mcasset\.cloud|ytimg\.com|nocookie\.net)$/.test(url.hostname)) event.respondWith(imageCache(request));
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let info = {title: 'New Unstable video!', body: 'A new video was added to the playlist.', url: '/', tag: 'new-upload'};
    try {
      const response = await fetch('/api/push/latest', {cache: 'no-store'});
      if (response.ok) info = {...info, ...(await response.json())};
    } catch { /* show the generic message */ }
    await self.registration.showNotification(info.title, {body: info.body, icon: info.icon || '/icons/icon-192.png', badge: '/icons/badge-96.png', image: info.image, tag: info.tag, data: {url: info.url || '/'}, renotify: true});
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const client of windows) {
      if (new URL(client.url).origin === location.origin) { await client.focus(); client.navigate?.(target); return; }
    }
    await self.clients.openWindow(target);
  })());
});
