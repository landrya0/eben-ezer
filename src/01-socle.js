/* Ében-Ézer — socle
   Constantes du socle, et le rangement sur l'appareil.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* Écrite à l'écran, dans Mes données. Sans elle, « je ne vois pas la
   nouvelle version » est une phrase que ni lui ni moi ne pouvons vérifier :
   on en est réduit à deviner. Elle monte avec le cache du service worker. */
const VERSION = "v100";
const KEY = "ebenezer.v1";
/* Les sondes vivent dans le 12, chargé APRÈS celui-ci : le socle ne peut
   pas en dépendre, l'ordre est porteur. On appelle donc à travers un
   crochet, vide jusqu'à ce que le 12 le remplisse — et l'application
   tourne entière même si le 12 n'était pas là (13.dn). */
let SONDE = null;
/* Cinq manières au départ — mais Il n'en a pas cinq. Le disciple en ajoute
   à la volée, et les siennes se rangent après celles-ci. */
const MAN_SOCLE = {parle:"Il a parlé", pourvu:"Il a pourvu", ouvert:"Il a ouvert", delivre:"Il a délivré", repris:"Il a repris"};
function MANS(){
  const m=Object.assign({}, MAN_SOCLE);
  (db.mans||[]).forEach(x=>{ if(x && x.id) m[x.id]=x.txt; });
  return m;
}
function manTxt(k){ return MANS()[k]||""; }
/* « Il a… » est sous-entendu dans la question : on l'écrit si le disciple
   ne l'a pas écrit, pour que la liste se lise d'une seule voix. */
