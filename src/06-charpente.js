/* Ében-Ézer — charpente
   Dessiner la page : rail, barres, briques, menu.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- charpente ---------- */
const main=document.getElementById("main"), haut=document.getElementById("haut"),
      nav=document.getElementById("nav"), barre=document.getElementById("acte"),
      bas=document.getElementById("bas"),
      avance=document.getElementById("avance"), menu=document.getElementById("menu"),
      fond=document.getElementById("fond"), rail=document.getElementById("rail");
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
const CHEV = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>`;
const BAS = `<svg class="ch" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>`;
const CROIX = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
const MICSVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>`;
/* Les onglets portent toute la grammaire de l'outil : le jour ; ce qui
   descend — Ses œuvres viennent vers moi ; l'éclat de ce qu'on apprend de
   Lui ; ce qui monte — mes actes remontent vers Lui. Deux flèches suffisent
   à dire le dialogue, et elles le disent sans un mot. */
function ICO(d){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`; }
const ICONES = {
  today:   ICO(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.9" fill="currentColor" stroke="none"/>`),
  oeuvres: ICO(`<path d="M5.5 4.2v7.6M5.5 12.4 3.2 9.9M5.5 12.4l2.3-2.5"/>
                <path d="M12 4.2v14.4M12 19.2l-2.3-2.5M12 19.2l2.3-2.5"/>
                <path d="M18.5 4.2v10.3M18.5 15.1l-2.3-2.5M18.5 15.1l2.3-2.5"/>`),
  revel:   ICO(`<path d="M12 2.8 14.5 9.5 21.2 12l-6.7 2.5L12 21.2 9.5 14.5 2.8 12l6.7-2.5z"/>`),
  actes:   ICO(`<path d="M5.5 19.8v-7.6M5.5 11.6 3.2 14.1M5.5 11.6l2.3 2.5"/>
                <path d="M12 19.8V5.4M12 4.8l-2.3 2.5M12 4.8l2.3 2.5"/>
                <path d="M18.5 19.8V9.5M18.5 8.9l-2.3 2.5M18.5 8.9l2.3 2.5"/>`)
};
/* L'ordre n'est pas libre : les deux premiers sont à gauche du geste de
   noter, les deux derniers à sa droite. Juste à droite vient donc « Mes
   actes », là où tombe ce qu'on vient d'écrire — le voisin immédiat du
   geste est l'endroit où le geste aboutit. « Révélations » va au bout :
   c'est l'onglet le plus lent, celui de ce qu'on a fini par connaître de
   Lui, et il n'a pas à être sous le pouce. */
const ONGLETS = [["today","Aujourd'hui"],["oeuvres","Ses œuvres"],["actes","Mes actes"],["revel","Révélations"]];

/* Le nom de chaque écran, en français. Il sert à deux endroits qui ne se
   parlent pas — le bilan des sondes et les portes épinglées — et une table
   recopiée deux fois est une table qui diverge (13.dn, 13.do). */
const NOM_VUE = {
  today:"Aujourd'hui", oeuvres:"Ses œuvres", actes:"Mes actes", revel:"Révélations",
  note:"Garder un acte", node:"Un acte", edit:"Corriger un acte", lier:"Ce qui a précédé",
  chemin:"Un chemin", faits:"Les faits", epingles:"Ce qui est ici",
  pointer:"À quoi maintenant", temps:"Mon temps", bloc:"Ce bloc", quand:"Quand était-ce",
  frise:"La journée", tache:"Une activité",
  lecture:"Ce que tu as lu", pages:"Les pages lues", livre:"Un livre", auteur:"Un auteur",
  sujets:"Ce que tu as nommé", annonce:"À qui tu as annoncé", cahier:"Mes sujets",
  sujet:"Un sujet", promesse:"Sur quelle promesse",
  perNeuf:"Mettre un temps à part", periode:"Un temps mis à part",
  accomplis:"Ce que j'ai fait",
  sync:"Synchronisation", reglages:"Réglages", data:"Mes données",
  sondes:"Comment je m'en sers", ordre:"Dans quel ordre",
  verif:"L'état de l'archive"
};
function nomVue(v){ return NOM_VUE[v] || v; }
/* Les écrans qui tiennent debout tout seuls : les autres attendent qu'on
   leur désigne d'abord un acte, un bloc ou une fiche, et y mener sans ça
   ouvrirait un écran vide. */
