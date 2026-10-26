// Offline support: the page and its data are cached so the directory opens without a network.
// Map tiles and the map library come from other sites and are not cached here.
const CACHE = "mg-v4";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable.png", "apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // data.json is versioned by query string: serve from cache once fetched
  if (url.pathname.endsWith("/data.json")) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        const old = await c.keys();
        await Promise.all(old.filter(k => new URL(k.url).pathname.endsWith("/data.json")).map(k => c.delete(k)));
        c.put(req, res.clone());
      }
      return res;
    }));
    return;
  }
  // everything else: network first, cache as fallback
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
});
