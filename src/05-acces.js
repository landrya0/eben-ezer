/* Ében-Ézer — acces
   Lire l'archive : actes, gens, et ce qui remonte.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- accès ---------- */
function node(id){ return db.nodes.find(n=>n.id===id); }
function gensNom(id){ const g=db.gens.find(x=>x.id===id); return g?g.nom:""; }
function gensId(nom){
  const v=String(nom||"").trim(); if(!v) return null;
  const k=v.toLowerCase();
  const f=db.gens.find(g=>String(g.nom).trim().toLowerCase()===k);
  if(f) return f.id;
  const id=uid("g"); db.gens.push({id:id,nom:v,maj:Date.now()}); return id;
}
function enfants(id){ return db.nodes.filter(n=>(n.par||[]).indexOf(id)!==-1); }
function dessous(id){
  const vus=[id]; let f=[id];
  while(f.length){ const g=[]; f.forEach(x=>enfants(x).forEach(e=>{ if(vus.indexOf(e.id)===-1){vus.push(e.id); g.push(e.id);} })); f=g; }
  return vus;
}
/* Un chemin, c'est un morceau du graphe où tout se tient : on part d'un acte,
   on suit les liens dans les deux sens, et on ramasse tout ce qui est relié.
   Ce n'est donc ni une branche ni une ligne — c'est ce qui se répond. */
/* Dieu parle le plus souvent PENDANT que quelque chose se fait. Un acte reçu
   au milieu d'un enseignement suivi ou d'une retraite n'est donc pas isolé :
   il a un amont, et cet amont est une circonstance (13.cy). Elle relie comme
   une cause relie — deux actes reçus pendant la même chose tiennent au même
   fil — et elle suffit à faire un chemin à elle seule, parce qu'un chemin
   d'un seul acte n'est un chemin que si l'on sait d'où il vient. */
function chemins(){
  const grp={}, vu={};
  db.nodes.forEach(n=>{ grp[n.id]=n.id; vu[n.id]=true; });
  const circ={};
  db.nodes.forEach(n=>{ if(n.pdt && pdtDe(n.pdt)) circ[n.id]=n.pdt; });
  function racine(x){ while(grp[x]!==x){ grp[x]=grp[grp[x]]; x=grp[x]; } return x; }
  function unir(x,y){ const a=racine(x), b=racine(y); if(a!==b) grp[a]=b; }
  db.nodes.forEach(n=>(n.par||[]).forEach(p=>{ if(vu[p]) unir(n.id, p); }));
  /* Les actes qui partagent une circonstance se rejoignent par elle. */
  const parCirc={};
  Object.keys(circ).forEach(function(id){ (parCirc[circ[id]]=parCirc[circ[id]]||[]).push(id); });
  Object.keys(parCirc).forEach(function(c){
    parCirc[c].forEach(function(id){ unir(id, parCirc[c][0]); });
  });
  const paquets={};
  db.nodes.forEach(n=>{ const r=racine(n.id); (paquets[r]=paquets[r]||[]).push(n); });
  return Object.keys(paquets).map(k=>paquets[k])
    /* Un acte seul fait chemin dès qu'il a quelque chose dessous : une
       circonstance, ou un sujet qu'il exauce — car un sujet nommé puis
       exaucé EST un chemin de deux pas, c'est même le seul que le cahier de
       prière du disciple ait jamais tenu (13.dg).
       Ce qu'on ne fait pas : réunir deux actes parce qu'ils exaucent le même
       sujet. Une circonstance est un moment, elle ne rassemble que ce qui
       était là ; un sujet se redit cent fois, et « merci pour le travail »
       finirait par tout coudre ensemble. */
    .filter(a=>a.length>1 || (a.length===1 && (circ[a[0].id] || (a[0].suj||[]).length)))
    /* Du plus récent au plus ancien, comme partout ailleurs dans
       l'application : on arrive par ce qui vient de se passer, et on
       descend vers ce qui l'a causé. Lire à l'endroit demandait de
       chercher la fin avant de savoir de quoi il s'agissait. */
    .map(a=>a.slice().sort(parDate))
    /* Le chemin qui a bougé le plus récemment se lit d'abord — la longueur
       n'est pas ce qu'on cherche en ouvrant la liste. */
    .sort((a,b)=>parDate(a[0],b[0]) || b.length-a.length);
}
function cheminDe(id){ if(!id) return null; return chemins().filter(a=>a.some(n=>n.id===id))[0]||null; }
/* Ce pendant quoi le chemin s'est joué — le plus ancien en premier, puisque
   le fil descend vers ce qui a précédé. */
function circonstancesDe(suite){
  const vus={}, out=[];
  (suite||[]).forEach(function(n){
    if(!n.pdt || vus[n.pdt]) return;
    const x=pdtDe(n.pdt); if(!x) return;
    vus[n.pdt]=1; out.push(x);
  });
  return out.sort(function(a,b){ return a.deb-b.deb; });
}
/* Un chemin ne se nomme pas par son dernier pas. Il existe parce que Dieu a
   répondu quelque chose : c'est Son acte le plus récent qui le nomme, et à
   défaut la tête, comme avant (13.cy). */
function nomChemin(suite){
  const d=(suite||[]).filter(function(n){ return n.act==="dieu"; })[0];
  return d || (suite||[])[0];
}
/* La romaine est réservée à ce qui est CITÉ, jamais à ce qui est raconté au
   sujet d'une parole. « Dieu m'a parlé pendant la croisade » n'est pas une
   parole : c'est un récit. Le texte lui-même le dit, par ses guillemets, et
   l'application n'a qu'à les lire — rien de plus à demander au disciple.
   Une parole notée sans guillemets est citée tout entière : c'est le seul
   cas où l'on devine, et il est sans danger. */