const SEULES = ["today","oeuvres","actes","revel","faits","epingles","pointer",
                "temps","cahier","sujets","annonce","lecture","pages",
                "accomplis","perNeuf","sync","reglages","data","sondes","verif"];
/* Ce qui vaut la peine d'être épinglé : pas les quatre onglets ni les
   Réglages, déjà à une tape de partout ; ni « À quoi maintenant » et « Ce qui
   est ici », qui sont déjà deux lignes de l'écran où les épingles se posent.
   Une porte en double n'est pas un raccourci (13.do). */
const HORS_EPINGLE = {reglages:1, pointer:1, epingles:1};
function portables(){
  return SEULES.filter(function(v){
    return !HORS_EPINGLE[v] && !ONGLETS.some(function(o){ return o[0]===v; });
  });
}

/* Chaque vue remplit ces zones. Une seule action principale par écran. */
let Z = {};
function zero(){ Z = {titre:"", retour:false, fermer:false, plus:false, action:"", avance:0, haut:"", file:false, html:""}; }

function render(){
  if(rec) micArret();
  /* L'enregistrement ne meurt pas d'un redessin : la feuille flotte hors de
     la page, et elle tient l'acte visé par la main. Une synchronisation qui
     passe au mauvais moment ne doit pas jeter une voix. */
  fermeMenu(true);
  zero();
  if(S.view!=="note" && S.view!=="edit") S.descOuvert=false;
  const surCause = S.view==="lier" ||
    (S.view==="note" && S.draft && etapes(S.draft)[S.step]==="par");
  if(!surCause){ S.cNeuf=false; S.cTxt=""; S.cType=""; S.cQ=""; }
  /* L'interrupteur ne se garde pas : « en plus » oublié d'hier ferait
     démarrer une activité par-dessus une autre sans qu'on l'ait voulu. */
  /* « En plus » vit maintenant sur deux écrans — le pointage et le bouton du
     milieu — et ne survit à aucun des deux : oublié d'hier, il ferait démarrer
     une activité par-dessus une autre sans qu'on l'ait voulu. */
  /* `enPlus` repart à null, pas à false : une position par défaut est un
     choix que l'application fait à sa place, et celui-là arrête un
     compteur (13.dt). */
  if(S.view!=="pointer" && S.view!=="note"){ S.tQ=""; S.tCat=""; S.enPlus=null; S.vifPour=""; S.plusDeb=null; S.poseEn=null; }
  if(S.view!=="pointer" && S.view!=="temps" && S.view!=="bloc" && S.view!=="frise"
     && S.view!=="lecture" && S.view!=="pages" && S.view!=="livre"
     && S.view!=="sujets" && S.view!=="annonce"){ S.blocId=null; S.trou=null; S.trouVif=false; }
  if(S.view!=="sujets" && S.view!=="cahier") S.sjQ="";
  /* 13.et — l'écran des promesses est une question POSÉE SUR un sujet :
     oublier le sujet en y entrant le renverrait au cahier. */
  if(S.view!=="sujet" && S.view!=="promesse") S.sujId=null;
  if(S.view!=="promesse") S.prQ="";
  if(S.view!=="annonce") S.gQ="";
  /* Le calendrier déplié n'a de sens que pendant la capture : le garder
     ferait rouvrir, à la note suivante, une question qui ne se posait
     pas (13.dx). */
  if(S.view!=="note"){ S.qOuv=false; S.dOuv=false; }
  if(S.view!=="lecture"){ S.lu=null; S.luA=null; S.luZ=null; S.luPlein=false; }
  if(S.view!=="pages" && S.view!=="livre"){ S.pgL=null; S.pgA=null; S.pgZ=null; }
  if(S.view!=="auteur") S.auId=null;
  if(S.view!=="livre") S.lvSp=null;
  if(S.view!=="periode") S.perId=null;
  /* On ne rouvre jamais l'application sur une fenêtre passée : revenir à un
     onglet ramène au présent, comme on ouvre toujours sur Aujourd'hui.
     Cette ligne emportait aussi la vue choisie. Ce sont deux ordres de
     choses : la fenêtre dit QUAND on regarde, la vue dit COMMENT — et seul
     le quand doit revenir au présent. La vue, elle, est gardée (13.ee). */
  if(ONGLETS.some(function(o){ return o[0]===S.view; })) S.anc=null;
  (VUES[S.view]||vToday)();
  const onglet = ONGLETS.some(o=>o[0]===S.view);
  const colle = Z.haut && !Z.file;
  haut.hidden = !Z.titre && !Z.retour && !Z.fermer && !colle;
  haut.className = colle ? "libre" : "";
  const rouage = onglet ? `<button class="rouage" data-go="reglages" aria-label="Réglages">${ROUAGE}</button>` : "";
  /* Une barre cachée gardait le contenu de l'écran précédent : invisible,
     mais bien là, avec un second rouage et des identifiants en double. */
  haut.classList.toggle("sousRail", !rail.hidden);
  if(haut.hidden) haut.innerHTML = "";
  if(!haut.hidden && colle){ haut.innerHTML = rouage + Z.haut; }
  else if(!haut.hidden){
    haut.innerHTML =
      (Z.retour ? `<button data-back="1" aria-label="Revenir">${CHEV}<span>Retour</span></button>`
       : Z.fermer ? `<button data-back="1" aria-label="Fermer">${CROIX}</button>`
       : `<button disabled></button>`) +
      `<span class="t">${esc(Z.titre)}</span>` +
      (Z.plus ? `<button data-act="menu" aria-label="Autres actions">•••</button>` : `<button disabled></button>`);
  }
  avance.hidden = !Z.avance;
  if(Z.avance) avance.firstElementChild.style.width = Math.round(Z.avance*100)+"%";
  main.className = haut.hidden ? "plat" : "";
  main.innerHTML = (Z.haut && Z.file ? `<header class="entete">${rouage}${Z.haut}</header>` : "") + Z.html;
  barre.hidden = !Z.action;
  barre.className = onglet ? "surNav" : "";
  if(Z.action) barre.innerHTML = Z.action;
  nav.hidden = !onglet;
  if(onglet){
    /* Deux onglets, le geste, deux onglets. Le milieu d'une barre est la
       seule place qu'on vise sans regarder. */
    const t=ONGLETS.map(([k,l])=>`<button data-go="${k}"${S.view===k?' aria-current="page"':""}>${ICONES[k]||""}<span>${l}</span></button>`);
    nav.innerHTML = t[0]+t[1]
      + `<button class="noter" data-go="note" aria-label="Noter quelque chose"><i>${PLUS}</i><span>Noter</span></button>`
      + t[2]+t[3];
  }
  majChrono();
  main.scrollTop=0;
  place(); requestAnimationFrame(place);
  const f=document.getElementById("cFiltre");
  if(f){ f.value=S.cQ||""; f.dispatchEvent(new Event("input",{bubbles:true})); }
  const tf=document.getElementById("tQ");
  if(tf){ tf.value=S.tQ||""; tf.dispatchEvent(new Event("input",{bubbles:true})); }
  const sf=document.getElementById("sjQ");
  if(sf){ sf.value=S.sjQ||""; sf.dispatchEvent(new Event("input",{bubbles:true})); }
  const gf=document.getElementById("gQ");
  if(gf){ gf.value=S.gQ||""; gf.dispatchEvent(new Event("input",{bubbles:true})); }
  medRend();
  const carr=document.getElementById("carr"), pts=document.getElementById("points");
  if(carr && pts) carr.addEventListener("scroll", ()=>{
    const i=Math.round(carr.scrollLeft/(carr.scrollWidth/pts.children.length));
    for(let k=0;k<pts.children.length;k++) pts.children[k].className = k===i ? "on" : "";
  }, {passive:true});
}

