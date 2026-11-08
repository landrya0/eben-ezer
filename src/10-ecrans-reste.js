/* Ében-Ézer — ecrans-reste
   Temps mis à part, lectures, auteurs, réglages, dictée.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- les temps mis à part ----------
   On ne FAIT pas une retraite, on EST en retraite : pendant ces deux jours on
   prie, on lit, on dort, et tout cela se passe DEDANS. Une activité occupe le
   temps ; une retraite l'encadre. La mettre au chronomètre produirait d'ailleurs un chiffre faux — quarante-huit heures de << retraite >> écraseraient
   la semaine entière, et la prière disparaîtrait dans son propre cadre.
   D'où un troisieme objet, à côté de l'acte et du bloc : la période. Deux
   bornes, une routine, et surtout AUCUN poids d'heures (13.cw). */
function periode(id){ return (db.periodes||[]).filter(function(x){ return x.id===id; })[0]; }
function perOuverte(p){ return !!p && typeof p.fin!=="number"; }
function finPer(p){ return perOuverte(p) ? Date.now() : p.fin; }
function perOuvertes(){ return (db.periodes||[]).filter(perOuverte); }
/* Une période compte dans son unité propre : un jeûne se dit en heures, une
   retraite en jours (13.cp). */
function dureePer(p){
  const ms=Math.max(0, finPer(p)-p.deb);
  const j=Math.floor(ms/86400000), h=Math.floor((ms%86400000)/3600000);
  if(!j) return hm(ms);
  return j+" jour"+(j>1?"s":"")+(h ? " "+h+" h" : "");
}
function quandPer(p){
  const c=courtFen("jour", bornes("jour", p.deb)[0]);
  return c.charAt(0).toLowerCase()+c.slice(1)+" à "+hmin(new Date(p.deb));
}
function perTxt(p){
  return perOuverte(p) ? dureePer(p)+" — depuis "+quandPer(p) : dureePer(p);
}
/* Ce qui a été donné à l'intérieur du cadre : c'est à cela qu'une retraite se juge, et c'est tout ce que la période apporte au compte. */
function cumulPer(p){ return cumul(p.deb, finPer(p)); }
/* Les périodes d'une routine donnée, dans la fenêtre regardée. */
function perDisc(d, t0, t1){
  return perDans(t0, t1).filter(function(p){ return p.d===d; });
}
/* Ce qu'une routine encadrée dit d'elle-même : « en cours depuis hier à
   7 h 00 · 1 jour 5 h », ou la somme quand il y en a eu plusieurs. */
function perDiscTxt(ps){
  if(!ps.length) return "";
  if(ps.length===1){
    const p=ps[0];
    return perOuverte(p)
      ? "en cours depuis "+quandPer(p)+" · "+dureePer(p)
      : dureePer(p)+", depuis "+quandPer(p);
  }
  const ouv=ps.filter(perOuverte).length;
  return ps.length+" fois"+(ouv?", dont une en cours":"");
}
/* Les périodes qui touchent la fenêtre regardée, les ouvertes en tête. */
function perDans(t0, t1){
  return (db.periodes||[]).filter(function(p){ return p.deb<t1 && finPer(p)>t0; })
    .sort(function(a,b){ return (perOuverte(b)?1:0)-(perOuverte(a)?1:0) || b.deb-a.deb; });
}

function routineDite(){
  return (db.taches||[]).some(function(t){ return !!discTache(t.id); });
}
function disc(id){ return DISC.filter(function(x){ return x[0]===id; })[0]; }
function discNom(id){ const d=disc(id); return d ? d[1] : ""; }
/* Le nom donne un premier avis — « Nuit de prière Paris » n'est pas la
   prière seul — et l'écran tranche quand le nom se trompe : son avis tient,
   comme pour le type (13.ce). */
function discDeNom(nom){
  const v=String(nom||"");
  if(/bible|parole|écriture|ecriture/i.test(v)) return "parole";
  if(/littérature|litterature/i.test(v)) return "litt";
  if(/retraite/i.test(v)) return "retraite";
  if(/je[uû]ne/i.test(v)) return "jeune";
  if(/rdqd|rencontre/i.test(v)) return "rdqd";
  if(/pri[eè]re|prier/i.test(v))
    return /avec|nuit|culte|r[eé]union|assembl[eé]e|ensemble|groupe/i.test(v) ? "ensemble" : "priere";
  if(/d[iî]me|offrande|donner/i.test(v)) return "donner";
  if(/[âa]me|[eé]vang[eé]lis/i.test(v)) return "ames";
  if(/disciple/i.test(v)) return "former";
  if(/compte.?rendu/i.test(v)) return "cr";
  if(/[eé]glise|assembl[eé]e|culte|r[eé]union/i.test(v)) return "eglise";
  return "";
}
function discTache(id){
  const t=tache(id);
  if(!t) return "";
  return (t.d!==undefined) ? t.d : discDeNom(t.nom);
}
/* Ce que chaque discipline a reçu sur la fenêtre. On part des totaux par
   activité, jamais de l'union : deux activités rattachées à la même
   discipline lui ont bien donné leurs deux temps. */
function parDisc(par){
  const o={};
  Object.keys(par||{}).forEach(function(tid){
    const d=discTache(tid); if(d) o[d]=(o[d]||0)+par[tid];
  });
  return o;
}
/* Un seul attribut sur l'activité : la routine. Les champs qu'on lui demande
   en découlent — les chapitres pour la Bible, les pages pour la littérature
   — au lieu d'être un second réglage qu'il faudrait tenir d'accord avec le
   premier (13.cn). */
function mesureProposee(d){
  if(d==="parole") return "bible";
  if(d==="litt") return "livre";
  /* Trois routines qui ne se comptent ni en chapitres ni en pages : ce qu'on
     y fait, c'est NOMMER. Le disciple tient depuis des années un cahier de
     sujets de prière et un cahier de sujets d'actions de grâces — une ligne
     par sujet, numérotée, datée. On garde sa forme, parce qu'elle est juste :
     le nombre est le nombre de lignes, il tombe tout seul, et chaque ligne
     garde la matière au lieu de la réduire à un chiffre (13.de). */
  if(d==="priere" || d==="rdqd" || d==="ensemble") return "sujets";
  /* Et la conquête des âmes ne se compte ni en chapitres, ni en pages, ni en
     sujets : elle se compte en personnes. « À combien de personnes j'ai
     prêché l'Évangile » est la question, et elle a sa propre unité (13.df). */
  if(d==="ames") return "gens";
  return "";
}
function gensTxt(n){ return n+" personne"+(n>1?"s":""); }
/* Un sujet ne sait pas qu'il a été exaucé : c'est l'acte qui le dit, comme
   un acte dit ses causes et jamais l'inverse. On lit donc à l'envers, à la
   demande — rien à tenir à jour, rien qui puisse se désaccorder le jour où
   l'on corrige un acte (13.dg). */
function exaucesDe(sid){
  return (db.nodes||[]).filter(function(n){ return (n.suj||[]).indexOf(sid)!==-1; }).sort(parDate);
}
function exauceTxt(sid){
  const ns=exaucesDe(sid);
  if(!ns.length) return "";
  const n=ns[ns.length-1];
  return ["Exaucé", human(n), (n.man && n.kind!=="rhema") ? manCourt(n.man) : ""]
         .filter(Boolean).join(" · ");
}
/* Les deux premières colonnes du cahier — le numéro et la date de première
   prière — ne se saisissent pas : elles sont déjà dans l'archive, puisque
   chaque séance dit ce qu'elle a nommé. */
function sujetDepuis(sid){
  let d=null;
  (db.temps||[]).forEach(function(b){
    if((b.sj||[]).indexOf(sid)===-1) return;
    if(d===null || b.deb<d) d=b.deb;
  });
  return d;
}
function sujetFois(sid){
  let n=0;
  (db.temps||[]).forEach(function(b){ if((b.sj||[]).indexOf(sid)!==-1) n++; });
  return n;
}
function sujetHist(sid){
  const d=sujetDepuis(sid), f=sujetFois(sid);
  if(!d) return "";
  return f>1 ? "nommé "+f+" fois, depuis le "+dateJour(d) : "nommé le "+dateJour(d);
}
/* Un sujet n'appartient pas à une séance : il revient. « Merci pour le
   travail » est écrit dix fois dans le cahier, et c'est sa répétition qui se
   lit. On le retrouve donc au lieu de le recréer — à la casse et aux espaces
   près, puisque personne ne retape deux fois la même phrase à l'identique. */
function sujet(id){ return (db.sujets||[]).filter(function(s){ return s.id===id; })[0]; }
function sujetTxt(id){ const s=sujet(id); return s ? s.txt : ""; }
function sujetId(txt){
  const v=String(txt||"").trim().replace(/\s+/g," ");
  if(!v) return null;
  db.sujets=db.sujets||[];
  const k=v.toLowerCase();
  const f=db.sujets.filter(function(s){ return String(s.txt).trim().toLowerCase()===k; })[0];
  if(f) return f.id;
  const id=uid("s"); db.sujets.push({id:id, txt:v, maj:Date.now()}); return id;
}
function sujetsTxt(n){ return n+" sujet"+(n>1?"s":""); }
/* Ce qui revient revient : la santé, l'assemblée, le travail. Les redemander
   en toutes lettres chaque matin ferait payer deux fois ce qui est déjà
   écrit. On tend donc la liste de la dernière fois — de la même routine, pas
   d'une autre : les sujets d'une prière du soir ne sont pas ceux d'une
   rencontre matinale. Mais on n'en coche aucun : un sujet qu'il n'a pas
   nommé ce matin n'a pas été nommé, et un nombre faux est pire que pas de
   nombre (13.de). */
function sujetsDerniers(b){
  if(!b) return [];
  const d=discTache(b.t);
  let der=null;
  (db.temps||[]).forEach(function(x){
    if(x.id===b.id || !(x.sj||[]).length || x.deb>b.deb) return;
    if(discTache(x.t)!==d) return;
    if(!der || x.deb>der.deb) der=x;
  });
  return der ? der.sj.slice() : [];
}
/* Mais une routine se vit sous plusieurs supports, et le support commande la
   mesure : un enseignement suivi en vidéo est de la littérature chrétienne et
   n'a pas de pages. La routine propose donc sa mesure ; l'activité peut la
   refuser, et ne garder que le temps (13.cq). */
