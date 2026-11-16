/* Le harnais : il charge la vraie application.
 *
 * Pas de build, pas de dépendance — c'est la règle de ce dépôt, et elle vaut
 * aussi pour les tests. On extrait le gros bloc <script> de index.html, on lui
 * donne un navigateur de carton, et on l'exécute dans un bac à sable.
 *
 * Il n'y a donc jamais de copie du code à tenir à jour : ce qui est testé est
 * exactement ce qui est livré. Si une fonction est renommée, le test casse —
 * c'est voulu.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RACINE = path.join(__dirname, "..");
const PAGE = path.join(RACINE, "index.html");

/* ---------- le navigateur de carton ---------- */

function elem() {
  const o = {
    tagName: "DIV", id: "", className: "", innerHTML: "", outerHTML: "",
    textContent: "", value: "", hidden: false, disabled: false, checked: false,
    dataset: {}, children: [], childNodes: [], files: [],
    style: {
      setProperty() {}, removeProperty() {}, getPropertyValue() { return ""; }
    },
    offsetHeight: 0, offsetWidth: 0, scrollTop: 0, scrollHeight: 0,
    clientHeight: 0, clientWidth: 0, selectionStart: 0, selectionEnd: 0,
    classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; }
    },
    appendChild(x) { return x; }, removeChild(x) { return x; }, remove() {},
    insertBefore(x) { return x; }, insertAdjacentHTML() {}, cloneNode() { return elem(); },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    hasAttribute() { return false; },
    focus() {}, blur() {}, click() {}, select() {}, scrollIntoView() {},
    scrollTo() {}, animate() { return { cancel() {}, finished: Promise.resolve() }; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() {
      return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
    }
  };
  /* Tout nom de méthode qu'on n'a pas prévu rend une fonction inoffensive :
     le harnais ne doit pas tomber parce que l'app a appelé un geste de plus.
     Les propriétés, elles, restent indéfinies comme dans un vrai navigateur. */
  const PARENTE = ["firstElementChild", "lastElementChild", "parentElement",
                  "parentNode", "nextElementSibling", "previousElementSibling"];
  return new Proxy(o, {
    get(cible, cle) {
      if (cle in cible) return cible[cle];
      if (typeof cle !== "string") return undefined;
      /* Un voisin dans l'arbre : on le fabrique une fois, paresseusement,
         sinon un élément qui se crée des parents à l'infini. */
      if (PARENTE.indexOf(cle) !== -1) { cible[cle] = elem(); return cible[cle]; }
      if (/^(on|[a-z]+[A-Z])/.test(cle)) return function () {};
      return undefined;
    }
  });
}