/* ---------- briques Framework7 ---------- */
function liste(contenu, opt){ return `<div class="list list-strong list-outline list-dividers inset ${opt||""}"><ul>${contenu}</ul></div>`; }
function ligne(o){
  const inner = `<div class="item-inner">
      <div class="item-title ${o.serif?"serif voix":""}">${o.titre}${o.sous?`<div class="item-subtitle">${o.sous}</div>`:""}${o.texte?`<div class="item-text">${o.texte}</div>`:""}</div>
      ${o.apres?`<div class="item-after">${o.apres}</div>`:""}</div>`;
  if(o.attr) return `<li><a class="item-link item-content" ${o.attr}>${inner}</a></li>`;
  return `<li><div class="item-content">${inner}</div></li>`;
}
function ligneActe(n, o){
  o=o||{};
  const cls = n.act==="dieu" ? "lui" : (n.act==="gens" ? "gens" : "moi");
  /* « Dieu · rhema · parlé » dit deux fois la même chose : la nature de
     l'acte porte déjà la manière. */
  const pied = [ acteurTxt(n),
                 (n.man && n.kind!=="rhema") ? manCourt(n.man) : "",
                 human(n),
                 /* Les deux dates vont ensemble : le jour promis juste après
                    le jour tenu, sinon on lit deux faits sans rapport. */
                 promisBref(n),
                 (n.etat && n.etat!=="fait") ? ETAT[n.etat] : "",
                 /* 13.en — une ligne peut avoir un mot de plus à dire sur
                    l'acte qu'elle porte : depuis quand il attend. */
                 o.pied || "" ]
               .filter(Boolean).map(esc).join(" · ");
  return `<li><a class="item-link item-content acte" ${o.attr||""}>
      <div class="item-inner"><span class="pt ${cls}"></span>
        <span class="corps"><span class="ph">${cite(n)}</span>${pied?`<span class="pied">${pied}</span>`:""}</span>
        ${o.coche?`<span class="coche">✓</span>`:""}
      </div></a></li>`;
}
function champ(id, ph, type, val, extra){
  return liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
    <input type="${type||"text"}" id="${id}" placeholder="${ph||""}" value="${val||""}" ${extra||""}></div></div></li>`);
}
/* Le rouage est sur les quatre onglets, au même endroit. Un réglage qu'on
   cherche n'est pas un réglage : s'il n'est atteignable que depuis un écran,
   il faut déjà savoir lequel. */
const ROUAGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.6a1.6 1.6 0 0 0 .32 1.77l.06.06a1.95 1.95 0 1 1-2.76 2.76l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.95 1.95 0 0 1-3.9 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.95 1.95 0 1 1-2.76-2.76l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3.4a1.95 1.95 0 0 1 0-3.9h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.95 1.95 0 1 1 2.76-2.76l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.47V3.4a1.95 1.95 0 0 1 3.9 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.95 1.95 0 1 1 2.76 2.76l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.95 1.95 0 0 1 0 3.9h-.09a1.6 1.6 0 0 0-1.47.97Z"/></svg>`;
const OEIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.2 12S5.8 5.6 12 5.6 21.8 12 21.8 12 18.2 18.4 12 18.4 2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const OEIL_CLOS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.2 12S5.8 5.6 12 5.6c1.6 0 3 .37 4.2.95M19.3 8.5c1.6 1.7 2.5 3.5 2.5 3.5S18.2 18.4 12 18.4c-1.6 0-3-.37-4.2-.95"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3.6 3.6l16.8 16.8"/></svg>`;
/* Un mot de passe qu'on ne voit pas se tape mal, et celui-ci n'ouvre pas
   qu'une porte : il ouvre l'archive. Une faute de frappe non vue coûte un
   aller-retour entier, et au deuxième essai raté on choisit un mot plus
   court — c'est-à-dire plus faible. L'œil ne montre que si on le demande,
   et il ne redessine pas l'écran : ce qui est déjà tapé reste tapé. */
function champMdp(id, ph, auto){
  return liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap oeilleton">
    <input type="password" id="${id}" placeholder="${ph||""}" autocomplete="${auto||"current-password"}"
      autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="oeil" type="button" data-act="oeil" aria-label="Montrer le mot de passe">${OEIL}</button>
  </div></div></li>`);
}
function bouton(txt, attr){ return `<a class="button button-large button-fill button-round" ${attr}>${txt}</a>`; }
const PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M12 5.4v13.2M5.4 12h13.2"/></svg>`;
/* Le geste de noter n'est plus posé par chaque écran : il est dans la barre,
   au milieu, sur les quatre onglets. Un geste qui est toujours là n'a pas à
   être redemandé à chaque vue. */