function spTache(id){
  const t=tache(id);
  if(!t || t.m===0) return "";
  return mesureProposee(discTache(id));
}
/* L'activité qui porte la lecture : celle qu'on a déclarée telle, et s'il y
   en a plusieurs, celle où l'on passe le plus de temps. */
function tacheBible(){
  const ts=(db.taches||[]).filter(function(t){ return spTache(t.id)==="bible"; });
  if(!ts.length) return "";
  if(ts.length===1) return ts[0].id;
  const freq=cumul(minuit(29), Date.now()).par;
  return ts.slice().sort(function(a,b){ return (freq[b.id]||0)-(freq[a.id]||0); })[0].id;
}

/* On reprend là où l'on s'est arrêté, et « là » se lit dans l'archive : le
   dernier passage noté, au bloc le plus récent. Rien à garder à part — un
   signet qu'on tient à jour soi-même se désaccorde du jour où l'on corrige
   une lecture. Le dernier chapitre du livre fait passer au livre suivant. */
function derniereLu(){
  let der=null;
  (db.temps||[]).forEach(function(b){
    if(!b.lu || !b.lu.length) return;
    if(!der || b.deb>der.deb) der=b;
  });
  return der ? {r:der.lu[der.lu.length-1], b:der} : null;
}
function apresLu(r){
  if(!r) return {li:0, d:1, f:1};
  if(r[2] < nbChap(r[0])) return {li:r[0], d:r[2]+1, f:r[2]+1};
  return {li:(r[0]+1) % BIBLE.length, d:1, f:1};
}
/* Qui lit l'Ancien le matin et le Nouveau le soir a deux signets. Changer de
   livre reprend donc au premier chapitre non lu de CE livre-là, pas au
   premier tout court. */
function repriseLivre(li){
  let m=0;
  (db.temps||[]).forEach(function(b){
    (b.lu||[]).forEach(function(r){ if(r[0]===li && r[2]>m) m=r[2]; });
  });
  return m>=nbChap(li) ? 1 : m+1;
}
/* Deux comptes, et ils ne disent pas la même chose. Sur une fenêtre, on
   compte les chapitres lus — relire Jean 3 trois fois, c'est trois fois
   avoir lu. Sur toute la vie, on compte les chapitres distincts : c'est du
   terrain parcouru, et relire ne l'agrandit pas. La lecture se rattache au
   début de son bloc : un bloc n'appartient qu'à un jour. */
function chapFen(t0, t1){
  let ch=0, p=0;
  (db.temps||[]).forEach(function(b){
    if(!b.lu || !b.lu.length || b.deb<t0 || b.deb>=t1) return;
    b.lu.forEach(function(r){ ch+=nbLu(r); p++; });
  });
  return {ch:ch, p:p};
}
function chapDistincts(tid){
  const vus={};
  (db.temps||[]).forEach(function(b){
    if(tid && b.t!==tid) return;
    (b.lu||[]).forEach(function(r){
      for(let c=r[1]; c<=r[2]; c++) vus[r[0]+"."+c]=1;
    });
  });
  return Object.keys(vus).length;
}

/* Les chapitres mis bout à bout, de Genèse 1 à Apocalypse 22 : une lecture
   continue ne connaît pas les frontières de livres, elle passe de Genèse 50
   à Exode 1 sans s'en apercevoir. Une seule liste peut donc la suivre, et
   c'est elle qui ramène le geste à un seul. */
const BIBLE_DEB = (function(){ const a=[]; let n=0;
  BIBLE.forEach(function(l){ a.push(n); n+=l[1]; }); return a; })();
function plat(li, c){ return BIBLE_DEB[li] + (c-1); }
function dePlat(i){
  i=Math.max(0, Math.min(BIBLE_CH-1, i));
  let li=0; while(li+1<BIBLE.length && BIBLE_DEB[li+1]<=i) li++;
  return {li:li, c:i-BIBLE_DEB[li]+1};
}
function nomPlat(i){ const p=dePlat(i); return nomLivre(p.li)+" "+p.c; }
/* Une traversée continue se range en un passage par livre : c'est ainsi
   qu'elle se relira, et ainsi que les chapitres se comptent. */
function passagesDe(a, z){
  const out=[]; let i=a;
  while(i<=z){
    const p=dePlat(i);
    const bout=Math.min(z, BIBLE_DEB[p.li]+nbChap(p.li)-1);
    out.push([p.li, p.c, dePlat(bout).c]);
    i=bout+1;
  }
  return out;
}
/* La question se pose au moment où elle est naturelle : on vient de fermer
   la lecture, on sait jusqu'où on est allé, et on est déjà là — aucun écran
   à traverser. L'app demande ; elle n'inscrit rien, et Retour suffit à ne
   rien dire. Un bloc trop court a déjà été effacé : on ne demande pas ce
   qu'on a lu en vingt secondes. */
function apresArret(bs, repli){
  const b=(bs||[]).filter(function(x){
    const sp=x ? spTache(x.t) : "";
    return x && blocT(x.id) && (sp==="bible" || sp==="livre" || sp==="sujets" || sp==="gens");
  })[0];
  if(!b) return false;
  S.pile=[]; S.view=repli||"today"; empile();
  S.blocId=b.id;
  S.lu=null; S.luA=null; S.luZ=null; S.luPlein=false;
  S.pgL=null; S.pgA=null; S.pgZ=null;
  S.sjQ=""; S.gQ="";
  const sp=spTache(b.t);
  S.view = sp==="livre" ? "pages" : sp==="sujets" ? "sujets"
         : sp==="gens" ? "annonce" : "lecture";
  return true;
}
function debutPlat(){
  const der=derniereLu();
  const a=apresLu(der && der.r);
  return plat(a.li, a.d);
}
function optsLivres(sel){
  function pan(a, z){
    let o="";
    for(let i=a;i<z;i++) o+=`<option value="${i}"${i===sel?" selected":""}>${esc(BIBLE[i][0])}</option>`;
    return o;
  }
  return `<optgroup label="Ancien Testament">${pan(0, BIBLE_NT)}</optgroup>`
       + `<optgroup label="Nouveau Testament">${pan(BIBLE_NT, BIBLE.length)}</optgroup>`;
}
function optsChap(li, sel, min){
  let o="";
  for(let c=(min||1); c<=nbChap(li); c++) o+=`<option value="${c}"${c===sel?" selected":""}>${c}</option>`;
  return o;
}
function champSel(id, label, corps){
  return `<li class="item-content item-input"><div class="item-inner">
      <div class="item-title item-label">${label}</div>
      <div class="item-input-wrap"><span class="sel"><select id="${id}">${corps}</select></span></div>
    </div></li>`;
}
function listeLu(b){
  return liste(b.lu.map(function(r,i){
    return ligne({titre:esc(nomPassage(r)), sous:chapitresTxt(nbLu(r)),
      apres:`<span class="rouge">Retirer</span>`, attr:'data-lusup="'+i+'"'});
  }).join(""));
}

/* Dire ce qu'on a lu coûtait sept gestes : aller dans Mon temps, faire
   défiler, toucher le bloc, ouvrir l'écran, bouger trois listes, valider.
   Or l'app SAIT où l'on s'est arrêté — elle l'annonçait même en haut de
   l'écran avant de redemander le livre et le chapitre de départ. Elle ne
   demande donc plus qu'une chose : JUSQU'OÙ. Une liste, un geste.
   Le reste — j'ai sauté, j'ai relu, j'ai préparé une prédication dans
   Romains — est le cas rare, et le cas rare ne commande pas la forme du
   geste quotidien : il garde ses trois listes, derrière une ligne (13.cg). */
