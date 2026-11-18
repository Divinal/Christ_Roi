// Service worker : l'application s'ouvre même quand le nom du site ne se résout
// pas (DNS du Wi-Fi défaillant : « Ce site est inaccessible », DNS_PROBE_FINISHED_NXDOMAIN).
//
// - Pages : réseau d'abord (toujours la dernière version) ; la copie gardée ne sert
//   que si le réseau échoue.
// - Fichiers /assets/ : leur nom contient une empreinte, ils ne changent jamais ;
//   la copie gardée suffit.
// - Rien d'autre que le site lui-même : les données (Supabase) ne sont jamais gardées.

const CACHE = 'rezo-edu-v1';
const SHELL = '/index.html';
const MAX_ASSETS = 150;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Garde les versions récentes des fichiers versionnés, oublie les plus anciennes.
const trimAssets = async (cache) => {
  const keys = (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith('/assets/'));
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((request) => cache.delete(request)));
};

const remember = async (key, response) => {
  const cache = await caches.open(CACHE);
  await cache.put(key, response);
  await trimAssets(cache);
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) event.waitUntil(remember(SHELL, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(SHELL)) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) event.waitUntil(remember(request, response.clone()));
        return response;
      })),
    );
    return;
  }

  // Autres fichiers du site (logo, images) : réseau, copie gardée en secours.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) event.waitUntil(remember(request, response.clone()));
        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error()),
  );
});