/* Le compteur se réécrit tout seul, sans redessiner l'écran : redessiner
   ferait sauter la lecture en cours à chaque seconde.
   Les secondes défilent — « pour voir comment le temps passe ». Sans elles
   le bandeau semblait arrêté : une minute entière sans qu'un chiffre bouge,
   et on finit par croire que rien n'est compté. Elles sont écrites plus
   petites et plus pâles : le bandeau garde sa voix — « 57 min », « 4 h 20 »
   — et les secondes ne font que montrer que le temps court.
   Seul le chiffre est réécrit, jamais le lien qui l'entoure : réécrire tout
   chaque seconde annulerait une tape commencée. */
let chronoEtat="";
function secondes(ms){ return String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,"0"); }
/* Le rail dit la minute en grand et la seconde en exposant. Sous la minute,
   la grande valeur EST la seconde : la répéter donnerait « 35 s 35 ». */
function railDur(ms){
  return ms<60000 ? esc(hm(ms)) : esc(hm(ms))+`<i>${secondes(ms)}</i>`;
}
/* Le rail disparaissait dès qu'on s'arrêtait, et la chaîne du compte se
   rompait sans bruit : rien à l'écran ne disait qu'on avait cessé de dire.
   Il reste donc, et il continue de compter — non pas une activité, mais
   l'absence d'activité, depuis la fin du dernier bloc. C'est la même idée
   que la bande grise de « Mon temps » (13.bw), portée à l'instant présent :
   le temps non compté n'est pas une inconnue, c'est une réponse par défaut,
   et on la voit courir. Sans seuil ici — c'est tout l'objet que de montrer
   le creux dès la première minute. */
