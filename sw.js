/* Ében-Ézer — hors-ligne, mais jamais figé.
   La page : le réseau d'abord, le cache en secours (pour recevoir les corrections).
   Le reste (composants, icônes, police) : le cache d'abord. */
const CACHE = "ebenezer-v134";
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
      /* VEILLE n'est pas une version de l'application : c'est ce que la page
         laisse ici pour qu'on puisse parler sans elle. L'effacer à chaque
         mise à jour rendrait le premier réveil d'après muet (13.ey). */
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== VEILLE).map(k => caches.delete(k))))
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

/* ---------- le réveil (13.ey) ----------
   Le serveur ne sait rien : il a reçu une adresse opaque et une heure, et à
   cette heure il tape sur l'épaule de l'appareil — un message SANS CONTENU.
   Tout ce qui se dit se dit ici, à partir du miroir que la page a laissé sur
   l'appareil. Le nom de l'activité n'a donc jamais voyagé (13.bh), et la
   notification peut pourtant le nommer.

   Ces deux noms sont les mêmes que dans src/08-sync.js, écrits deux fois :
   un service worker ne peut rien importer de src/. Les changer d'un côté
   sans l'autre rend le réveil muet. */
const VEILLE = "ebenezer-veille";
const MIROIR = "./veille.json";

/* Copie de `hm()` (src/03-temps.js), pour la même raison. Un test tient les
   deux côte à côte et casse à la première divergence — c'est à ce prix
   qu'une copie est permise ici. */
function hmSW(ms){
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60), h = Math.floor(m / 60), r = m % 60;
  if (!h) return m + " min";
  return r ? h + " h " + String(r).padStart(2, "0") : h + " h";
}

async function veilleLue() {
  try {
    const c = await caches.open(VEILLE);
    const r = await c.match(MIROIR);
    if (!r) return [];
    const v = await r.json();
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

/* Ce que le réveil dira, s'il dit quelque chose. Séparé de l'événement pour
   être tenu par un test : c'est la seule phrase de l'application qu'on ne
   peut pas aller lire à l'écran. */
function veilleDit(miroir, maintenant) {
  const d = (miroir || []).filter(x => x && typeof x.deb === "number" &&
                                       maintenant - x.deb > (x.seuil || 0));
  if (!d.length) return null;
  if (d.length === 1) {
    const x = d[0];
    return {
      titre: x.nom + " — " + hmSW(maintenant - x.deb),
      corps: (x.usuel ? "D'habitude, " + hmSW(x.usuel) + ". " : "") + "Est-ce que ça tourne encore ?"
    };
  }
  return {
    titre: d.length + " compteurs tournent depuis longtemps",
    corps: d.map(x => x.nom + " — " + hmSW(maintenant - x.deb)).join(" · ")
  };
}

/* L'heure posée au serveur peut avoir été dépassée par les faits : le
   compteur a été arrêté hors ligne, ou sur l'autre appareil. On se tait
   alors — mieux vaut un réveil muet qu'un réveil qui ment. */
self.addEventListener("push", e => {
  e.waitUntil((async () => {
    const t = veilleDit(await veilleLue(), Date.now());
    if (!t) return;
    await self.registration.showNotification(t.titre, {
      body: t.corps,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      /* Une seule notification à la fois : deux compteurs n'en font pas
         deux, et un réveil qui s'empile se range sans se lire. */
      tag: "veille",
      renotify: true
    });
  })());
});

/* Elle doit mener là où la question se répond. L'application déjà ouverte :
   on la ramène devant et on lui dit d'y aller ; fermée : on l'ouvre là. */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const ls = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of ls) {
      if ("focus" in c) {
        try { c.postMessage({ veille: 1 }); } catch (x) {}
        return c.focus();
      }
    }
    return self.clients.openWindow("./?v=pointer");
  })());
});