function vLecture(){
  const b=blocT(S.blocId);
  if(!b){ depile("temps"); return render(); }
  if(S.luPlein) return vLecturePlein(b);
  const der=derniereLu();
  if(S.luA===null || S.luA===undefined){ S.luA=debutPlat(); S.luZ=S.luA; }
  const a=S.luA, z=Math.max(a, S.luZ);
  Z.titre="Ce que tu as lu"; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">${
    !der ? "Tu commences à <b>"+esc(nomPlat(a))+"</b>. Jusqu'où es-tu allé ?"
    : der.b===b ? "Tu reprends à <b>"+esc(nomPlat(a))+"</b>. Jusqu'où es-tu allé ?"
    : "Tu t'étais arrêté à <b>"+esc(nomPassage(der.r))+"</b>. Jusqu'où es-tu allé ?"
  }</div>`;
  h+=titreBloc("Jusqu'où");
  let o="";
  const bout=Math.min(BIBLE_CH-1, a+199);
  for(let i=a;i<=bout;i++) o+=`<option value="${i}"${i===z?" selected":""}>${esc(nomPlat(i))}</option>`;
  h+=liste(champSel("luZ", "Dernier chapitre lu", o));
  const ps=passagesDe(a, z);
  h+=`<div class="block amorce"><b>${esc(ps.map(nomPassage).join(" · "))}</b> — ${chapitresTxt(z-a+1)}.</div>`;
  h+=liste(ligne({titre:"Ce n'est pas là que j'ai commencé",
      sous:"Choisir le livre et les deux bornes", attr:'data-act="luPlein"'}), "lien");
  if((b.lu||[]).length){
    h+=titreBloc("Déjà noté sur ce bloc","ecart");
    h+=listeLu(b);
  }
  Z.html=h;
  Z.action=bouton("Garder", 'data-act="addLuSimple"');
}

/* L'écran ne garde rien avant qu'on le dise : on choisit, on voit ce que ça
   fera, on ajoute. Et il ne se referme pas sur un ajout — une séance traverse
   parfois deux livres, ou saute d'un psaume à une épître. Le passage suivant
   est déjà proposé. */
function vLecturePlein(b){
  const der=derniereLu();
  if(!S.lu) S.lu=apresLu(der && der.r);
  const l=S.lu;
  Z.titre="Ce que tu as lu"; Z.retour=true;
  /* Le même fait, dit deux fois selon qu'il vient d'arriver ou d'hier :
     « la dernière fois » sonne faux trois secondes après l'avoir noté. */
  let h=`<div class="block amorce" style="margin-top:16px">${
    !der ? "Dis le livre et les chapitres traversés. Dès la prochaine fois, l'app reprendra là où tu t'arrêtes."
    : der.b===b ? "Tu viens de noter <b>"+esc(nomPassage(der.r))+"</b>. On continue juste après."
    : "La dernière fois, tu t'es arrêté à <b>"+esc(nomPassage(der.r))+"</b>. On reprend juste après."
  }</div>`;
  h+=titreBloc("Le passage");
  h+=liste(champSel("luLiv", "Le livre", optsLivres(l.li))
         + champSel("luDeb", "Du chapitre", optsChap(l.li, l.d))
         + champSel("luFin", "Jusqu'au chapitre", optsChap(l.li, l.f, l.d)));
  h+=`<div class="block amorce"><b>${esc(nomPassage([l.li, l.d, l.f]))}</b> — ${chapitresTxt(l.f-l.d+1)}.</div>`;
  if((b.lu||[]).length){
    h+=titreBloc("Déjà noté sur ce bloc","ecart");
    h+=listeLu(b);
  }
  Z.html=h;
  Z.action=bouton("Ajouter ce passage", 'data-act="addLu"');
}

/* Ce que l'app demande à une activité se règle une fois, sur l'activité —
   pas à chaque bloc. Un seul réglage pour l'instant, et c'est voulu : on
   n'ouvre pas un atelier de champs sur mesure avant de savoir, à l'usage,
   lesquels manquent vraiment. */
function vTache(){
  const t=tache(S.tchId);
  if(!t){ depile("temps"); return render(); }
  const sp=spTache(t.id);
  Z.titre=t.nom; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">Rangée dans <b>${esc(catNom(t.cat||"reste"))}</b>. C'est ce rangement qui fait les parts.</div>`;
  const dc=discTache(t.id);
  h+=titreBloc("La routine");
  h+=`<div class="block amorce">Les seize routines du message de Bertoua. L'activité garde son nom ; elle dit seulement de laquelle elle est la mise en œuvre — et c'est elle qui décide de ce qu'on te demandera en plus du temps.</div>`;
  h+=liste(champSel("tDisc","Routine",
      `<option value=""${dc?"":" selected"}>— aucune —</option>`
      + DISC.map(function(x){
          return `<option value="${x[0]}"${dc===x[0]?" selected":""}>${esc(x[1])}</option>`;
        }).join("")));
  const prop=mesureProposee(dc);
  if(!prop){
    h+=`<div class="block amorce">Rien de plus que le temps et la note du bloc.</div>`;
  }else{
    h+=titreBloc("Ce qu'on y compte","ecart");
    h+=`<div class="block amorce">${prop==="bible"
      ? "La lecture de la Bible se compte aussi en chapitres — sauf si cette activité-là ne les suit pas."
      : "La lecture de littérature chrétienne se compte aussi en pages. Mais une vidéo, un podcast, un enseignement suivi en ligne n'en ont pas : là, le temps suffit."}</div>`;
    h+=liste(ligne({titre: prop==="bible" ? "Les chapitres lus" : "Les pages lues",
        sous: prop==="bible" ? "Avec la reprise là où tu t'es arrêté" : "Avec un signet par livre",
        apres: sp ? `<span class="coche">✓</span>` : "", attr:'data-mes="1"'})
      + ligne({titre:"Rien de plus que le temps",
        sous:"Pour ce qui ne se compte ni en chapitres ni en pages",
        apres: !sp ? `<span class="coche">✓</span>` : "", attr:'data-mes="0"'}));
  }
  if(sp==="bible"){
    const n=chapDistincts(t.id);
    h+=titreBloc("Ce que tu as traversé","ecart");
    h+=liste(ligne({titre:"Chapitres distincts", sous:"Relire ne l'agrandit pas",
        apres:esc(n+" / "+BIBLE_CH)}));
  }
  /* Un enseignement suivi en vidéo n'a pas de pages (13.cq), mais il a
     quelqu'un derrière : c'est par l'activité qu'on le nomme, puisqu'il n'y a
     pas de livre pour le porter. */
  if(dc==="litt" && !sp){
    h+=titreBloc("L'auteur qu'on suit","ecart");
    h+=`<div class="block amorce">Ce qu'on suit en vidéo ou en podcast n'a pas de pages, mais il a quelqu'un derrière. Ce que tu écris ici se garde tout seul.</div>`;
    h+=champ("tAuteur", "Son nom", "text", t.au?esc(auteurNom(t.au)):"", 'autocapitalize="words"');
    h+=pucesAuteurs("tAuteur");
  }
  if(sp==="livre"){
    h+=titreBloc("Tes livres","ecart");
    h+=liste(((db.livres||[]).map(function(l){
        const vu=pageLue(l.id), tot=l.pages||0;
        const au=l.a?esc(auteurNom(l.a))+" · ":"";
        return ligne({titre:esc(l.nom), sous: au+(livreFini(l) ? "Fini" : "En cours"),
          apres:esc(tot ? vu+" / "+tot : String(vu)), attr:'data-lv="'+l.id+'"'});
      }).join("")) + ligne({titre:"Ajouter un livre", attr:'data-act="livreNeuf"'}));
  }
  Z.html=h;
}


/* ---------- la bibliothèque : où j'en suis dans mes livres ---------- */
/* Même besoin que pour l'Écriture, et une différence qui commande tout : la
   Bible est une liste close que l'app connaît par cœur ; une bibliothèque,
   non. Le disciple la déclare donc — le titre, et le nombre de pages, sans
   quoi « j'en suis à la 84 » ne dit rien d'un avancement.
   Et l'on mène plusieurs livres de front comme on mène plusieurs activités
   de front : chacun garde son propre signet, et c'est le dernier touché qui
   se propose, pour que le cas courant reste à un geste (13.ck). */
/* ---------- ceux dont on reçoit ---------- */
/* Un auteur n'est pas une colonne du livre : c'est quelqu'un dont on reçoit,
   et dont on reçoit par plusieurs voies — trois de ses livres, et ses
   enseignements suivis en vidéo. Une fiche à part, donc, que le livre et
   l'activité désignent tous deux (13.cr). */
/* Un nom propre n'a pas qu'une majuscule : « theodore andoseh » tapé vite
   doit ressortir « Theodore Andoseh ». Mais dès qu'une majuscule est là, on ne
   touche plus à rien — « d'Aubigné », « van Dyke » sont des noms qu'on n'a pas
   à corriger, et un nom mal recapitalisé est un manque d'égard. */