function faitContexte(opts) {
  const sto = new Map();
  const elements = Object.create(null);
  const posees = (opts && opts.stockage) || {};
  Object.keys(posees).forEach(function (k) { sto.set(k, posees[k]); });

  const localStorage = {
    getItem(k) { return sto.has(k) ? sto.get(k) : null; },
    setItem(k, v) { sto.set(k, String(v)); },
    removeItem(k) { sto.delete(k); },
    clear() { sto.clear(); },
    key(i) { return Array.from(sto.keys())[i] || null; },
    get length() { return sto.size; }
  };

  /* Les gestes de l'application passent par un seul écouteur posé sur le
     document. On le retient, pour que les tests puissent toucher une ligne
     comme le ferait un doigt — et non réécrire sa logique à côté. */
  const ecouteurs = {};
  const document = {
    hidden: false, title: "", cookie: "", readyState: "complete",
    body: elem(), head: elem(), documentElement: elem(), activeElement: null,
    getElementById(id) {
      /* Un élément porte son identifiant : les écouteurs de `change` et
         d'`input` ne reconnaissent leur champ qu'à ça. */
      if (!elements[id]) { elements[id] = elem(); elements[id].id = id; }
      return elements[id];
    },
    createElement() { return elem(); },
    createTextNode() { return elem(); },
    createDocumentFragment() { return elem(); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) { (ecouteurs[type] = ecouteurs[type] || []).push(fn); },
    removeEventListener() {},
    execCommand() { return false; }
  };

  class FauxEvent {
    constructor(type, init) { this.type = type; Object.assign(this, init || {}); }
    preventDefault() {} stopPropagation() {}
  }
  class FauxFileReader {
    readAsText() {} readAsDataURL() {} readAsArrayBuffer() {} abort() {}
  }

  const ctx = {
    document, localStorage, sessionStorage: localStorage,
    navigator: {
      onLine: true, language: "fr-FR", userAgent: "harnais",
      storage: {}, clipboard: {}, mediaDevices: {}
    },
    screen: { width: 375, height: 812, orientation: {} },
    location: { href: "http://localhost/", hash: "", reload() {}, assign() {} },
    history: { pushState() {}, replaceState() {}, back() {} },
    console,
    Event: FauxEvent, CustomEvent: FauxEvent, FileReader: FauxFileReader,
    Blob: class { constructor(p) { this.parts = p; } },
    URL: { createObjectURL() { return "blob:x"; }, revokeObjectURL() {} },
    crypto: require("crypto").webcrypto,
    TextEncoder, TextDecoder, btoa, atob, performance, Intl,
    fetch() { return Promise.reject(new Error("pas de réseau dans les tests")); },
    setTimeout() { return 0; }, clearTimeout() {},
    setInterval() { return 0; }, clearInterval() {},
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    addEventListener() {}, removeEventListener() {},
    alert() {}, confirm() { return false; }, prompt() { return null; },
    getComputedStyle() { return { getPropertyValue() { return ""; } }; }
  };
  ctx.__ecouteurs = ecouteurs;
  /* Les messages passagers se ramassent : plusieurs règles portent sur ce
     que l'application DIT quand elle refuse, et pas seulement sur ce
     qu'elle garde. */
  ctx.__toasts = [];
  const poseFils = document.body.appendChild;
  document.body.appendChild = function (x) {
    if (x && x.className === "toast") ctx.__toasts.push(String(x.textContent));
    return poseFils.call(document.body, x);
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  return ctx;
}

/* ---------- le temps, tenu immobile ----------
 * Une fenêtre, un cumul, « hier » : tout cela se lit contre l'heure qu'il est.
 * Un test qui dépend de l'heure réelle passe le matin et casse à minuit. On
 * fige donc l'horloge du bac à sable, et chaque test dit à quelle heure il se
 * place. */
function poseHorloge(ctx, fixe) {
  const Vrai = Date;
  class D extends Vrai {
    constructor(...a) {
      if (a.length === 0) super(D.now());
      else super(...a);
    }
    static now() { return fixe.ms === null ? Vrai.now() : fixe.ms; }
    static parse(...a) { return Vrai.parse(...a); }
    static UTC(...a) { return Vrai.UTC(...a); }
  }
  ctx.Date = D;
}

/* ---------- le chargement ---------- */

/* L'application est en onze fichiers, chargés dans l'ordre par index.html.
 * Le harnais les lit EXACTEMENT comme le navigateur : même suite, même portée.
 * L'ordre n'est pas déduit d'un tri de noms mais relu dans index.html — sinon
 * le harnais testerait un empilement que le navigateur ne fait pas. */
function fichiersApp() {
  const html = fs.readFileSync(PAGE, "utf8");
  const ordre = [];
  const re = /<script src="(src\/[^"]+\.js)"><\/script>/g;
  let m;
  while ((m = re.exec(html))) ordre.push(m[1]);
  if (!ordre.length) throw new Error("index.html ne charge aucun fichier de src/");
  return ordre;
}

function sourceApp() {
  const racine = path.dirname(PAGE);
  const suite = fichiersApp().map(function (f) {
    return "//#region " + f + "\n" + fs.readFileSync(path.join(racine, f), "utf8");
  });
  const tout = suite.join("\n");
  if (tout.length < 50000) {
    throw new Error("les fichiers de src/ font " + tout.length +
      " caractères — l'application est plus grosse que ça, la lecture a raté");
  }
  return tout;
}

/* Les déclarations `let` et `const` du script ne deviennent pas des
 * propriétés du bac à sable : on ajoute donc, à la fin du source, une ligne
 * qui tend la main. Elle vit dans la même portée et voit tout. */