function creuxVif(){
  const a=db.temps||[];
  let fin=0;
  for(let i=0;i<a.length;i++){ if(!a[i].fin) return null; if(a[i].fin>fin) fin=a[i].fin; }
  return fin ? {deb:fin} : null;
}

/* ---------- replier le rail ----------
   Le rail dit une chose vraie en permanence, et c'est pourquoi il a une
   place à lui (13.bt). Mais une place à soi n'est pas un droit de rester :
   on doit pouvoir dégager le haut de l'écran pour lire. Replier n'est donc
   pas masquer — il reste un trait qui respire, et le compte continue.
   Le choix est gardé, avec le bloc pour lequel il a été fait : replier son
   compteur du matin ne doit pas replier d'avance celui du soir. */
const PLIK="ebenezer.rail";
let railPlie=false, railBloc="", railPrevenu=false;
try{ railPlie=localStorage.getItem(PLIK)==="1"; railBloc=localStorage.getItem(PLIK+".b")||""; }catch(e){}
function plieRail(v){
  v=!!v;
  rail.classList.toggle("plie", v);
  if(v===railPlie) return;
  railPlie=v;
  try{ localStorage.setItem(PLIK, v?"1":"0"); }catch(e){}
  place();
}
function railNote(id){
  if(id===railBloc) return;
  railBloc=id; railPrevenu=false;
  try{ localStorage.setItem(PLIK+".b", id||""); }catch(e){}
  plieRail(false);
}
/* ---------- la vue qu'on a sous les yeux ----------
   Un écran à vues répond à plusieurs questions distinctes, une par vue
   (13.cs). La vue revenait à la première à chaque passage par un onglet, si
   bien qu'on arrivait presque toujours sur celle qu'on ne voulait pas : sur
   « Mon temps », onze arrivées sur dix-sept commençaient par une tape pour
   en changer. L'application demande ce qu'elle ne sait pas, et rien d'autre
   (13.cg) — or elle le savait.
   Le choix est gardé sur cet appareil, comme celui du rail replié : la vue
   qu'on aime sur un téléphone n'est pas celle qu'on aime sur un portable, et
   la mettre dans l'archive pousserait `db.maj` à chaque tape, donc une
   synchronisation par tape (13.dn).
   Une table par écran, parce qu'une vue appartient à l'écran qui la pose, et
   qu'un deuxième écran à vues ne doit pas hériter du choix du premier. La
   liste des vues permises est passée par l'appelant : une valeur devenue
   inconnue — une vue retirée depuis — retombe sur celle qui va de soi, au
   lieu de dessiner un écran vide (13.ee). */
const VUEK="ebenezer.vues";
let VUEG={};
try{ VUEG=JSON.parse(localStorage.getItem(VUEK)||"{}")||{}; }catch(e){ VUEG={}; }
function vueDe(ecran, permis, parDefaut){
  const v=VUEG[ecran];
  return permis.indexOf(v)!==-1 ? v : parDefaut;
}
function vueGarde(ecran, v){
  if(!ecran || VUEG[ecran]===v) return;
  VUEG[ecran]=v;
  try{ localStorage.setItem(VUEK, JSON.stringify(VUEG)); }catch(e){}
}