function capNom(t){
  const v=String(t||"").trim().replace(/\s+/g, " ");
  if(/[A-ZÀ-Þ]/.test(v)) return v;
  return v.replace(/(^|[\s\-'’])([a-zà-ÿ])/g, function(m,a,b){ return a+b.toUpperCase(); });
}
function auteur(id){ return (db.auteurs||[]).filter(function(a){ return a.id===id; })[0]; }
function auteurNom(id){ const a=auteur(id); return a ? a.nom : ""; }
function auteurId(nom){
  const v=String(nom||"").trim(); if(!v) return "";
  const a=(db.auteurs||[]).filter(function(x){ return x.nom.toLowerCase()===v.toLowerCase(); })[0];
  if(a) return a.id;
  const id=uid("u");
  db.auteurs=(db.auteurs||[]).concat([{id:id, nom:capNom(v), maj:Date.now()}]);
  return id;
}
/* Rangés sur ce qu'on en a reçu : celui qu'on lit le plus vient en tête, et
   le geste le plus fréquent reste le plus court (13.bb). */
function auteursConnus(){
  const poids={};
  (db.livres||[]).forEach(function(l){ if(l.a) poids[l.a]=(poids[l.a]||0)+1; });
  (db.taches||[]).forEach(function(t){ if(t.au) poids[t.au]=(poids[t.au]||0)+1; });
  return (db.auteurs||[]).slice().sort(function(x,y){
    return (poids[y.id]||0)-(poids[x.id]||0) || x.nom.localeCompare(y.nom); });
}
/* Ce qu'on a reçu d'un homme : ses livres, les pages qu'on y a lues, et les
   heures passées avec ce qu'il enseigne — par le livre ou par la vidéo. */
function recuDe(aid){
  const lv=(db.livres||[]).filter(function(l){ return l.a===aid; });
  const ts=(db.taches||[]).filter(function(t){ return t.au===aid; });
  let pages=0, ms=0;
  const sien={};
  lv.forEach(function(l){ sien[l.id]=1; pages+=pageLue(l.id); });
  (db.temps||[]).forEach(function(b){
    const t=tache(b.t);
    const parLivre=(b.pg||[]).some(function(r){ return sien[r[0]]; });
    if(parLivre || (t && t.au===aid)) ms+=Math.max(0, finDe(b)===SANSFIN ? Date.now()-b.deb : b.fin-b.deb);
  });
  return {livres:lv, taches:ts, pages:pages, ms:ms};
}
function recuTxt(r){
  const p=[];
  if(r.livres.length) p.push(r.livres.length+" livre"+(r.livres.length>1?"s":""));
  if(r.pages) p.push(pagesTxt(r.pages));
  if(r.ms) p.push(hm(r.ms));
  return p.length ? p.join(" · ") : "Rien encore";
}
function pucesAuteurs(champId){
  const a=auteursConnus();
  if(!a.length) return "";
  return `<div class="puces">`+a.map(function(x){
    return `<button class="puce" data-aut="${x.id}" data-pour="${champId}">${esc(x.nom)}</button>`;
  }).join("")+`</div>`;
}
function livre(id){ return (db.livres||[]).filter(function(l){ return l.id===id; })[0]; }
function livreNom(id){ const l=livre(id); return l ? l.nom : "—"; }
function livrePages(id){ const l=livre(id); return (l && l.pages>0) ? l.pages : 0; }
function livreId(nom, pages, aut){
  const v=String(nom||"").trim(); if(!v) return "";
  const l=(db.livres||[]).filter(function(x){ return x.nom.toLowerCase()===v.toLowerCase(); })[0];
  if(l){
    let bouge=false;
    if(pages>0 && l.pages!==pages){ l.pages=pages; bouge=true; }
    if(aut!==undefined && l.a!==aut){ l.a=aut; bouge=true; }
    if(bouge) touche(l);
    return l.id;
  }
  const id=uid("l");
  db.livres=(db.livres||[]).concat([{id:id, nom:cap(v), pages:pages>0?pages:0,
                                     a:aut||"", maj:Date.now()}]);
  return id;
}
/* Le signet se lit dans l'archive, jamais tenu à jour à part : la page la
   plus avancée qu'on ait notée dans ce livre-là. */
function pageLue(lid){
  let m=0;
  (db.temps||[]).forEach(function(b){
    (b.pg||[]).forEach(function(r){ if(r[0]===lid && r[2]>m) m=r[2]; });
  });
  return m;
}
/* Fini, c'est soit la dernière page atteinte, soit le disciple qui le dit —
   on repose un livre avant la fin, et ce n'est pas à l'app d'en juger. */
function livreFini(l){
  if(!l) return false;
  if(l.fini) return true;
  return l.pages>0 && pageLue(l.id)>=l.pages;
}
function livresOuverts(){ return (db.livres||[]).filter(function(l){ return !livreFini(l); }); }
function dernierLivre(){
  let der="", quand=-1;
  (db.temps||[]).forEach(function(b){
    (b.pg||[]).forEach(function(r){ if(b.deb>quand){ quand=b.deb; der=r[0]; } });
  });
  const l=der ? livre(der) : null;
  if(l && !livreFini(l)) return l.id;
  const ouv=livresOuverts();
  return ouv.length ? ouv[0].id : (l ? l.id : "");
}
function pagesTxt(n){ return n+" page"+(n>1?"s":""); }
function nomPassagePg(r){
  const n=livreNom(r[0]);
  return r[1]===r[2] ? n+", page "+r[1] : n+", pages "+r[1]+" à "+r[2];
}
function passagesPgTxt(b){ return (b.pg||[]).map(nomPassagePg).join(" · "); }
function pagesFen(t0, t1){
  let pg=0, p=0;
  (db.temps||[]).forEach(function(b){
    if(!b.pg || !b.pg.length || b.deb<t0 || b.deb>=t1) return;
    b.pg.forEach(function(r){ pg+=r[2]-r[1]+1; p++; });
  });
  return {pg:pg, p:p};
}
function tacheLivre(){
  const ts=(db.taches||[]).filter(function(t){ return spTache(t.id)==="livre"; });
  if(!ts.length) return "";
  if(ts.length===1) return ts[0].id;
  const freq=cumul(minuit(29), Date.now()).par;
  return ts.slice().sort(function(a,b){ return (freq[b.id]||0)-(freq[a.id]||0); })[0].id;
}
function listePg(b){
  return liste(b.pg.map(function(r,i){
    return ligne({titre:esc(nomPassagePg(r)), sous:pagesTxt(r[2]-r[1]+1),
      apres:`<span class="rouge">Retirer</span>`, attr:'data-pgsup="'+i+'"'});
  }).join(""));
}

function listeSj(b){
  return liste((b.sj||[]).map(function(id,i){
    const ex=exauceTxt(id);
    return ligne({titre:esc(sujetTxt(id)),
      sous:ex?`<span class="exauce">${esc(ex)}</span>`:"",
      apres:`<span class="rouge">Retirer</span>`, attr:'data-sjsup="'+i+'"'});
  }).join(""));
}
function ligneSj(id){
  const t=sujetTxt(id), ex=exauceTxt(id);
  return ligne({titre:esc(t), sous:ex?`<span class="exauce">${esc(ex)}</span>`:"",
    attr:'data-sjadd="'+id+'" data-sjn="'+esc(t.toLowerCase())+'"'});
}
/* L'écran du cahier. Il ne se referme pas sur un ajout : une séance en nomme
   trente, et refermer à chaque fois ferait trente allers-retours. On écrit,
   ça s'ajoute, le champ se vide, on continue — et ce qui est déjà nommé
   reste sous les yeux, parce que c'est ainsi qu'on sait où l'on en est. */
function vSujets(){
  const b=blocT(S.blocId);
  if(!b){ depile("temps"); return render(); }
  Z.titre="Ce que tu as nommé"; Z.retour=true;
  const sur=(b.sj||[]), pris={};
  sur.forEach(function(id){ pris[id]=1; });
  let h=`<div class="block amorce" style="margin-top:16px">Un sujet par ligne, comme dans ton cahier. Ce qui revient, tu le retrouves d'un geste.</div>`;
  if(sur.length){
    h+=titreBloc("Nommés ici — "+sujetsTxt(sur.length));
    h+=listeSj(b);
  }
  h+=titreBloc(sur.length ? "En nommer un autre" : "Les nommer", "ecart");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
    <input type="text" id="sjQ" placeholder="Chercher, ou nommer un sujet" value="${esc(S.sjQ||"")}" autocomplete="off" autocapitalize="sentences"></div></div></li>`);
  h+=`<div class="list list-strong list-outline list-dividers inset" id="sjNeuf" hidden><ul>${
      ligne({titre:`<span class="qn"></span>`, attr:'data-act="sjAdd"'})}</ul></div>`;
  const der=sujetsDerniers(b).filter(function(id){ return !pris[id] && sujet(id); });
  const vus={}; der.forEach(function(id){ vus[id]=1; });
  if(der.length)
    h+=`<div class="sjgrp">`+titreBloc("La dernière fois","ecart")+liste(der.map(ligneSj).join(""))+`</div>`;
  const autres=(db.sujets||[]).filter(function(s){ return !pris[s.id] && !vus[s.id]; })
    .sort(function(a,b2){ return (b2.maj||0)-(a.maj||0); });
  if(autres.length)
    h+=`<div class="sjgrp">`+titreBloc("Déjà nommés, une autre fois","ecart")
      + liste(autres.map(function(s){ return ligneSj(s.id); }).join(""))+`</div>`;
  Z.html=h;
  Z.action=bouton("Terminé", 'data-back="1"');
}

/* Le même cahier, une autre unité. Mais une différence qui commande tout :
   on prêche à des foules, et on ne peut pas nommer une foule. Une ligne sans
   nom est donc une ligne entière — quelqu'un a entendu l'Évangile, et c'est
   le fait qui compte, pas le fichier. Le nom, quand on l'a, relie cette
   annonce au reste du mémorial : à la personne, et aux actes de Dieu sur
   elle (13.df). */
function listeQui(b){
  return liste((b.qui||[]).map(function(id,i){
    const n = id ? gensNom(id) : "";
    return ligne({titre: n ? esc(n) : `<span class="amorce">Quelqu'un que tu n'as pas nommé</span>`,
      apres:`<span class="rouge">Retirer</span>`, attr:'data-qsup="'+i+'"'});
  }).join(""));
}
function ligneQui(g){
  return ligne({titre:esc(g.nom), attr:'data-qadd="'+g.id+'" data-gn="'+esc(String(g.nom).toLowerCase())+'"'});
}
function vAnnonce(){
  const b=blocT(S.blocId);
  if(!b){ depile("temps"); return render(); }
  Z.titre="À qui tu as annoncé"; Z.retour=true;
  const sur=(b.qui||[]), pris={};
  sur.forEach(function(id){ if(id) pris[id]=1; });
  let h=`<div class="block amorce" style="margin-top:16px">Une ligne par personne. Celles que tu peux nommer, nomme-les ; les autres comptent quand même.</div>`;
  if(sur.length){
    h+=titreBloc("Ici — "+gensTxt(sur.length));
    h+=listeQui(b);
  }
  h+=titreBloc(sur.length ? "En ajouter" : "Les compter", "ecart");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
    <input type="text" id="gQ" placeholder="Chercher, ou nommer quelqu'un" value="${esc(S.gQ||"")}" autocomplete="off" autocapitalize="words"></div></div></li>`);
  h+=`<div class="list list-strong list-outline list-dividers inset" id="gNeuf" hidden><ul>${
      ligne({titre:`<span class="qn"></span>`, attr:'data-act="qAdd"'})}</ul></div>`;
  h+=liste(ligne({titre:"Quelqu'un que je ne nomme pas",
      sous:"Une personne de plus, sans nom", attr:'data-act="qAnon"'}), "lien");
  const connus=(db.gens||[]).filter(function(g){ return !pris[g.id]; })
    .sort(function(a,b2){ return (b2.maj||0)-(a.maj||0); });
  if(connus.length)
    h+=`<div class="ggrp">`+titreBloc("Déjà dans ton mémorial","ecart")
      + liste(connus.map(ligneQui).join(""))+`</div>`;
  Z.html=h;
  Z.action=bouton("Terminé", 'data-back="1"');
}

/* Une seule liste, comme pour l'Écriture : le départ est le signet, et la
   seule question est jusqu'où. Les autres livres entamés sont là, en
   pastilles — changer de livre reste un geste, pas un écran. */
function vPages(){
  const b=blocT(S.blocId);
  if(!b){ depile("temps"); return render(); }
  Z.titre="Ce que tu as lu"; Z.retour=true;
  if(!(db.livres||[]).length){
    Z.html=`<div class="block amorce" style="margin-top:16px">Aucun livre n'est encore déclaré. Dis-en un — son titre et son nombre de pages — et l'app tiendra ton signet dedans.</div>`
      + liste(ligne({titre:"Ajouter un livre", attr:'data-act="livreNeuf"'}), "lien");
    return;
  }
  if(!S.pgL || !livre(S.pgL)) S.pgL = dernierLivre() || db.livres[0].id;
  const l=livre(S.pgL), tot=livrePages(l.id), vue=pageLue(l.id);
  if(S.pgA===null || S.pgA===undefined){
    S.pgA = tot ? Math.min(tot, vue+1) : vue+1;
    S.pgZ = S.pgA;
  }
  const a=S.pgA, z=Math.max(a, S.pgZ);
  let h=`<div class="block amorce" style="margin-top:16px">${
    vue ? "Tu reprends <b>"+esc(l.nom)+"</b> à la page <b>"+a+"</b>. Jusqu'où es-tu allé ?"
        : "Tu commences <b>"+esc(l.nom)+"</b>. Jusqu'où es-tu allé ?"
  }</div>`;
  const ouv=livresOuverts();
  if(ouv.length>1 || (ouv.length===1 && ouv[0].id!==l.id) || (db.livres||[]).length>1){
    h+=`<div class="puces">${(db.livres||[]).filter(function(x){ return !livreFini(x) || x.id===l.id; })
      .map(function(x){ return `<button class="puce" data-pgl="${x.id}" aria-pressed="${x.id===l.id}">${esc(x.nom)}</button>`; }).join("")}</div>`;
  }
  h+=titreBloc("Jusqu'où");
  let o="";
  const bout = tot ? tot : a+500;
  for(let i=a;i<=bout;i++) o+=`<option value="${i}"${i===z?" selected":""}>${i}</option>`;
  h+=liste(champSel("pgZ", "Dernière page lue", o));
  const reste = tot ? Math.max(0, tot-z) : 0;
  h+=`<div class="block amorce"><b>${esc(nomPassagePg([l.id,a,z]))}</b> — ${pagesTxt(z-a+1)}.${
    !tot ? "" : (reste ? " Il te restera "+pagesTxt(reste)+" sur "+tot+"." : " Tu l'auras terminé.")}</div>`;
  h+=liste(ligne({titre:"Un autre livre", sous:"En ajouter un, ou corriger ses pages",
      attr:'data-act="livreNeuf"'})
    + ligne({titre:"Ce livre", sous:esc(l.nom)+(tot?" — "+tot+" pages":" — pages inconnues"),
      attr:'data-lv="'+l.id+'"'}), "lien");
  if((b.pg||[]).length){
    h+=titreBloc("Déjà noté sur ce bloc","ecart");
    h+=listePg(b);
  }
  Z.html=h;
  Z.action=bouton("Garder", 'data-act="addPg"');
}

/* Un livre est une fiche minuscule — un titre, un nombre de pages — et
   c'est le nombre de pages qui fait tout le reste : sans lui, « page 84 »
   est un chiffre sans horizon. */
function vLivre(){
  const l=S.lvId ? livre(S.lvId) : null;
  Z.titre = l ? "Ce livre" : "Un livre"; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">Le titre, et le nombre de pages — c'est lui qui permet de dire où tu en es, et ce qu'il te reste.</div>`;
  h+=titreBloc("Le titre");
  h+=champ("lvNom", "Le titre du livre", "text", l?esc(l.nom):"", 'autocapitalize="sentences"');
  h+=titreBloc("L'auteur","ecart");
  h+=`<div class="block amorce">Qui l'a écrit. On garde la liste, pour savoir de qui tu reçois.</div>`;
  h+=champ("lvAuteur", "Son nom", "text", (l&&l.a)?esc(auteurNom(l.a)):"", 'autocapitalize="words"');
  h+=pucesAuteurs("lvAuteur");
  h+=titreBloc("Le nombre de pages","ecart");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <input type="number" id="lvPages" inputmode="numeric" min="1" max="9999" placeholder="240" value="${(l&&l.pages)?l.pages:""}"></div></div></li>`);
  if(l){
    const vue=pageLue(l.id);
    h+=titreBloc("Où tu en es","ecart");
    h+=liste(ligne({titre:"Page atteinte", apres:esc(String(vue)+(l.pages?" / "+l.pages:""))})
      + ligne({titre: l.fini ? "Finalement, je ne l'ai pas fini" : "Je l'ai fini",
               sous: l.fini ? "Il reviendra dans les livres en cours" : "Il quittera les livres en cours",
               attr:'data-act="livreFin"'}));
  }
  Z.html=h;
  Z.action=bouton(l?"Garder":"Ajouter ce livre", 'data-act="livreGarder"');
}

/* L'auteur avait une fiche sans écran : on pouvait le nommer, pas le
   corriger, et deux orthographes d'un même homme restaient deux hommes. Ici
   il se renomme, on voit ce qu'on a reçu de lui, et deux fiches se réunissent
   (13.ct). */
function vAuteur(){
  const a=S.auId ? auteur(S.auId) : null;
  if(!a){ depile("temps"); return render(); }
  const r=recuDe(a.id);
  Z.titre=a.nom; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">Ce que tu as reçu de lui : <b>${esc(recuTxt(r))}</b>.</div>`;
  h+=titreBloc("Son nom");
  h+=champ("auNom", "Son nom", "text", esc(a.nom), 'autocapitalize="words"');
  if(r.livres.length){
    h+=titreBloc("Ses livres","ecart");
    h+=liste(r.livres.map(function(l){
      const vu=pageLue(l.id), tot=l.pages||0;
      return ligne({titre:esc(l.nom), sous: livreFini(l) ? "Fini" : "En cours",
        apres:esc(tot ? vu+" / "+tot : String(vu)), attr:'data-lv="'+l.id+'"'});
    }).join(""));
  }
  if(r.taches.length){
    h+=titreBloc("Ce que tu suis de lui","ecart");
    h+=liste(r.taches.map(function(t){
      return ligne({titre:esc(t.nom), sous:esc(catNom(t.cat||"reste")),
        attr:'data-tch="'+t.id+'"'});
    }).join(""));
  }
  /* Réunir, et non supprimer : on ne perd jamais ce qui était rattaché, on le
     transporte. C'est la seule façon de rattraper « T. Andoseh » écrit un
     jour et « Theodore Andoseh » un autre. */
  const autres=auteursConnus().filter(function(x){ return x.id!==a.id; });
  if(autres.length){
    h+=titreBloc("Réunir avec un autre","ecart");
    h+=`<div class="block amorce">Si c'est le même homme écrit deux fois. Ses livres et ce que tu suis de lui passeront sur l'autre fiche, et celle-ci disparaîtra.</div>`;
    h+=liste(champSel("auFus","L'autre fiche",
        `<option value="">— choisis —</option>`
        + autres.map(function(x){ return `<option value="${x.id}">${esc(x.nom)}</option>`; }).join("")));
    h+=liste(ligne({titre:"Réunir les deux", attr:'data-act="auReunir"'}), "lien");
  }
  Z.html=h;
  Z.action=bouton("Garder", 'data-act="auGarder"');
}

function vBloc(){
  const b=blocT(S.blocId);
  if(!b){ depile("temps"); return render(); }
  const v=voisins(b), court=!b.fin;
  Z.titre="Ce bloc"; Z.retour=true;
  let h=titreBloc("L'activité");
  h+=liste(ligne({titre:esc(tacheNom(b.t)), sous:esc(catNom(tacheCat(b.t))),
      attr:'data-act="corrBloc"'}), "lien");
  /* Deux heures de prière ne disent pas ce qui s'y est passé. Le compte pèse
     le temps ; la note garde ce que le temps a produit — et elle tient à
     cette occurrence-là, pas à l'activité, qui revient tous les jours.
     Texte libre pour l'instant : ce qu'on écrit librement pendant des
     semaines dira de lui-même quelles questions poser plus tard. */
  h+=titreBloc("Ce qui s'y est passé","ecart");
  h+=`<div class="block amorce">Ce que tu écris ici se garde tout seul.</div>`;
  h+=`<div class="block"><textarea class="dicte petit" id="bNote" placeholder="Ce que tu as vu, reçu, compris, ou simplement fait…" style="min-height:84px">${esc(b.note||"")}</textarea>${micBloc("bNote")}</div>`;
  /* La question n'est posée qu'à qui peut y répondre : demander des chapitres
     à un trajet encombrerait l'écran sans rien recueillir. */
  if(spTache(b.t)==="bible"){
    h+=titreBloc("Ce que tu as lu","ecart");
    if((b.lu||[]).length) h+=listeLu(b);
    h+=liste(ligne({titre:(b.lu||[]).length ? "Ajouter un passage" : "Dire les chapitres lus",
        sous:"Le livre et les chapitres traversés", attr:'data-act="direLu"'}), "lien");
  }
  if(spTache(b.t)==="livre"){
    h+=titreBloc("Ce que tu as lu","ecart");
    if((b.pg||[]).length) h+=listePg(b);
    h+=liste(ligne({titre:(b.pg||[]).length ? "Ajouter un passage" : "Dire les pages lues",
        sous:"Le livre et les pages traversées", attr:'data-act="direPg"'}), "lien");
  }
  if(spTache(b.t)==="sujets"){
    h+=titreBloc("Ce que tu as nommé","ecart");
    if((b.sj||[]).length) h+=listeSj(b);
    h+=liste(ligne({titre:(b.sj||[]).length ? "En nommer un autre" : "Dire ce que tu as nommé",
        sous:"Les sujets, un par ligne", attr:'data-act="direSj"'}), "lien");
  }
  if(spTache(b.t)==="gens"){
    h+=titreBloc("À qui tu as annoncé","ecart");
    if((b.qui||[]).length) h+=listeQui(b);
    h+=liste(ligne({titre:(b.qui||[]).length ? "En ajouter" : "Dire à qui tu as annoncé",
        sous:"Une ligne par personne", attr:'data-act="direQui"'}), "lien");
  }
  h+=titreBloc("Le début","ecart");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <input type="datetime-local" id="bDeb" value="${dtl(b.deb)}"></div></div></li>`);
  if(v.avant.length)
    h+=`<div class="block amorce">Juste avant : ${nomVoisins(v.avant)}. Ce bloc-là ne bougera pas : reculer ce début mène les deux de front, l'avancer laisse un creux — que tu pourras combler.</div>`;
  h+=titreBloc("La fin","ecart");
  h+=liste(ligne({titre:"C'est toujours en cours",
      apres: court ? `<span class="coche">✓</span>` : "", attr:'data-act="bCours"'}));
  if(!court){
    h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
        <input type="datetime-local" id="bFin" value="${dtl(b.fin)}"></div></div></li>`);
    if(v.apres.length)
      h+=`<div class="block amorce">Juste après : ${nomVoisins(v.apres)}. Ce bloc-là ne bougera pas non plus : prolonger cette fin mène les deux de front, l'écourter laisse un creux.</div>`;
  } else {
    h+=`<div class="block amorce">Le compte court encore. Pose une heure de fin pour l'arrêter à ce moment-là, même s'il est passé.</div>`;
  }
  const ap=actesPdt(b.id);
  h+=titreBloc("Ce qu'Il y a fait","ecart");
  h+= ap.length
    ? liste(ap.map(function(x){ return ligneActe(x,{attr:'data-node="'+x.id+'"'}); }).join(""))
    : `<div class="block amorce">Deux heures ne disent pas ce qui s'y est passé. Si Dieu y a parlé ou agi, garde-le ici : l'acte saura d'où il est venu.</div>`;
  h+=liste(ligne({titre:`<span class="coche">Noter ce qu'Il a fait pendant ce temps</span>`,
      attr:'data-pdtneuf="'+b.id+'"'}));
  h+=liste(ligne({titre:`<span class="rouge">Effacer ce bloc</span>`, attr:'data-act="delBlocIci"'}));
  Z.html=h;
  Z.action=bouton("Garder", 'data-act="majBloc"');
  if(S.noteFocus){
    S.noteFocus=false;
    setTimeout(function(){
      const e=document.getElementById("bNote");
      if(!e) return;
      e.focus();
      try{ e.setSelectionRange(e.value.length, e.value.length); }catch(x){}
    }, 60);
  }
}

/* ---------- déclarer un temps passé ---------- */
/* Rien n'est écrit tant que les deux heures ne tiennent pas : on ne pose pas
   un bloc à moitié vrai dans l'archive pour le corriger ensuite. L'écran ne
   fait que remplir le même creux que ceux de la liste, et c'est le chemin du
   creux qui l'enregistre — un seul endroit sait comment un vide se comble. */
function vQuand(){
  const q=S.quand||{deb:Date.now()-3600000, fin:Date.now()};
  Z.titre="Quand était-ce ?"; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">Ce qui a eu lieu avant qu'on le compte s'écrit à la main. Pose les deux heures ; tu diras ensuite à quoi ce temps est allé.</div>`;
  h+=titreBloc("Le début");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <input type="datetime-local" id="qDeb" value="${dtl(q.deb)}"></div></div></li>`);
  h+=titreBloc("La fin","ecart");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <input type="datetime-local" id="qFin" value="${dtl(q.fin)}"></div></div></li>`);
  Z.html=h;
  Z.action=bouton("À quoi ?", 'data-act="poseQuand"');
}

/* ---------- régler la synchronisation ---------- */
const SQL = `create table if not exists etat (
  uid   uuid primary key references auth.users on delete cascade,
  doc   text not null,
  jalon text not null,
  maj   timestamptz not null default now()
);
alter table etat enable row level security;
create policy "le mien" on etat for all
  using (auth.uid() = uid) with check (auth.uid() = uid);

insert into storage.buckets (id, name, public, file_size_limit)
values ('pieces', 'pieces', false, 26214400)
on conflict (id) do nothing;

create policy "les miennes" on storage.objects for all to authenticated
  using (bucket_id = 'pieces'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pieces'
         and (storage.foldername(name))[1] = auth.uid()::text);`;
function val(id){ const e=document.getElementById(id); return e ? e.value : ""; }
function syEtat(){
  if(!SY.actif) return "Non réglée";
  if(SY.err) return "Arrêtée — "+syDit({message:SY.err});
  if(!SY.fait) return "Jamais synchronisé";
  const d=Date.now()-SY.fait;
  if(d<90000) return "À jour";
  if(d<3600000) return "À jour il y a "+Math.round(d/60000)+" min";
  if(d<86400000) return "Dernière fois à "+hmin(new Date(SY.fait));
  return "Dernière fois le "+new Date(SY.fait).toLocaleDateString("fr-FR");
}
function vSync(){
  if(SUPA.url && !SY.url){ SY.url=SUPA.url; SY.cle=SUPA.cle; sySave(); }
  const fourni = !!SUPA.url && !S.syPropre;
  Z.titre="Synchronisation"; Z.retour=true;
  let e = SY.actif ? 9 : (S.syEtape||0);
  if(e===0 && fourni) e=1;
  /* Tant qu'il n'a pas dit l'avoir noté, le code revient : fermer
     l'application au mauvais moment ne doit pas le lui coûter. */
  if(SY.aVoir){ S.syCode=SY.aVoir; e=2; }
  let h="";
  if(e===9){
    h+=`<div class="block amorce" style="margin-top:18px">Cet appareil est relié. Tout ce que tu notes ici arrive sur l'autre, et l'inverse — même si les deux ont travaillé hors ligne chacun de leur côté.</div>`;
    h+=liste(ligne({titre:"État", apres:esc(syEtat())})+
             ligne({titre:"Compte", apres:esc(SY.mail)})+
             ligne({titre:"Cet appareil", apres:esc(DEV)}));
    h+=liste(ligne({titre:"Synchroniser maintenant", attr:'data-act="syManuel"'}), "lien");
    const pj=medTout();
    if(pj.length){
      const voy=pj.filter(function(m){ return MED_VOYAGE[m.genre]; });
      const reste=pj.length-voy.length;
      h+=titreBloc("Les pièces jointes","ecart");
      h+=`<div class="block amorce">Les photos et les sons suivent, chiffrés comme le reste : personne d'autre que toi ne peut les ouvrir, pas même le serveur. ${
        reste ? `Les vidéos, non — ${reste===1?"la tienne est trop lourde":"les tiennes sont trop lourdes"} pour un dépôt partagé, et ${reste===1?"elle reste là où elle a été filmée":"elles restent là où elles ont été filmées"}.`
              : "Les vidéos ne suivent pas : trop lourdes pour un dépôt partagé."}</div>`;
      h+=liste(ligne({titre:"Qui voyagent", apres:voy.length+" · "+esc(poids(voy.reduce(function(t,m){ return t+(m.taille||0); },0)))})+
               ligne({titre:"Déjà déposées d'ici", apres:String(voy.filter(function(m){ return PJ.haut[m.id]; }).length)}));
    }
    h+=titreBloc("Au cas où","ecart");
    h+=`<div class="block amorce">Détacher laisse l'archive intacte sur ce téléphone et le laisse simplement de côté. Tu pourras le rattacher avec le même mot de passe.</div>`;
    h+=liste(ligne({titre:`<span class="rouge">Détacher cet appareil</span>`, attr:'data-act="syDetache"'}));
    Z.html=h; return;
  }
  Z.avance=(e+1)/3;
  if(e===0){
    h+=`<div class="block amorce" style="margin-top:18px">Sur <b>supabase.com</b> : crée un compte, puis un projet. Trois choses à y faire, dans l'ordre :</div>`;
    h+=liste(ligne({titre:"1. SQL Editor", texte:"Colle le texte ci-dessous et exécute-le. C'est la table, et la règle qui fait que toi seul la lis."})+
             ligne({titre:"2. Authentication → Sign In / Providers → Email", texte:"Décoche <b>Confirm email</b>. Sans ça, Supabase attend que tu cliques un lien reçu par courriel avant de te laisser entrer."})+
             ligne({titre:"3. Project Settings → API Keys", texte:"Recopie ici l'URL du projet et la clé <b>publishable</b>."}));
    h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
        <textarea id="sql" readonly style="min-height:150px;font-size:11.5px">${esc(SQL)}</textarea></div></div></li>`);
    h+=liste(ligne({titre:"Copier ce texte", attr:'data-act="copieSql"'}), "lien");
    h+=titreBloc("Les deux valeurs","ecart");
    h+=champ("syUrl","https://xxxx.supabase.co","url",esc(SY.url||""));
    h+=champ("syCle","Clé publishable (un long jeton)","text",esc(SY.cle||""));
    h+=`<div class="block amorce">La clé <b>publishable</b> est faite pour être publique : seule la règle posée plus haut décide qui lit quoi. Ne colle jamais la clé <b>secret</b>.</div>`;
    Z.action=bouton("Continuer", 'data-act="syProjet"');

  } else if(e===1){
    h+=`<div class="block amorce" style="margin-top:18px">Ton adresse et un mot de passe. La première fois, le compte se crée tout seul ; ensuite c'est la même chose sur la tablette.</div>`;
    h+=champ("syMail","toi@exemple.com","email",esc(SY.mail||""),
             'autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false"');
    h+=champMdp("syMdp","Mot de passe");
    h+=`<div class="block amorce">Ce mot de passe fait deux métiers : il ouvre la porte du serveur, et lui seul ouvre l'archive. Le serveur, lui, ne voit qu'un bloc illisible — <b>personne d'autre que toi ne peut lire ce que tu écris ici</b>, ni moi, ni celui qui héberge.</div>`;
    if(fourni)
      h+=liste(ligne({titre:"Héberger chez moi", texte:"Donner mon propre projet Supabase", attr:'data-act="syPropre"'}), "lien");
    Z.action=bouton("Se connecter", 'data-act="syEntre"');

  } else if(e===2){
    /* Le seul moment où ce code existe en clair quelque part. Après, il est
       sous enveloppe et personne — pas même cette page — ne peut le relire. */
    h+=`<div class="block amorce" style="margin-top:18px">C'est en route. Il reste <b>une chose</b>, et elle ne se représentera plus.</div>`;
    h+=titreBloc("Ton code de récupération","ecart");
    h+=`<div class="block"><div class="code">${esc(S.syCode||"")}</div></div>`;
    h+=liste(ligne({titre:"Copier le code", attr:'data-act="copieCode"'}), "lien");
    h+=`<div class="block amorce">Écris-le quelque part de sûr : dans ta Bible, chez ton gestionnaire de mots de passe, sur un papier rangé. <b>Il n'est montré qu'ici, cette fois-ci.</b></div>`;
    h+=`<div class="block amorce">Il sert le jour où tu oublies ton mot de passe : lui seul rouvrira ton archive. Sans lui et sans cet appareil, elle restera close — c'est le prix de ce que personne ne puisse la lire.</div>`;
    h+=titreBloc("Et pendant qu'on y est","ecart");
    h+=liste(ligne({titre:"Sortir un fichier de sauvegarde", texte:"Une copie en clair, sur cet appareil", attr:'data-act="fichier"'}), "lien");
    Z.action=bouton("Je l'ai noté", 'data-act="syNote"');

  } else {
    h+=`<div class="block amorce" style="margin-top:18px">Ce mot de passe n'ouvre pas cette archive. Il a dû changer depuis, et le serveur ne garde rien qui permette de le retrouver. Ton <b>code de récupération</b>, lui, la rouvrira — et le mot de passe que tu viens de taper reprendra la main ensuite.</div>`;
    h+=champ("syRec","XXXX-XXXX-XXXX-XXXX-XXXX","text","");
    h+=`<div class="block amorce">Si tu n'as plus ce code, il n'y a pas d'autre porte : c'est ce qui fait que personne ne lit ton journal. Mais l'archive reste entière sur l'appareil où tu la tiens — pars de celui-là, et rattache celui-ci ensuite.</div>`;
    Z.action=bouton("Récupérer", 'data-act="syRecupere"');
  }
  Z.html=h;
}

/* ---------- réglages ---------- */
/* La configuration n'a rien à faire en bas d'un écran de lecture : elle y
   était, à la suite des chiffres, et personne n'irait l'y chercher. Un seul
   endroit, atteint du même rouage depuis n'importe quel onglet. Ce qu'on
   règle une fois et ce qu'on relit tous les jours ne se mélangent pas. */
function vReglages(){
  Z.titre="Réglages"; Z.retour=true;
  const sauve = db.exp
    ? "Dernière fois le "+new Date(db.exp).toLocaleDateString("fr-FR")
    : "Jamais sauvegardé";
  Z.html = `<div style="height:10px"></div>`
    + titreBloc("Sur mes deux appareils")
    + liste(ligne({titre:"Synchronisation", sous:esc(syEtat()), attr:'data-go="sync"'}), "lien")
    + titreBloc("Mon archive","ecart")
    + liste(ligne({titre:"Mes données", sous:esc(sauve), attr:'data-go="data"'}), "lien")
    + titreBloc("Cette application","ecart")
    + liste(ligne({titre:"Version", apres:esc(VERSION)}))
    + liste(ligne({titre:"Chercher une mise à jour", sous:"Va voir s'il y en a une, puis recharge",
                   attr:'data-act="maj"'}), "lien");
}

/* ---------- mes données ---------- */
/* Rien ne part d'ici tout seul : il n'y a pas de serveur, et un journal où
   des gens sont nommés ne se dépose pas sur le premier entrepôt venu sans
   qu'on l'ait décidé. Alors un fichier, qu'on sort et qu'on range où l'on
   veut — iCloud, un courriel à soi-même. L'app dit la date de la dernière
   fois ; c'est elle qui prévient, c'est le disciple qui sauvegarde. */
function vData(){
  Z.titre="Mes données"; Z.retour=true;
  const q = db.exp
    ? "Dernière sauvegarde : le "+new Date(db.exp).toLocaleDateString("fr-FR")+"."
    : "Tu n'as encore jamais sauvegardé.";
  const vieux = !db.exp || (Date.now()-db.exp) > 14*86400000;
  Z.html = `<div class="block amorce" style="margin-top:18px">Tout est gardé sur ce téléphone, et nulle part ailleurs. ${vieux?`<b>${q}</b>`:q} Sors un fichier de temps en temps et garde-le ailleurs : c'est ta seule assurance.</div>
    ${(function(){ const m=medTout();
        return m.length ? `<div class="block amorce"><b>${m.length}</b> fichier${m.length>1?"s":""} joint${m.length>1?"s":""} — ${esc(poids(medPoids()))}. Ils partent avec la sauvegarde, et c'est eux qui en font le poids.</div>` : ""; })()}
    ${liste(ligne({titre:"Sortir un fichier", sous:"À envoyer dans iCloud, ou à toi-même", attr:'data-act="fichier"'})+
            ligne({titre:"Reprendre un fichier", sous:"Remplace tout par celui que tu choisis", attr:'data-act="ouvreFichier"'}), "lien")}
    <input type="file" id="fin" accept=".json,application/json,text/plain" hidden>
    ${titreBloc("À la main","ecart")}
    ${liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <textarea id="dump" style="min-height:120px;font-size:12px">${esc(JSON.stringify(db))}</textarea></div></div></li>`)}
    ${liste(ligne({titre:"Remplacer par ce texte", attr:'data-act="restore"'})+
            ligne({titre:`<span class="rouge">Tout effacer</span>`, attr:'data-act="askWipe"'}))}`;
  Z.action = bouton("Copier", 'data-act="copy"');
}

/* Depuis n'importe quel onglet, le geste reste à portée. */
function vListe(f){ return function(){ f(); }; }


/* ---------- pendant quoi ----------
   Suivre un enseignement pendant deux heures est une recherche aussi réelle
   qu'une prière notée. Le temps mesure ce que je donne, le mémorial garde ce
   qu'Il a fait : il manquait le fil entre les deux. Un acte peut donc nommer
   ce PENDANT quoi il est arrivé — un bloc, ou un temps mis à part (13.cx).

   Le lien part toujours de l'acte. Le registre du temps ne garde rien : il
   ignore qu'on le montre du doigt (13.ax).

   Et il reste distinct de « en réponse à ». Celui-la affirme une cause et
   entre dans la preuve ; celui-ci dit une circonstance. Les confondre
   fabriquerait des liens de cause que personne n'a affirmés. */
function pdtDe(id){
  if(!id) return null;
  const b=blocT(id);
  if(b) return {kind:"bloc", id:id, nom:tacheNom(b.t), d:discTache(b.t),
                deb:b.deb, fin:finDe(b), quand:hmin(new Date(b.deb))};
  const pr=periode(id);
  if(pr) return {kind:"periode", id:id, nom:discNom(pr.d), d:pr.d,
                 deb:pr.deb, fin:finPer(pr), quand:quandPer(pr)};
  return null;
}
/* Ce qui tournait au moment où l'on note : l'application connaît déjà la réponse, elle n'a pas à la demander. */
function pdtCandidats(){
  const o=[];
  ouverts().forEach(function(b){
    o.push({id:b.id, nom:tacheNom(b.t), sous:"en cours depuis "+hmin(new Date(b.deb))});
  });
  perOuvertes().forEach(function(pr){
    o.push({id:pr.id, nom:discNom(pr.d), sous:"temps mis à part — "+dureePer(pr)});
  });
  return o;
}
function actesPdt(id){ return (db.nodes||[]).filter(function(n){ return n.pdt===id; }).sort(parDate); }
/* Et par routine, sur la fenêtre regardée : combien de fois Il a répondu là-dedans. C'est ce que le lien permet enfin de déduire. */
function actesParDisc(t0, t1){
  const o={};
  (db.nodes||[]).forEach(function(n){
    if(!n.pdt || n.act!=="dieu") return;
    const x=pdtDe(n.pdt);
    if(!x || !x.d) return;
    /* La circonstance dit de quelle routine l'acte relève ; elle ne dit pas
       quand il est arrivé. Se régler sur son étendue faisait paraître la
       parole de ce matin sur le compte rendu d'hier, dès que l'écoute avait
       enjambé minuit. L'acte appartient au jour où il est arrivé (13.da). */
    const sp=spanActe(n);
    if(!sp || sp[0]>=t1 || sp[1]<=t0) return;
    o[x.d]=(o[x.d]||0)+1;
  });
  return o;
}
function choixPendant(d){
  const cands=pdtCandidats(), cur=d.pdt ? pdtDe(d.pdt) : null;
  if(!cands.length && !cur) return "";
  const vus={}; let l="";
  if(cur){
    vus[cur.id]=1;
    l+=ligne({titre:esc(cur.nom), sous:esc(cur.quand),
      apres:`<span class="coche">✓</span>`, attr:'data-pdt="'+cur.id+'"'});
  }
  cands.forEach(function(c){
    if(vus[c.id]) return;
    l+=ligne({titre:esc(c.nom), sous:esc(c.sous), attr:'data-pdt="'+c.id+'"'});
  });
  return titreBloc("Pendant quoi")+liste(l)
    + `<div class="block amorce">Ce que tu donnais quand c'est arrivé. Touche à nouveau pour le retirer.</div>`;
}

/* ---------- un temps mis à part ---------- */
function vPerNeuf(){
  Z.titre="Mettre un temps à part"; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">Une retraite, un jeûne : ce n'est pas une activité qu'on chronomètre, c'est un cadre. Il ne pèse aucune heure — il dit seulement à l'intérieur de quoi tout le reste se passe.</div>`;
  h+=titreBloc("Laquelle");
  h+=liste(champSel("pdDisc","Routine",
      DISC.map(function(x){
        return `<option value="${x[0]}"${x[0]==="retraite"?" selected":""}>${esc(x[1])}</option>`;
      }).join("")));
  h+=titreBloc("Depuis quand","ecart");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <input type="datetime-local" id="pdDeb" value="${dtl(Date.now())}"></div></div></li>`);
  h+=`<div class="block amorce">Ce qui a commencé hier se date d'hier : une période n'a pas à commencer au moment où l'on pense à l'inscrire.</div>`;
  Z.html=h;
  Z.action=bouton("Commencer", 'data-act="perCommencer"');
}
function vPeriode(){
  const pr=S.perId ? periode(S.perId) : null;
  if(!pr){ depile("temps"); return render(); }
  const c=cumulPer(pr), ouverte=perOuverte(pr);
  Z.titre=discNom(pr.d); Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px"><b>${esc(dureePer(pr))}</b>, depuis ${esc(quandPer(pr))}${ouverte?" — et ce n'est pas fini":""}.</div>`;
  /* Une retraite se juge à ce qu'on y a mis : c'est tout ce que la période
     apporte au compte, et elle n'y ajoute pas une minute à elle. */
  h+=titreBloc("Ce que tu y as donné");
  if(!c.tot){
    h+=`<p class="vide">Rien de compté dedans pour l'instant.</p>`;
  } else {
    const pd=parDisc(c.par);
    h+=liste(ligne({titre:"En tout", apres:esc(hm(c.tot))})
      + Object.keys(pd).sort(function(x,y){ return pd[y]-pd[x]; })
          .map(function(k){ return ligne({titre:esc(discNom(k)), apres:esc(hm(pd[k]))}); }).join(""));
  }
  h+=titreBloc("Ce qui s'y passe","ecart");
  h+=`<div class="block amorce">Ce que tu écris ici se garde tout seul.</div>`;
  h+=`<div class="block"><textarea class="dicte petit" id="pdNote" placeholder="Ce que tu cherches, ce que tu as reçu…" style="min-height:84px">${esc(pr.note||"")}</textarea>${micBloc("pdNote")}</div>`;
  h+=titreBloc("Le début","ecart");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <input type="datetime-local" id="pdDeb" value="${dtl(pr.deb)}"></div></div></li>`);
  h+=titreBloc("La fin","ecart");
  h+=liste(ligne({titre:"C'est toujours en cours",
      apres: ouverte ? `<span class="coche">✓</span>` : "", attr:'data-act="perCours"'}));
  if(!ouverte){
    h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
        <input type="datetime-local" id="pdFin" value="${dtl(pr.fin)}"></div></div></li>`);
  } else {
    h+=`<div class="block amorce">Personne ne referme un temps mis à part à ta place : touche la ligne du dessus quand il sera fini.</div>`;
  }
  const ap=actesPdt(pr.id);
  h+=titreBloc("Ce qu'Il y a fait","ecart");
  h+= ap.length
    ? liste(ap.map(function(x){ return ligneActe(x,{attr:'data-node="'+x.id+'"'}); }).join(""))
    : `<div class="block amorce">Une retraite se juge à ce qu'on y a mis — et à ce qu'Il y a répondu.</div>`;
  h+=liste(ligne({titre:`<span class="coche">Noter ce qu'Il a fait pendant</span>`,
      attr:'data-pdtneuf="'+pr.id+'"'}));
  h+=liste(ligne({titre:`<span class="rouge">Effacer</span>`, attr:'data-act="perEffacer"'}));
  Z.html=h;
  Z.action=bouton("Garder", 'data-act="perGarder"');
}

