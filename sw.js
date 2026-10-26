// Offline support: the page and its data are cached so the directory opens without a network.
// Map tiles and the map library come from other sites and are not cached here.
const CACHE = "mg-v13";
// Bump together with CACHE and the ?v= on upgrade.css / *.js in index.html.
const ASSET_VER = "13";
const SHELL = ["./", "index.html", "upgrade.css?v=" + ASSET_VER, "search-aliases.js?v=" + ASSET_VER, "guide-core.js?v=" + ASSET_VER, "upgrade.js?v=" + ASSET_VER, "prices.json", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable.png", "apple-touch-icon.png"];
self.addEventListener("install", e => {
  // cache:"reload" skips the browser HTTP cache, which can still hold the previous release for ~10 minutes
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("mg-") && k !== CACHE).map(async k => { const old=await caches.open(k); const current=await caches.open(CACHE); for(const req of await old.keys()){if(new URL(req.url).pathname.endsWith("/data.json") && !(await current.match(req)))await current.put(req,await old.match(req));} await caches.delete(k); }))).then(() => self.clients.claim()));
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
  // "no-cache" revalidates with the server instead of trusting a possibly stale HTTP-cache copy
  e.respondWith(fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