/* Un glissé vertical sur le rail le replie ou le rouvre. On exige un vrai
   mouvement — dix-huit pixels, et plus haut que large — pour qu'un doigt
   qui tremble en tapant n'emporte pas le bandeau. Et on empêche alors la
   tape : sans cela, le glissé ouvrirait aussi le pointage. */
let railDoigt=null;
rail.addEventListener("touchstart", function(ev){
  const t=ev.changedTouches[0]; railDoigt={x:t.clientX, y:t.clientY};
}, {passive:true});
rail.addEventListener("touchend", function(ev){
  if(!railDoigt) return;
  const t=ev.changedTouches[0];
  const dy=t.clientY-railDoigt.y, dx=t.clientX-railDoigt.x;
  railDoigt=null;
  if(Math.abs(dy)<18 || Math.abs(dx)>Math.abs(dy)) return;
  ev.preventDefault();
  plieRail(dy<0);
}, {passive:false});
/* Replié, le trait ne mène plus au pointage : il se rouvre. On intercepte
   à la descente, avant que la tape n'atteigne le lien qu'il contient. */
rail.addEventListener("click", function(ev){
  if(!railPlie) return;
  ev.preventDefault(); ev.stopPropagation();
  plieRail(false);
}, true);
function majChrono(){
  const o=ouvert();
  /* Le rail montrait un creux de treize secondes, et l'écran qu'il ouvre
     n'en savait rien — il ne regarde un vide qu'à partir d'une minute.
     Quatre des douze tapes sur « Rien de compté » tombaient dans ce trou-là :
     on touchait, et on arrivait devant une page qui ne parlait pas de ce
     qu'on venait de toucher. Les deux lisent désormais le même seuil (13.eg,
     13.ea). */
  const v0 = o ? null : creuxVif();
  const vif = (v0 && Date.now()-v0.deb >= SEUIL_CREUX) ? v0 : null;
  const etait=rail.hidden;
  rail.hidden = !o && !vif;
  if(rail.hidden){
    if(!etait){ rail.innerHTML=""; chronoEtat=""; haut.classList.remove("sousRail"); place(); }
    return;
  }
  if(vif){
    const d = Date.now()-vif.deb;
    railNote("creux");
    if(chronoEtat!=="creux" || !rail.firstElementChild){
      chronoEtat="creux";
      rail.innerHTML = `<a class="tic rien" data-act="comblerVif"><i class="pt creux"></i>`
        + `<span class="quoi">Rien de compté</span><span class="dur"></span></a>`;
    }
    rail.classList.toggle("plie", railPlie);
    if(etait){ haut.classList.add("sousRail"); place(); }
    const e=rail.querySelector(".dur");
    if(e) e.innerHTML = railDur(d);
    return;
  }
  const ec = Date.now()-o.deb;
  const vieux = ec>=10*3600000;
  /* Le rail nomme ce qui porte l'heure, et dit d'un chiffre combien
     d'autres tournent à côté. Les empiler ferait grandir le mobilier à
     chaque mission : un rail qui pousse n'est plus un rail. */
  const autres = ouverts().length-1;
  /* Un pointage qui commence rouvre le rail : c'est le reçu du geste qu'on
     vient de faire. Un compteur qui atteint dix heures le rouvre aussi, une
     fois — l'app prévient, puis se tait ; elle ne retient pas la main de
     celui qui le replie à nouveau. */
  railNote(o.id);
  if(vieux && !railPrevenu){ railPrevenu=true; plieRail(false); }
  const etat = o.id+"|"+tacheNom(o.t)+"|"+(vieux?"v":"")+"|"+autres;
  if(etat!==chronoEtat || !rail.firstElementChild){
    chronoEtat=etat;
    /* Arrêter coûtait deux gestes : ouvrir le pointage, puis y toucher la
       ligne d'arrêt. C'était l'écriture la plus fréquente de toutes — onze
       des quarante-trois en deux jours — et le rail disait déjà, sur tous
       les écrans, ce qui tournait. Il manquait seulement de quoi le poser
       (13.ef).
       Le bouton arrête CE QUE LE RAIL NOMME, et rien d'autre : sept des
       neuf arrêts relevés ne fermaient qu'un bloc, et « tout arrêter » est
       un geste de plus, pas le geste par défaut — il reste au pointage, en
       clair. Quand d'autres tournent encore, le rail ne s'en va pas : il
       affiche le suivant, et c'est le reçu du geste qu'on vient de faire. */
    rail.innerHTML = `<a class="tic${vieux?" vieux":""}" data-go="pointer"><i class="pt"></i>`
      + `<span class="quoi">${esc(tacheNom(o.t))}</span>`
      + (autres>0 ? `<span class="pl">+${autres}</span>` : "")
      + `<span class="dur"></span></a>`
      + `<button class="arr" data-stop="${esc(o.id)}" aria-label="Arrêter « ${esc(tacheNom(o.t))} »">Arrêter</button>`;
  }
  /* Le rail qui apparaît ou disparaît décale toute la page : on remesure,
     mais seulement à ce moment-là, jamais à chaque seconde. */
  rail.classList.toggle("plie", railPlie);
  if(etait){ haut.classList.add("sousRail"); place(); }
  const d=rail.querySelector(".dur");
  if(d) d.innerHTML = railDur(ec);
}
setInterval(function(){ if(!document.hidden) majChrono(); }, 1000);
document.addEventListener("visibilitychange", function(){ if(!document.hidden) majChrono(); });
function titreBloc(t, cls){ return `<div class="block-title ${cls||""}">${t}</div>`; }