const PONT = `
;globalThis.__eben = {
  get db(){ return db; }, set db(v){ db = v; },
  get S(){ return S; },
  get SY(){ return SY; },
  get Z(){ return Z; },
  get SO(){ return SO; },
  get SONDE(){ return SONDE; },
  actions: actions,
  f: { hm, hmin, dtl, valHeure, cumul, couvert, fusionTemps, fusionne, fusionListe,
       bornes, decale, fenetre, nomFen, courtFen, memeAn,
       finDe, voisins, touche, tue, sane, uid, cap, capNom,
       tache, tacheId, tacheNom, tacheCat, blocT, ouverts, fermeBloc,
       dureesDe, usuelDe, seuilDe, derape, derapes,
       reveilQuand, veilleMiroir, reveilPossible, reveilPret, reveilOn,
       reveilOctets, reveilMiroir, reveilRange, reveilPose, reveilCoupe,
       reveilPlusTard, reveilOffre, sySave, syLoad,
       pointe, arrete, poseTache, creuxVif, load, seanceDe, suitDe, portesSeance, sujetBlocs, ouvert, majChrono,
       verifArchive, verifCompte, verifDit, vVerif, rappelVerif,
       archivePartante, sondesPartantes, sondesPoids,
       epingles, raccourciSous, raccourciArret,
       disc, discNom, discDeNom, discTache, parDisc, mesureDisc, mesureProposee,
       spanActe,
       auteur, auteurId, auteurNom, auteursConnus, recuDe, recuTxt,
       pdtDe, pdtCandidats, actesPdt, actesParDisc, node, enfants, partBloc, lectureAilleurs,
       chemins, cheminDe, circonstancesDe, nomChemin, vChemin,
       periode, perOuverte, finPer, perOuvertes, perDans, perDisc, perDiscTxt,
       dureePer, quandPer,
       perTxt, cumulPer, parDisc,
       sujet, sujetId, sujetTxt, sujetsTxt, sujetsDerniers, apresArret, spTache,
       sujetLie, sujetDeLie, sujetsAttente, tendusSj, de, pt,
       gensId, gensNom, gensTxt,
       exaucesDe, exauceTxt, sujetDepuis, sujetFois, sujetHist, vActes, minuit,
       sujetDernier, seancesDe, seanceFraiche, porteSeance, ecranDit, vCahier,
       pdtCandidats, pdtSuppose, choixPendant, pdtDe, vSujet, vSujets, vAnnonce, vLecture,
       vPages, vBloc, dejaSeance, vToday, rappelPer, vPeriode,
       livre, livreId, pageLue, nbLu, chapitresTxt, pagesTxt,
       enParties, partiesTxt, partiesVues, uniteTxt, livreFini, livresOuverts,
       dernierLivre, nomPassagePg, vLivre, recuDe, recuTxt,
       discDevine, tachesDevinees, msDevinees, vDevine,
       paroles, accomplie, accompliesDe, parolesAttente, tendParoles, choixCause,
       joursComptes, heuresDuJour, creuxDuJour, dynJour, dynSemaine, echanges, nbEchanges,
       dynEchanges, paroleDelais, nbAccomplies, dynParoles, blocDyn, vRevel,
       estParole, constats, vLier, jours, duree,
       rythNom, rythFiche, rythme, rythDits, joursMs, dernierSigne, retard, retards,
       rythTenus, fidTxt, rappelFid, vRythmes, vRythme,
       impsDe, impFois, impDernier, impPremier, importune, impTxt,
  promesse, sujetProm, promTitre, promRefs, sujetRefs, vPromesse,
  promNode, parolesPosables, sujetsSurParole, estParole, paroles,
  echMs, echJours, echTxt, echCourt, echProche, echeances, rappelEch,
    sujetGens, sujetsDe, sujetPour, sujetBut, sujetReste, sujetCompte, sujetsTenus,
       porteDepuis, ceuxPortes, porteAttente, porteTxt, rappelPorte, vPortes, vPorte,
       dynProgres, rappelProgres, vCahier, sujetFois, sujetDernier, seancesDe, gensNom,
       acteDit, acteDisc, acteCompte, actesDisc, acteDiscPropose, actesSansDisc,
       vActesDisc, vActeDisc, porteDisc, etapes, spanActe, discNom,
       vReglages,
       vTache, heuresTache, heuresTxt, nomLivre, nomPassage, nomPassagePg,
       chapitresFen, pagesFenPar, resumeLus, chapFen, pagesFen, vMonTemps, catNom, CATS, tacheCat, finDe, cap,
       soBilan, soSauf, soSigne, soVide, soBascule, soEcris, soLoad, soRate,
       soEtat, soNom, soDepuis, soPropose, vSondes, vReglages,
       portesEp, porteEp, epinglePorte, decrochePorte, enPremier,
       epinglesTaches, portables, nomVue, porteBlocEp, portesReglage,
       vueDe, vueGarde,
       vOrdre, vEpingles, portePointage, etapes, vNote, vNode, vAccomplis, porteFaits, vPointer, creuxVif,
       sansDate, precPour, today, render, save, VUES, quitterPrevu, jourPromis, promisBref, ligneActe, remontees, blocQuand, vEdit, human },
  c: { DISC, DYN, RYTHMES, PERIODES, ONG_TEMPS, SANSFIN, KEY, CAT_SOCLE,
       SO_KEY, SO_MAX, ONGLETS, NOM_VUE, SEULES, PROMESSES, PR_N,
       VEILLE_DEFAUT, VEILLE_PLANCHER, VEILLE_MINI }
};
`;