function manId(txt){
  let v=String(txt||"").trim(); if(!v) return null;
  if(!/^il[\s']/i.test(v)) v = "Il a "+v.charAt(0).toLowerCase()+v.slice(1);
  const m=MANS(), k=Object.keys(m).find(x=>m[x].toLowerCase()===v.toLowerCase());
  if(k) return k;
  db.mans=db.mans||[];
  const id=uid("man"); db.mans.push({id:id, txt:v, maj:Date.now()}); return id;
}
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const ETAT = {fait:"fait", encours:"en cours", prevu:"prévu", abandon:"abandonné"};
const ETATS = [["fait","C'est fait"],["encours","Ça dure encore"],["prevu","C'est prévu"]];

/* Les quatre destinataires d'une journée, et ce qui n'en est aucun. « Le
   reste » n'est pas un reproche : c'est l'attente, le trajet, le flottement.
   Il doit porter un nom, sinon la journée mentirait de ce qu'elle ne compte
   pas, et les parts seraient fausses. */
const CAT_SOCLE = [["dieu","Pour Dieu"],["famille","Ma famille"],["travail","Mon travail"],["moi","Moi"],["reste","Le reste"]];
/* Une liste vide au premier geste, c'est un écran qui demande du travail
   avant de rendre service. On propose ; rien n'entre en mémoire avant d'être
   touché. */
const TACHES_SOCLE = [
  ["Prière","dieu"],["Lecture de la Parole","dieu"],["Culte","dieu"],["Service dans l'assemblée","dieu"],
  ["Temps en famille","famille"],["Repas en famille","famille"],["Prière en famille","famille"],
  ["Travail","travail"],["Réunion","travail"],["Trajet","travail"],
  ["Sommeil","moi"],["Repas","moi"],["Sport","moi"],["Lecture","moi"],
  ["Attente","reste"],["Écrans","reste"]
];

/* `sous` et `dev` sont l'argent, dont les écrans sont sortis de l'app en
   v98. Ils restent câblés ici, dans `sane()`, dans la boucle `maj` et dans
   `fusionne()` : `sane()` est une liste blanche, et les retirer effacerait
   le registre au premier enregistrement — puis, par la synchro, sur l'autre
   appareil. On ne supprime pas, et rien ne se perd (2.d, 13.be, 13.dw).
   L'export les emporte : c'est par là qu'ils sortent. */
let db = {nodes:[], gens:[], noms:[], mans:[], cats:[], taches:[], temps:[], periodes:[], livres:[], auteurs:[], sujets:[], sous:[], portes:[], dev:"EUR", exp:0, seq:1};
let S = {view:"today", step:0, draft:null, filtre:"tout", ret:"tout", grain:"an", rev:"noms", pile:[], nodeId:null,
         cheminId:null, faits:-1, eMan:"", eEtat:"fait", ePrec:"j",
         descOuvert:false, plie:true, cNeuf:false, cTxt:"", cType:"", cQ:"",
         per:"jour", anc:null, vue:"parts", tQ:"", tCat:"", blocId:null, medId:null, trou:null, quand:null,
         noteFocus:false, frisZ:null, enPlus:null, plusDeb:null, poseEn:null, tchId:null, sjQ:"", gQ:"", sujId:null, sjF:"attente",
         qOuv:false, lu:null, luA:null, luZ:null, luPlein:false,
         pgL:null, pgA:null, pgZ:null, lvId:null, auId:null, perId:null};

/* Un seul « écran précédent » ne suffisait pas : en ouvrant un retour depuis
   un acte, il finissait par désigner l'acte lui-même, et le bouton Retour ne
   faisait plus rien. On empile donc les écrans traversés, et on dépile en
   sautant ce qui n'existe plus. Un bouton qui ne ramène nulle part est pire
   que pas de bouton. */
function empile(){
  S.pile.push({view:S.view, nodeId:S.nodeId, cheminId:S.cheminId});
  if(S.pile.length>12) S.pile.shift();
}
function depile(repli){
  while(S.pile.length){
    const p=S.pile.pop();
    if(p.view==="node" && !node(p.nodeId)) continue;
    if(p.view==="chemin" && !cheminDe(p.cheminId)) continue;
    if(p.view===S.view && p.nodeId===S.nodeId && p.cheminId===S.cheminId) continue;
    S.view=p.view; S.nodeId=p.nodeId; S.cheminId=p.cheminId; return;
  }
  S.view=repli||"today";
}

/* ---------- stockage ---------- */
function sane(v){
  const o = (v && typeof v==="object") ? v : {};
  const d = {nodes:Array.isArray(o.nodes)?o.nodes:[], gens:Array.isArray(o.gens)?o.gens:[],
          noms:Array.isArray(o.noms)?o.noms:[], mans:Array.isArray(o.mans)?o.mans:[],
          cats:Array.isArray(o.cats)?o.cats:[], taches:Array.isArray(o.taches)?o.taches:[],
          livres:Array.isArray(o.livres)?o.livres:[],
          auteurs:Array.isArray(o.auteurs)?o.auteurs:[],
          sujets:Array.isArray(o.sujets)?o.sujets:[],
          sous:Array.isArray(o.sous)?o.sous:[],
    portes:Array.isArray(o.portes)?o.portes:[],
          /* La monnaie n'est pas une donnée du mémorial, c'est un réglage :
             on n'y garde que le code, et on ne devine aucun taux (13.dk). */
          dev:(typeof o.dev==="string" && /^[A-Z]{3}$/.test(o.dev))?o.dev:"EUR",
          temps:Array.isArray(o.temps)?o.temps:[],
          periodes:Array.isArray(o.periodes)?o.periodes:[],
          exp:(typeof o.exp==="number")?o.exp:0,
          morts:(o.morts && typeof o.morts==="object")?o.morts:{},
          maj:(typeof o.maj==="number")?o.maj:0,
          seq:(typeof o.seq==="number"&&o.seq>0)?o.seq:1};
  /* Les fiches d'avant la synchronisation n'ont pas d'heure. On leur en donne
     la plus ancienne possible : la moindre écriture réelle les dépassera. */
  [d.nodes,d.gens,d.noms,d.mans,d.cats,d.taches,d.temps,d.periodes,d.livres,d.auteurs,d.sujets,d.sous,d.portes].forEach(function(a){
    a.forEach(function(x){ if(x && typeof x.maj!=="number") x.maj=1; });
  });
  /* Le type de champs était un réglage à part ; il devient une conséquence de
     la routine (13.cn). On reprend l'ancien à la lettre, le choix explicite
     de « rien de plus » compris, et chaque appareil fait la même traduction
     de son côté — rien à propager. */
  d.taches.forEach(function(t){
    if(t && t.d===undefined && t.sp!==undefined)
      t.d = t.sp==="bible" ? "parole" : (t.sp==="livre" ? "litt" : "");
  });
  /* Un bloc sans départ ou sans activité ne dit rien : on nettoie et on
     range une fois pour toutes, au chargement.
     Ce qu'on ne fait plus ici : fermer un bloc sans fin parce qu'un autre
     commence après lui. Quand il n'y avait qu'une file, un bloc ouvert qui
     n'était pas le dernier était forcément une avarie, et le refermer sur le
     départ du suivant remettait la journée d'aplomb. Depuis qu'on mène
     plusieurs choses de front (13.by), c'est la situation la plus ordinaire
     qui soit : l'application tourne depuis 8 h, une réunion s'ouvre à 9 h
     par-dessus — et la simple ouverture de l'écran arrêtait l'application à
     9 h. Tout ce qui avait suivi devenait du temps non compté, et plus rien
     ne tournait : « subitement, rien n'était fait depuis ». Un bloc sans fin
     est un bloc EN COURS, et personne ne le ferme à la place du disciple
     (13.cf). */
  d.temps = d.temps.filter(b=>b && typeof b.deb==="number" && b.t)
                   .sort((a,b)=>a.deb-b.deb);
  d.temps.forEach(b=>{ if(!b.id) b.id="b"+(d.seq++)+"-"+DEV; });
  /* Une période n'est pas un bloc : elle n'a ni activité ni poids d'heures,
     seulement une routine et deux bornes (13.cw). */
  d.periodes = d.periodes.filter(x=>x && typeof x.deb==="number" && x.d)
                         .sort((a,b)=>a.deb-b.deb);
  d.periodes.forEach(x=>{ if(!x.id) x.id="p"+(d.seq++)+"-"+DEV; });
  /* Un mouvement sans jour, sans somme ou sans poste ne dit rien : il ne
     pèserait dans aucune part et ne se lirait nulle part. On nettoie et on
     range une fois pour toutes, au chargement — comme les blocs. */
  d.sous = d.sous.filter(x=>x && typeof x.t==="number" && typeof x.m==="number" && x.m && x.p)
                 .sort((a,b)=>a.t-b.t);
  d.sous.forEach(x=>{ if(!x.id) x.id="mv"+(d.seq++)+"-"+DEV; });
  /* Deux fois la même porte n'est pas deux raccourcis : deux appareils
     peuvent l'avoir épinglée chacun de son côté (13.do). On ne juge pas ici
     si l'écran existe encore — le socle ne connaît pas la liste des écrans,
     elle vit dans la charpente, chargée après lui ; c'est l'écran qui ne
     montre que ce qu'il sait ouvrir.
     `ep` est un RANG, pas une date : c'est ce qui permet de régler l'ordre à
     la main. Les anciennes épingles portaient l'heure où elles avaient été
     posées — de grands nombres qui se rangent dans le même sens, donc rien à
     reprendre. */
  const dejaVue={};
  d.portes = d.portes.filter(function(p){
    if(!p || typeof p.v!=="string" || !p.v || dejaVue[p.v]) return false;
    dejaVue[p.v]=1; return true;
  });
  d.portes.sort(function(a,b){ return (a.ep||0)-(b.ep||0); });
  d.portes.forEach(function(p,i){
    if(!p.id) p.id="po"+(d.seq++)+"-"+DEV;
    if(typeof p.ep!=="number" || !p.ep) p.ep=i+1;
  });
  /* La date d'un acte dit quand il est arrivé ; elle ne dit pas dans quel
     ordre on l'a gardé. Deux actes du même jour se présentaient donc dans
     l'ordre où ils dormaient en mémoire — c'est-à-dire le plus ancien
     d'abord, juste quand on vient d'en écrire un. On garde l'heure.
     Les actes d'avant n'en ont pas : ils reçoivent leur rang, qui met le
     dernier gardé au-dessus et laisse toujours passer un acte neuf. */
  d.nodes.forEach((n,i)=>{ if(typeof n.ts!=="number") n.ts=i+1; });
  return d;
}
function load(){ try{ const r=localStorage.getItem(KEY); if(r) db=sane(JSON.parse(r)); }catch(e){} }
/* L'heure locale peut reculer d'un appareil à l'autre ; ce jalon-ci ne doit
   jamais reculer, sinon une modification vraie passerait pour déjà envoyée. */
function save(sil){
  if(!sil) db.maj = Math.max(Date.now(), (db.maj||0)+1);
  /* Toute écriture passe ici : c'est à ça qu'une sonde reconnaît un refus
     — l'application a parlé et rien n'a été écrit (13.dn). */
  if(SONDE) SONDE.ecrit();
  try{ localStorage.setItem(KEY, JSON.stringify(db)); }catch(e){ toast("Enregistrement impossible"); }
  if(!sil) syPlusTard();
}
/* Deux appareils qui créent chacun de leur côté produiraient le même « n42 »
   et l'un écraserait l'autre à la fusion. Chaque installation porte donc sa
   marque, tirée une fois et gardée hors de l'archive — elle appartient à
   l'appareil, pas aux données. */
const DEV = (function(){
  try{
    let d=localStorage.getItem("ebenezer.dev");
    if(!d){ d=Math.random().toString(36).slice(2,6)+Math.random().toString(36).slice(2,4);
            localStorage.setItem("ebenezer.dev", d); }
    return d;
  }catch(e){ return "x"+Math.random().toString(36).slice(2,7); }
})();
function uid(p){ return p+(db.seq++)+"-"+DEV; }
function nid(){ return uid("n"); }
/* Qui a parlé en dernier l'emporte : chaque fiche porte l'heure de sa
   dernière écriture. */
function touche(o){ if(o) o.maj=Date.now(); return o; }
/* Une fiche simplement absente d'un appareil ressusciterait à la fusion : on
   garde donc la trace de ce qui a été supprimé, et pour qui veut la lire,
   combien de temps. */
function tue(id){ if(id){ db.morts=db.morts||{}; db.morts[id]=Date.now(); } }
function ts(){ return Date.now(); }
function cap(t){ t=String(t||""); return t.charAt(0).toUpperCase()+t.slice(1); }
/* Toute parole de l'application passe ici (13.dn). */
/* Les messages se posent tous au même point, en bas de l'écran : deux à la
   fois ne font pas deux lignes, ils se recouvrent. Tant qu'on ne parlait
   qu'une fois par geste, cela ne se voyait pas ; en « plusieurs », trois
   tapes de suite donnaient trois mots empilés au même endroit. Le dernier
   chasse donc le précédent — une parole qui en couvre une autre n'est pas
   une parole (13.dq). */
function toast(t){
  if(SONDE) SONDE.dit(t);
  const vieux=document.querySelector(".toast"); if(vieux) vieux.remove();
  const d=document.createElement("div"); d.className="toast"; d.textContent=t;
  document.body.appendChild(d); setTimeout(()=>d.remove(),2200);
}

