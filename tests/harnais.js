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
      if (!elements[id]) elements[id] = elem();
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
  get Z(){ return Z; },
  actions: actions,
  f: { hm, hmin, dtl, valHeure, cumul, couvert, fusionTemps, fusionne, fusionListe,
       bornes, decale, fenetre, nomFen, courtFen, memeAn,
       finDe, voisins, touche, tue, sane, uid, cap, capNom,
       tache, tacheId, tacheNom, tacheCat, blocT, ouverts, fermeBloc,
       pointe, arrete, poseTache, creuxVif,
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
       gensId, gensNom, gensTxt,
       exaucesDe, exauceTxt, sujetDepuis, sujetFois, sujetHist, vActes, minuit,
       sujetDernier, seancesDe, vCahier, vSujet, vToday, rappelPer, vPeriode,
       livre, livreId, pageLue, nbLu, chapitresTxt, pagesTxt },
  c: { DISC, PERIODES, ONG_TEMPS, SANSFIN, KEY }
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
    return app.db;
  };
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
  app.geste = function (data) {
    const cible = {
      dataset: data, value: "", tagName: "A",
      closest: function () { return cible; }
    };
    const ev = { target: cible, preventDefault: function () {}, stopPropagation: function () {} };
    (ctx.__ecouteurs.click || []).forEach(function (fn) { fn(ev); });
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

module.exports = { charge, MIN, H, j, jour, bloc };
