const CACHE_NAME = 'growlens-shell-v3';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const SYNC_WAKE_TAG = 'growlens-sync-intent-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

function isPrivateApiRequest(requestUrl) {
  return requestUrl.pathname.includes('/api/');
}

function mayCache(request, response) {
  if (!response.ok || response.type !== 'basic') return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (/no-store|private/i.test(cacheControl)) return false;
  return ['document', 'script', 'style', 'image', 'font', 'manifest'].includes(request.destination);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (isPrivateApiRequest(requestUrl)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (mayCache(event.request, response)) {
          const clone = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }),
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_WAKE_TAG) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'growlens-sync-requested' });
      }
    }),
  );
});