const GUIL = /«[^»]*»|“[^”]*”|"[^"]{1,600}"/g;
function cite(n){
  const t = String((n && n.txt!=null ? n.txt : n) || "");
  GUIL.lastIndex = 0;
  if(n && n.txt!=null && estParole(n) && !GUIL.test(t))
    return '<span class="cite">'+esc(t)+'</span>';
  GUIL.lastIndex = 0;
  let out="", i=0, m;
  while((m=GUIL.exec(t))){
    out += esc(t.slice(i, m.index)) + '<span class="cite">'+esc(m[0])+'</span>';
    i = m.index + m[0].length;
  }
  return out + esc(t.slice(i));
}
/* « … » suivi d'autre chose : ce qui suit la citation est sa référence, pas
   la parole. On ne devine que dans ce cas précis — le texte COMMENCE par une
   citation — parce qu'ailleurs la suite est une phrase, pas une source.
   Et l'on ne déplace rien : on propose, le disciple touche (P9). */
function reference(txt){
  const t=String(txt||"").trim();
  if(!/^[«“"]/.test(t)) return "";
  GUIL.lastIndex=0;
  const m=GUIL.exec(t);
  if(!m || m.index!==0) return "";
  const q=t.slice(m[0].length).replace(/^[\s,.;:–—-]+/,"").trim();
  return (q.length>=2 && q.length<=90) ? q : "";
}
function estParole(n){ return n.kind==="rhema" || n.kind==="ecriture" || (n.act==="dieu" && n.man==="parle"); }
function acteurTxt(n){
  if(n.act==="dieu") return n.kind==="ecriture" ? "Écriture" : (n.kind==="rhema" ? "Dieu · rhema" : "Dieu");
  if(n.act==="gens"){ const nom=gensNom(n.gid)||"quelqu'un"; return n.man ? ("Lui, par "+nom) : nom; }
  const d = n.dest==="gens" ? (gensNom(n.dgid)||"quelqu'un") : (n.dest==="moi" ? "moi-même" : "Dieu");
  return "moi → "+d;
}
function dieuNodes(){ return db.nodes.filter(n=>n.kind!=="ecriture" && (n.act==="dieu" || (n.act==="gens" && n.man))); }
function parDate(a,b){ return (b.date||"").localeCompare(a.date||"") || ((b.ts||0)-(a.ts||0)); }
/* Les lectures qui vont vers l'avant — ce qui est prévu, ce qu'on a laissé
   sans réponse — prennent le même départage, retourné : à date égale, le
   premier gardé ouvre la marche. Sans quoi deux actes du même jour se
   croisent au hasard de la mémoire, et une liste qui se croise ne se lit
   plus. Un chemin, lui, descend : voir chemins(). */
function parDateAsc(a,b){ return (a.date||"").localeCompare(b.date||"") || ((a.ts||0)-(b.ts||0)); }

/* ---------- ce qui revient ----------
   Pas un seul souvenir : tout ce qui revient aujourd'hui, à faire défiler.
   Une semaine, un mois, un an — et, quand la mémoire est pleine, le hasard. */
function jour0(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function joursDepuis(n){
  const p=parse(n.date); if(!p) return null;
  return Math.round((jour0(new Date()) - new Date(p.y,p.m-1,p.d)) / 86400000);
}
const FENETRES = [
  {j:7,   tol:0, t:"Il y a une semaine"},
  {j:14,  tol:1, t:"Il y a deux semaines"},
  {j:30,  tol:2, t:"Il y a un mois"},
  {j:91,  tol:4, t:"Il y a trois mois"},
  {j:182, tol:5, t:"Il y a six mois"}
];
function ansJourPourJour(n){
  const p=parse(n.date), now=new Date();
  if(!p || n.prec!=="j") return 0;
  if(p.m!==now.getMonth()+1 || p.d!==now.getDate()) return 0;
  const a=now.getFullYear()-p.y;
  return a>0 ? a : 0;
}
function carteAnniv(n){
  const a=ansJourPourJour(n);
  if(a) return {n:n, type:"anniv", quand:"Il y a "+(a===1?"un an":a+" ans"), rang:100-a};
  const j=joursDepuis(n);
  if(j==null || j<=1) return null;
  for(let i=0;i<FENETRES.length;i++){
    const f=FENETRES[i];
    if(Math.abs(j-f.j)<=f.tol) return {n:n, type:"anniv", quand:f.t, rang:i};
  }
  return null;
}
function remontees(){
  const vus={}, cartes=[];
  const prends=c=>{ if(c && !vus[c.n.id]){ vus[c.n.id]=1; cartes.push(c); } };

  db.nodes.filter(n=>n.etat==="prevu" && n.date && n.date<=today())
    .sort(parDateAsc)
    .slice(0,2)
    .forEach(n=>prends({n:n, type:"prevu", quand:"Tu avais prévu"}));

  dieuNodes().map(carteAnniv).filter(Boolean)
    .sort((a,b)=>a.rang-b.rang).forEach(prends);

  dieuNodes().filter(n=>!enfants(n.id).some(e=>e.act==="moi"))
    .sort(parDateAsc)
    .slice(0,2)
    .forEach(n=>prends({n:n, type:"dette", quand:"Sans réponse de toi"}));

  /* Quand il y en a beaucoup, le hasard ramène ce qu'on ne cherchait pas. */
  const reste=dieuNodes().filter(n=>!vus[n.id]);
  for(let k=0; k<3 && reste.length && cartes.length<8; k++){
    const n=reste.splice(Math.floor(Math.random()*reste.length),1)[0];
    prends({n:n, type:"hasard", quand:"Au hasard"});
  }
  return cartes;
}

