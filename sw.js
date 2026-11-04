// Service worker: red primero (siempre lo más reciente si hay conexión) y caché como respaldo sin conexión.
// Al instalarse guarda el shell y todo el contenido (unidades y simulacros) para estudiar offline.
const PREFIX = 'dian2676rc-';
const VERSION = PREFIX + 'v1';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'content/manifest.json', 'content/resources.json', 'content/tests/index.json'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    try {
      const manifest = await (await fetch('content/manifest.json')).json();
      const tests = await (await fetch('content/tests/index.json')).json();
      const files = [
        ...manifest.units.filter((u) => !u.pending).map((u) => `content/${u.file}`),
        ...tests.tests.map((t) => `content/tests/${t.id}.json`),
      ];
      await cache.addAll(files);
    } catch { /* el contenido se cacheará al usarse */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== VERSION) await caches.delete(k); // no tocar cachés de otros sitios del mismo dominio
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