const VUES = {today:vToday, oeuvres:vListe(vOeuvres), revel:vListe(vRevel), actes:vListe(vActes), chemin:vChemin, faits:vFaits,
              note:vNote, node:vNode, edit:vEdit, lier:vLier, data:vData,
              pointer:vPointer, temps:vMonTemps, bloc:vBloc, quand:vQuand, frise:vFrise,
              tache:vTache, lecture:vLecture, pages:vPages, livre:vLivre, auteur:vAuteur,
              sujets:vSujets, annonce:vAnnonce,
              perNeuf:vPerNeuf, periode:vPeriode, epingles:vEpingles,
              sync:vSync, reglages:vReglages};

/* ---------- dictée ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec=null, recId=null, recTail="";
function micBloc(id){
  if(!SR) return `<p class="amorce" style="margin-top:12px">Tu peux dicter : touche le micro de ton clavier.</p>`;
  return `<div style="margin-top:14px"><button class="micro" data-mic="${id}">${MICSVG} Dicter</button></div>`;
}
function colle(a,b){ if(!a) return b; return /\s$/.test(a) ? a+b : a+" "+b; }
function micArret(){
  if(rec){ try{ rec.onend=null; rec.stop(); }catch(e){} }
  rec=null; recId=null; recTail="";
  [].forEach.call(document.querySelectorAll("[data-mic]"),b=>{ b.classList.remove("on"); b.innerHTML=MICSVG+" Dicter"; });
}
function micBascule(id){
  if(!SR) return;
  if(rec && recId===id) return micArret();
  micArret();
  const el=document.getElementById(id); if(!el) return;
  try{ rec=new SR(); }catch(e){ return toast("Dictée indisponible ici"); }
  rec.lang="fr-FR"; rec.interimResults=true; rec.continuous=true;
  /* On n'ajoute que ce qui vient d'être dit : ce que le disciple efface reste effacé. */
  rec.onresult=e=>{
    let fini="", provisoire="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const r=e.results[i];
      if(r.isFinal) fini+=r[0].transcript; else provisoire+=r[0].transcript;
    }
    let base=el.value;
    if(recTail && base.slice(-recTail.length)===recTail) base=base.slice(0,base.length-recTail.length);
    if(fini.trim()) base=colle(base,fini.trim());
    recTail = provisoire ? (base&&!/\s$/.test(base) ? " " : "")+provisoire : "";
    el.value = base+recTail;
    el.dispatchEvent(new Event("input",{bubbles:true}));
  };
  rec.onerror=ev=>{
    const m={"not-allowed":"Micro refusé — autorise-le dans les réglages","service-not-allowed":"Dictée indisponible ici","no-speech":"Je n'ai rien entendu"};
    toast(m[ev.error]||"Dictée indisponible ici"); micArret();
  };
  rec.onend=()=>micArret();
  try{ rec.start(); }catch(e){ return toast("Dictée indisponible ici"); }
  recId=id;
  const b=document.querySelector('[data-mic="'+id+'"]');
  if(b){ b.classList.add("on"); b.innerHTML=MICSVG+" J'écoute… toucher pour arrêter"; }
}