/* Charge l'application dans un bac à sable neuf.
 *
 *   const app = charge();
 *   app.db = { ...une archive de test... };
 *   app.actions.majBloc();
 *   app.f.cumul(t0, t1);
 *
 * `app.maintenant(ms)` fige l'horloge ; `app.maintenant(null)` la relâche.
 */
function charge(opts) {
  const ctx = faitContexte(opts);
  const fixe = { ms: (opts && typeof opts.maintenant === "number") ? opts.maintenant : null };
  poseHorloge(ctx, fixe);
  vm.createContext(ctx);
  try {
    new vm.Script(sourceApp() + PONT, { filename: "index.html" }).runInContext(ctx);
  } catch (e) {
    e.message = "l'application n'a pas pu se charger dans le harnais : " + e.message;
    throw e;
  }
  const app = ctx.__eben;
  if (!app) throw new Error("le pont n'a pas été posé — une fonction attendue a-t-elle été renommée ?");
  app.maintenant = function (ms) { fixe.ms = (ms === undefined ? null : ms); };
  app.ctx = ctx;
  /* Une archive nue, pour partir de rien à chaque test. */
  app.vide = function () {
    app.db = app.f.sane({});
    /* Les sondes ne vivent pas dans l'archive (13.dn) : les vider est un
       geste à part, sinon un test hérite des gestes du précédent. */
    app.f.soVide();
    app.SO.prof = 0;
    return app.db;
  };
  /* Ce que le bac à sable a gardé sous une clé : pour vérifier qu'une chose
     est écrite là où on croit, et pas ailleurs. */
  app.stocke = function (k) { return ctx.localStorage.getItem(k); };
  /* Écrire dans un champ d'heure comme le ferait le doigt : au format du
     téléphone, à la minute. */
  app.poseHeure = function (id, ms) {
    ctx.document.getElementById(id).value = (ms === null ? "" : app.f.dtl(ms));
  };
  /* Ouvrir l'écran de correction d'un bloc, champs remplis comme à
     l'ouverture — c'est l'état d'où part toute correction réelle. */
  /* Ouvrir l'écran d'une période, champs remplis comme à l'ouverture. */
  /* Toucher une ligne : on fabrique la cible que le délégué attend, et on
     appelle le vrai écouteur. `app.geste({pdt: "b1"})` vaut `data-pdt="b1"`. */
  /* Écrire dans un champ, comme un doigt le ferait : le faux document rend
     toujours un élément, et c'est sa valeur que l'application relit. */
  app.ecrit = function (id, v) { ctx.document.getElementById(id).value = v; };
  /* Changer un champ qui se garde tout seul : on pose la valeur, puis on
     appelle le vrai écouteur — c'est ce que fait un doigt qui quitte le
     champ. `app.change("tNom", "Prière")` vaut une frappe suivie d'un
     ailleurs ; le type "input" pour ce qui réagit à la frappe même. */
  app.change = function (id, v, type) {
    const el = ctx.document.getElementById(id);
    el.value = v;
    const ev = { target: el, preventDefault: function () {}, stopPropagation: function () {} };
    (ctx.__ecouteurs[type || "change"] || []).forEach(function (fn) { fn(ev); });
    return el;
  };
  /* Le dernier mot passager, et tous depuis le dernier appel à `vide()`. */
  app.dernierToast = function () { return ctx.__toasts[ctx.__toasts.length - 1] || ""; };
  app.toasts = function () { return ctx.__toasts.slice(); };
  app.geste = function (data) {
    const cible = {
      dataset: data, value: "", tagName: "A",
      closest: function () { return cible; }
    };
    const ev = { target: cible, preventDefault: function () {}, stopPropagation: function () {} };
    (ctx.__ecouteurs.click || []).forEach(function (fn) { fn(ev); });
  };
  /* 13.ey — le réveil touche quatre choses que le navigateur de carton n'a
     pas : la permission, l'abonnement, le cache qu'il partage avec le
     service worker, et le serveur. On les pose, et on retient ce qui est
     parti — c'est sur CE QUI PART que porte la règle. */
  app.reveilFaux = function (o) {
    o = o || {};
    const envois = [], cache = {};
    let abo = o.abo === undefined ? null : o.abo;
    function abonnement() {
      return {
        endpoint: abo,
        unsubscribe: function () { abo = null; return Promise.resolve(true); }
      };
    }
    ctx.Notification = {
      permission: o.permission || "granted",
      requestPermission: function () {
        envois.push({ demande: true });
        /* Un vrai navigateur RETIENT la réponse : sans ça le faux restait
           sur « default » et le réveil se croyait refusé juste après avoir
           été accepté. */
        ctx.Notification.permission = o.demande || "granted";
        return Promise.resolve(ctx.Notification.permission);
      }
    };
    ctx.PushManager = function () {};
    ctx.navigator.serviceWorker = {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: function () { return Promise.resolve(abo ? abonnement() : null); },
          subscribe: function (opt) {
            if (o.abonneRefuse) return Promise.reject(new Error("refus"));
            envois.push({ abonne: opt });
            abo = o.neuf || "https://push.exemple/abc";
            return Promise.resolve(abonnement());
          }
        }
      }),
      addEventListener: function () {}
    };
    ctx.Response = class {
      constructor(corps) { this.corps = corps; }
      json() { return Promise.resolve(JSON.parse(this.corps)); }
      text() { return Promise.resolve(this.corps); }
    };
    ctx.caches = {
      open: function (nom) {
        cache[nom] = cache[nom] || {};
        return Promise.resolve({
          put: function (k, r) { cache[nom][k] = r; return Promise.resolve(); },
          match: function (k) { return Promise.resolve(cache[nom][k]); }
        });
      },
      delete: function (nom) { delete cache[nom]; return Promise.resolve(true); }
    };
    ctx.fetch = function (url, opt) {
      envois.push({
        url: url, methode: (opt && opt.method) || "GET",
        corps: opt && opt.body ? JSON.parse(opt.body) : null
      });
      if (o.serveurRefuse)
        return Promise.resolve({ ok: false, status: 404,
          text: function () { return Promise.resolve('{"message":"relation \\"reveils\\" does not exist"}'); } });
      return Promise.resolve({ ok: true, status: 200,
        text: function () { return Promise.resolve(""); } });
    };
    /* Un jeton encore valable : le réveil n'a pas à rejouer la connexion.
       L'échéance est hors d'atteinte — l'horloge du bac à sable est figée à
       une date que `Date.now()` d'ici ne connaît pas. */
    app.SY.jwt = "jeton"; app.SY.exp = 9e15;
    return {
      envois: envois, cache: cache,
      abonnement: function () { return abo; },
      /* Ce que la page a laissé pour le service worker. */
      miroir: function () {
        const c = cache["ebenezer-veille"];
        const r = c && c["./veille.json"];
        return r ? JSON.parse(r.corps) : null;
      },
      /* Les lignes posées au serveur, sans le bruit du reste. */
      posees: function () {
        return envois.filter(function (e) { return e.url && /\/rest\/v1\/reveils/.test(e.url); });
      }
    };
  };
  app.ouvrePeriode = function (pr) {
    app.S.perId = pr.id;
    app.poseHeure("pdDeb", pr.deb);
    app.poseHeure("pdFin", typeof pr.fin === "number" ? pr.fin : null);
    ctx.document.getElementById("pdNote").value = pr.note || "";
  };
  app.ouvreBloc = function (b) {
    app.S.blocId = b.id;
    app.poseHeure("bDeb", b.deb);
    app.poseHeure("bFin", typeof b.fin === "number" ? b.fin : null);
    ctx.document.getElementById("bNote").value = b.note || "";
  };
  return app;
}

