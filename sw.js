/* Ében-Ézer — hors-ligne, mais jamais figé.
   La page : le réseau d'abord, le cache en secours (pour recevoir les corrections).
   Le reste (composants, icônes, police) : le cache d'abord. */
const CACHE = "ebenezer-v100";
/* L'application est en treize fichiers chargés dans l'ordre (voir
   ARCHITECTURE.md). Hors ligne, il les faut TOUS : il n'y a pas d'application
   avec douze sur treize. Le cache porte le numéro de version, et « activate »
   efface les autres — une mise à jour ne peut donc pas servir un mélange
   d'ancien et de neuf. */
const APP = ["01-socle", "02-dates", "03-temps", "04-medias", "05-acces",
             "06-charpente", "07-ecrans-actes", "08-sync", "09-ecrans-temps",
             "10-ecrans-reste", "12-sondes",
             "13-gestes"].map(n => "./src/" + n + ".js");
const SOCLE = ["./", "./index.html", "./manifest.webmanifest",
               "./src/ebenezer.css"].concat(APP).concat([
               "./vendor/framework7-bundle.min.css",
               "./vendor/lora-latin.woff2",
               "./vendor/lora-latin-ext.woff2",
               "./icon-180.png", "./icon-192.png", "./icon-512.png"]);

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SOCLE.map(u => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
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
  /* Rien de ce qui part vers un autre domaine ne passe par ici : une réponse
     de synchronisation mise en cache servirait une version périmée de
     l'archive, et le compte serait faux sans qu'on sache pourquoi. */
  try{ if (new URL(r.url).origin !== self.location.origin) return; }catch(x){ return; }
  const page = r.mode === "navigate" || (r.headers.get("accept") || "").indexOf("text/html") !== -1;

  if (page) {
    e.respondWith(
      fetch(r.url, { cache: "no-store", credentials: "same-origin" })
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