/* ---------- saisies gardées ---------- */
/* Une note n'est pas une correction : on ne la valide pas, on l'écrit.
   Elle ne tenait qu'au bouton « Garder », et sortir par Retour la jetait
   sans un mot — or sortir par Retour est le geste naturel quand on vient
   d'écrire. Elle se garde donc d'elle-même : à la frappe, en quittant le
   champ, et en quittant l'écran (13.cd). */
let noteT=null;
function gardeNote(){
  clearTimeout(noteT); noteT=null;
  if(S.view==="periode"){
    const pr=periode(S.perId); if(!pr) return;
    const av=pr.note||"";
    notePer(pr);
    if((pr.note||"")!==av){ touche(pr); save(); }
    return;
  }
  if(S.view!=="bloc") return;
  const b=blocT(S.blocId); if(!b) return;
  const av=b.note||"";
  noteBloc(b);
  if((b.note||"")!==av){ touche(b); save(); }
}
document.addEventListener("focusout", function(ev){
  if(ev.target && (ev.target.id==="bNote" || ev.target.id==="pdNote")) gardeNote();
}, true);
document.addEventListener("input", ev=>{
  const id=ev.target.id;
  if(id==="bNote"){ clearTimeout(noteT); noteT=setTimeout(gardeNote, 900); return; }
  /* Changer de livre reprend au premier chapitre non lu de ce livre-là, et
     une fin plus tôt que le début n'existe pas : l'écran se redessine, et
     les trois listes restent d'accord entre elles. */
  if(id==="luZ"){ S.luZ=+ev.target.value; return render(); }
  if(id==="pgZ"){ S.pgZ=+ev.target.value; return render(); }
  /* Un réglage d'activité, pas un état d'écran : il se garde tout seul. */
  if(id==="tDisc"){
    const t=tache(S.tchId);
    if(t){ t.d=ev.target.value; touche(t); save(); toast("Noté."); }
    return render();
  }
  if(id==="luLiv" || id==="luDeb" || id==="luFin"){
    if(!S.lu) return;
    const v=+ev.target.value;
    if(id==="luLiv"){ const d=repriseLivre(v); S.lu={li:v, d:d, f:d}; }
    else if(id==="luDeb"){ S.lu.d=v; if(S.lu.f<v) S.lu.f=v; }
    else S.lu.f=v;
    return render();
  }
  if(id==="cNeuf"){ S.cTxt=ev.target.value; return; }
  if(id==="cFiltre"){
    const q=ev.target.value.trim().toLowerCase();
    S.cQ=ev.target.value;
    let vus=0;
    [].forEach.call(document.querySelectorAll("[data-par],[data-sujp]"), el=>{
      const li=el.closest("li")||el;
      const ok = el.getAttribute("data-sel")==="1"
              || (!!q && el.textContent.toLowerCase().indexOf(q)!==-1);
      li.hidden = !ok; if(ok) vus++;
    });
    const rien=document.getElementById("rien"),
          att=document.getElementById("attente");
    /* Deux listes se cherchent du même mot — les actes gardés, et les sujets
       nommés — et chacune se replie sur son propre compte : un bloc vide
       avec son titre dirait qu'on n'a rien, alors que l'autre a répondu. */
    [].forEach.call(document.querySelectorAll(".cands"), function(bl){
      bl.hidden = !bl.querySelectorAll("li:not([hidden])").length;
    });
    if(rien) rien.hidden = !(q && !vus);
    if(att)  att.hidden  = !!q || !!vus;
    return;
  }
  /* Redessiner à chaque lettre ferait sauter le curseur : on cache et on
     montre, et le clavier reste où il est. */
  if(id==="tQ"){
    const q=ev.target.value.trim().toLowerCase();
    S.tQ=ev.target.value;
    let exact=false;
    [].forEach.call(document.querySelectorAll("[data-nom]"), el=>{
      const li=el.closest("li")||el, nom=el.getAttribute("data-nom")||"";
      const ok = !q || nom.indexOf(q)!==-1;
      li.hidden=!ok; if(nom===q) exact=true;
    });
    [].forEach.call(document.querySelectorAll(".tgrp"), g=>{
      g.hidden = !g.querySelectorAll("li:not([hidden])").length;
    });
    const nf=document.getElementById("tNeuf");
    if(nf){
      nf.hidden = !q || exact;
      const b=nf.querySelector(".qn");
      if(b) b.textContent="Compter « "+cap(ev.target.value.trim())+" »";
    }
    return;
  }
  /* Le même rouage que la recherche d'activité : on cache et on montre au
     lieu de redessiner, sinon le curseur saute à chaque lettre et le clavier
     se referme — sur un écran où l'on tape trente fois de suite. */
  if(id==="sjQ"){
    const q=ev.target.value.trim().toLowerCase();
    S.sjQ=ev.target.value;
    let exact=false;
    [].forEach.call(document.querySelectorAll("[data-sjn]"), el=>{
      const li=el.closest("li")||el, nom=el.getAttribute("data-sjn")||"";
      const ok = !q || nom.indexOf(q)!==-1;
      li.hidden=!ok; if(nom===q) exact=true;
    });
    [].forEach.call(document.querySelectorAll(".sjgrp"), g=>{
      g.hidden = !g.querySelectorAll("li:not([hidden])").length;
    });
    const nf=document.getElementById("sjNeuf");
    if(nf){
      nf.hidden = !q || exact;
      const bq=nf.querySelector(".qn");
      if(bq) bq.textContent="Nommer « "+cap(ev.target.value.trim())+" »";
    }
    return;
  }
  if(id==="gQ"){
    const q=ev.target.value.trim().toLowerCase();
    S.gQ=ev.target.value;
    let exact=false;
    [].forEach.call(document.querySelectorAll("[data-gn]"), el=>{
      const li=el.closest("li")||el, nom=el.getAttribute("data-gn")||"";
      const ok = !q || nom.indexOf(q)!==-1;
      li.hidden=!ok; if(nom===q) exact=true;
    });
    [].forEach.call(document.querySelectorAll(".ggrp"), g=>{
      g.hidden = !g.querySelectorAll("li:not([hidden])").length;
    });
    const nf=document.getElementById("gNeuf");
    if(nf){
      nf.hidden = !q || exact;
      const bq=nf.querySelector(".qn");
      if(bq) bq.textContent="Compter « "+capNom(ev.target.value.trim())+" »";
    }
    return;
  }
  if(id==="nTxt" && S.draft){ S.draft.txt=ev.target.value; majRef(); }
  if(id==="nDesc" && S.draft) S.draft.desc=ev.target.value;
  if(id==="nDate" && S.draft) S.draft.date=ev.target.value;
});

