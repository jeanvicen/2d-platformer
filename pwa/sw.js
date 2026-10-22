/* Versioned offline support for the exported Godot web build. */
const CACHE_NAME = '2d-platformer-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const GAME_ASSET_EXTENSIONS = /\.(?:js|wasm|pck|png|jpg|jpeg|webp|svg|ogg|mp3|wav|json|css|woff2?)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('2d-platformer-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isNavigation = request.mode === 'navigate';
  if (!isNavigation && !GAME_ASSET_EXTENSIONS.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isNavigation) {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') await cache.put('/', response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match('/')) || Response.error();
      }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