/* ---------- menu ••• ---------- */
function ouvreMenu(groupes){
  menu.innerHTML = groupes.map(g=>`<div class="actions-group">${
    g.map(b=>b.label ? `<div class="actions-label">${esc(b.label)}</div>`
      : `<div class="actions-button ${b.rouge?"rouge":""}" ${b.attr||""}>${esc(b.txt)}</div>`).join("")
  }</div>`).join("");
  menu.classList.add("modal-in"); fond.classList.add("backdrop-in");
}
function fermeMenu(sec){
  if(!menu.classList.contains("modal-in")) return;
  menu.classList.remove("modal-in"); fond.classList.remove("backdrop-in");
  if(sec) menu.innerHTML="";
}

/* Les barres flottent au-dessus de la liste pour que le verre ait quelque chose
   à flouter. Leurs hauteurs changent d'un écran à l'autre : on les mesure. */
function place(){
  const rH = rail.hidden ? 0 : rail.offsetHeight;
  /* Le rouage est posé sur l'écran, pas sur la page : il ne sait pas qu'une
     barre vient d'apparaître au-dessus de lui. On la lui dit. */
  document.documentElement.style.setProperty("--rail", rH+"px");
  document.body.classList.toggle("avecRail", rH>0);
  const hH = haut.hidden ? 0 : haut.offsetHeight;
  const aH = avance.hidden ? 0 : 2;
  const basH = bas.offsetHeight;
  haut.style.top = rH+"px";
  avance.style.top = (rH+hH)+"px";
  main.style.paddingTop = hH
    ? (rH+hH+aH)+"px"
    : (rH ? (rH+aH+10)+"px"
          : "calc(env(safe-area-inset-top,0px) + "+(aH+10)+"px)");
  /* La pastille centrale déborde du haut de la barre : le contenu doit
     pouvoir défiler au-delà d'elle, sinon la dernière ligne reste dessous. */
  const debord = nav.hidden ? 20 : 46;
  main.style.paddingBottom = basH
    ? (basH+debord)+"px"
    : "calc(env(safe-area-inset-bottom,0px) + 24px)";
}
addEventListener("resize", place);
/* Au tout premier affichage, le téléphone ne connaît pas encore la hauteur de
   sa barre d'accueil, et la police n'est pas arrivée : les barres grandissent
   après coup, et l'action se retrouvait cachée. On replace dès que ça bouge. */
addEventListener("orientationchange", place);
try{
  const o=new ResizeObserver(()=>place());
  o.observe(haut,{box:"border-box"});   /* la bordure, pas le contenu : c'est le
     rembourrage de l'encoche qui grandit, et il n'entre pas dans la boîte de contenu */
  o.observe(bas,{box:"border-box"});
}catch(e){}
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(place); }catch(e){}

