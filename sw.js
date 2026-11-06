/* Ében-Ézer — hors-ligne, mais jamais figé.
   La page : le réseau d'abord, le cache en secours (pour recevoir les corrections).
   Le reste (composants, icônes, police) : le cache d'abord. */
const CACHE = "ebenezer-v3";
const SOCLE = ["./", "./index.html", "./manifest.webmanifest",
               "./vendor/framework7-bundle.min.css",
               "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SOCLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const page = r.mode === "navigate" || (r.headers.get("accept") || "").indexOf("text/html") !== -1;

  if (page) {
    e.respondWith(
      fetch(r)
        .then(res => {
          const copie = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copie));
          return res;
        })
        .catch(() => caches.match("./index.html").then(m => m || caches.match("./")))
    );
    return;
  }

  e.respondWith(
    caches.match(r).then(m => m || fetch(r).then(res => {
      if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
        const copie = res.clone();
        caches.open(CACHE).then(c => c.put(r, copie));
      }
      return res;
    }))
  );
});
