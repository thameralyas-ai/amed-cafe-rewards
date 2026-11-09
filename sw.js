// Retired: the loyalty card moved to /card/ (it has its own service worker there).
// Any old copy of this worker installed at the site root removes itself.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.delete("amed-v2").then(() => self.registration.unregister())
));
