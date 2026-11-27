// Amed Cafe Rewards: always load the newest page when online (bypassing the browser cache);
// fall back to the last saved copy only when offline.
//
// Security: only the card page itself and its static files (images, icons, manifests, scripts, styles)
// are ever stored in Cache Storage. Customer data is never cached here: cards are read from Firestore
// (a different origin, which this worker does not touch), and JSON/data files are never stored.
// The cache name changed from v3 to v4 so that old caches, which could hold a copy of the retired
// data.json with customer records, are deleted on the next visit.
const CACHE = "amed-card-v4";
const STATIC = /\.(?:html|png|jpe?g|webp|svg|ico|css|js|webmanifest|woff2?)$/i;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
function cacheable(req, res) {
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.search) return false;            // no query strings: nothing user-specific
  if (!(url.pathname.endsWith("/") || STATIC.test(url.pathname))) return false; // page + static files only (never .json)
  if (/\/data\.json$/i.test(url.pathname)) return false;
  return res && res.ok && res.type === "basic" && !/no-store|private/i.test(res.headers.get("Cache-Control") || "");
}
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then((r) => { if (cacheable(e.request, r)) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: false }))
  );
});