/* ---------- petites commodités d'écriture ---------- */

const MIN = 60000;
const H = 3600000;

/* Un instant du 8 novembre 2026, heure locale. */
function j(h, m) { return new Date(2026, 10, 8, h, m || 0, 0, 0).getTime(); }
/* Le même, un autre jour du même mois. */
function jour(d, h, m) { return new Date(2026, 10, d, h, m || 0, 0, 0).getTime(); }

/* Un bloc de temps prêt à poser dans db.temps. */
function bloc(id, t, deb, fin, extra) {
  const b = { id: id, t: t, deb: deb, maj: deb };
  if (typeof fin === "number") b.fin = fin;
  return Object.assign(b, extra || {});
}

/* ---------- le service worker ----------
 * Il n'est pas chargé par index.html : il tourne à part, dans son propre
 * monde, et c'est là qu'est écrite la seule phrase de l'application qu'on ne
 * puisse pas aller lire à l'écran — celle du réveil, l'app fermée (13.ey).
 * On le charge donc comme on charge l'application : le vrai fichier, un
 * monde de carton autour. Et comme il porte une copie de `hm()`, un test
 * tient les deux côte à côte.
 */
function chargeSW(opts) {
  opts = opts || {};
  const notifs = [], ouvertes = [], messages = [], ecoute = {}, cache = {};
  const ctx = {
    console, btoa, atob, TextEncoder, TextDecoder, URL,
    Response: class {
      constructor(corps) { this.corps = corps; }
      json() { return Promise.resolve(JSON.parse(this.corps)); }
    },
    Request: class { constructor(u) { this.url = u; } },
    caches: {
      open(nom) {
        cache[nom] = cache[nom] || {};
        return Promise.resolve({
          put(k, r) { cache[nom][k] = r; return Promise.resolve(); },
          match(k) { return Promise.resolve(cache[nom][k]); },
          add() { return Promise.resolve(); }
        });
      },
      keys() { return Promise.resolve(Object.keys(cache)); },
      delete(nom) { delete cache[nom]; return Promise.resolve(true); },
      match() { return Promise.resolve(undefined); }
    },
    fetch() { return Promise.reject(new Error("pas de réseau dans les tests")); },
    setTimeout, clearTimeout
  };
  ctx.self = {
    addEventListener(t, fn) { (ecoute[t] = ecoute[t] || []).push(fn); },
    location: { origin: "https://exemple" },
    skipWaiting() {},
    registration: {
      showNotification(titre, o) {
        notifs.push({ titre: titre, corps: (o && o.body) || "", opt: o || {} });
        return Promise.resolve();
      }
    },
    clients: {
      claim() { return Promise.resolve(); },
      matchAll() {
        return Promise.resolve((opts.fenetres || []).map(function () {
          return {
            focus: function () { ouvertes.push("focus"); return Promise.resolve(); },
            postMessage: function (m) { messages.push(m); }
          };
        }));
      },
      openWindow(u) { ouvertes.push(u); return Promise.resolve(); }
    }
  };
  ctx.globalThis = ctx;
  const fixe = { ms: (typeof opts.maintenant === "number") ? opts.maintenant : null };
  poseHorloge(ctx, fixe);
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8");
  new vm.Script(src +
    "\n;globalThis.__sw = {veilleDit, hmSW, VEILLE, MIROIR, CACHE};",
    { filename: "sw.js" }).runInContext(ctx);
  const sw = ctx.__sw;
  if (!sw) throw new Error("sw.js n'a pas tendu la main — une fonction a-t-elle été renommée ?");
  sw.notifs = notifs;
  sw.maintenant = function (ms) { fixe.ms = (ms === undefined ? null : ms); };
  /* Poser le miroir là où la page le pose. */
  sw.pose = async function (v) {
    const c = await ctx.caches.open(sw.VEILLE);
    await c.put(sw.MIROIR, new ctx.Response(JSON.stringify(v)));
  };
  /* Sonner : le vrai écouteur, et on attend ce qu'il attend. */
  async function tire(type, ev) {
    const attentes = [];
    ev.waitUntil = function (p) { attentes.push(p); };
    (ecoute[type] || []).forEach(function (fn) { fn(ev); });
    await Promise.all(attentes);
  }
  sw.sonne = async function () {
    const avant = notifs.length;
    await tire("push", {});
    return notifs.length > avant ? notifs[notifs.length - 1] : null;
  };
  sw.touche = async function () {
    let fermee = false;
    await tire("notificationclick", { notification: { close: function () { fermee = true; } } });
    return { fermee: fermee, ouvertes: ouvertes.slice(), messages: messages.slice() };
  };
  sw.active = async function (autres) {
    (autres || []).forEach(function (k) { cache[k] = {}; });
    await tire("activate", {});
    return Object.keys(cache);
  };
  return sw;
}

module.exports = { charge, chargeSW, MIN, H, j, jour, bloc };
