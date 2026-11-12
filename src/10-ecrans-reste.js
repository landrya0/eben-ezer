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
/* 13.em — une devinette n'a pas le droit de se faire passer pour un choix.
   Le nom donne un premier avis, et cet avis est bon la plupart du temps ;
   ce n'est pas une raison pour l'afficher du même air qu'une routine dite.
   Tant que le disciple ne l'a pas dite, l'app compte avec — elle ne peut
   pas l'affirmer. L'absence du champ, et non sa valeur, est ce qui le dit :
   « aucune routine » est un choix possible, et il s'écrit "". */
function discDevine(id){ const t=tache(id); return !!t && !("d" in t); }
function tachesDevinees(){
  return (db.taches||[]).filter(function(t){ return !("d" in t); })
    .map(function(t){ return {t:t, ms:heuresTache(t.id).ms}; })
    .sort(function(a,b){ return b.ms-a.ms; });
}
function msDevinees(){
  return tachesDevinees().reduce(function(n,x){ return n+x.ms; }, 0);
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
function sujetBlocs(sid){
  return (db.temps||[]).filter(function(b){ return (b.sj||[]).indexOf(sid)!==-1; });
}
/* 13.es — l'importunité. Le mot est de lui : « quand je commence à prier pour
   quelqu'un, ou pour un sujet, je dois avoir un compteur, bouton +, pour
   incrémenter le nombre de fois que je fais cette demande ». L'ami qui frappe
   à minuit obtient par son importunité et non par amitié : frapper une fois de
   plus est un ACTE, pas une statistique, et l'application ne frappe pas à sa
   place (P9).
   13.eq le déduisait des séances. C'était faux de part en part : il demande en
   voiture, la nuit, hors de toute séance pointée — et une séance qui parcourt
   la liste n'est pas trente-huit demandes.
   Une fois est une FICHE, et non un nombre rangé dans le sujet : deux
   appareils qui frappent chacun de leur côté additionnent leurs fois au lieu
   d'en écraser une (13.bd), la tape de trop se retire une à une (13.cl), et la
   plus ancienne date la première prière — la colonne que son cahier a déjà,
   lui qui n'a justement pas de compteur. */
function impsDe(sid){
  return (db.imps||[]).filter(function(x){ return x.s===sid; })
    .sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
}
function impFois(sid){ return impsDe(sid).length; }
function impDernier(sid){ const l=impsDe(sid); return l.length ? (l[0].ts||0) : 0; }
function impPremier(sid){ const l=impsDe(sid); return l.length ? (l[l.length-1].ts||0) : 0; }
function importune(sid){
  if(!sujet(sid)) return null;
  db.imps=db.imps||[];
  const x={id:uid("i"), s:sid, ts:Date.now(), maj:Date.now()};
  db.imps.push(x);
  return x;
}
/* Ce qui se lit d'un compteur en une ligne. Sans engagement il se dit seul ;
   avec, il se dit sur le nombre que LUI a fixé — jamais l'application. */
function impTxt(s){
  if(!s) return "";
  const f=impFois(s.id), n=sujetBut(s);
  if(!n) return f ? "Demandé "+f+" fois" : "Jamais demandé";
  return "Demandé "+f+" fois sur "+n+(f>=n ? " — tu l'as fait" : "");
}
/* La première prière : la plus ancienne trace, d'où qu'elle vienne. */
function sujetDepuis(sid){
  let d=null;
  sujetBlocs(sid).forEach(function(b){ if(d===null || b.deb<d) d=b.deb; });
  const i=impPremier(sid);
  if(i && (d===null || i<d)) d=i;
  return d;
}
function sujetFois(sid){ return seancesDe(sid).length; }
/* 13.es — frapper, c'est aussi porter : une tape est un signe au même titre
   qu'une séance pointée. Sans cela on lui reprocherait une attente le jour
   même où il vient de demander. */
function sujetDernier(sid){
  let d=null;
  sujetBlocs(sid).forEach(function(b){ if(d===null || b.deb>d) d=b.deb; });
  const i=impDernier(sid);
  if(i && (d===null || i>d)) d=i;
  return d;
}
/* Les séances où ce sujet a été nommé, de la plus récente à la plus
   ancienne : l'histoire du sujet, et non son compteur — celui-là se tape
   à la main (13.es). Elle compte des prières, pas des blocs. Une prière coupée en quatre et
   reprise trois fois est UNE fois : la compter quatre ferait dire au cahier
   qu'on a porté ce sujet quatre jours, et un nombre faux est pire que pas
   de nombre (13.ch, 13.eh). De chaque séance on garde le bloc le plus
   ancien qui nomme le sujet — c'est lui qui en date la fois.
   Un seul passage sur les blocs de l'activité, et non un seanceDe() par
   bloc : le cahier appelle ceci une fois par ligne, et la fenêtre « Tout »
   compte des milliers de blocs — refaire le tri à chaque fois serait
   quadratique, comme pour les tranches de la journée. */
function seancesDe(sid){
  const bs=sujetBlocs(sid);
  if(!bs.length) return [];
  const cat={}; bs.forEach(function(b){ cat[b.t]=1; });
  const out=[];
  Object.keys(cat).forEach(function(t){
    const mm=(db.temps||[]).filter(function(x){ return x.t===t; })
      .slice().sort(function(x,y){ return x.deb-y.deb; });
    let garde=null;
    mm.forEach(function(x, i){
      if(!(i>0 && suitDe(mm[i-1], x))) garde=null;
      if((x.sj||[]).indexOf(sid)===-1) return;
      if(garde) return;
      garde=x; out.push(x);
    });
  });
  return out.sort(function(a,b){ return b.deb-a.deb; });
}
/* 13.es — ce qu'une ligne dit d'un sujet : combien de fois il a frappé, et
   depuis quand. Les séances ne s'appellent plus des « fois » : elles restent
   de l'histoire, et les deux nombres ne se confondent jamais. */
function sujetHist(sid){
  const d=sujetDepuis(sid);
  if(!d) return "";
  if(!impFois(sid)){
    const n=sujetFois(sid);
    return n>1 ? "nommé dans "+n+" séances, depuis le "+dateJour(d)
               : "nommé le "+dateJour(d);
  }
  return impTxt(sujet(sid))+", depuis le "+dateJour(d);
}
/* Un sujet n'appartient pas à une séance : il revient. « Merci pour le
   travail » est écrit dix fois dans le cahier, et c'est sa répétition qui se
   lit. On le retrouve donc au lieu de le recréer — à la casse et aux espaces
   près, puisque personne ne retape deux fois la même phrase à l'identique. */
function sujet(id){ return (db.sujets||[]).filter(function(s){ return s.id===id; })[0]; }
/* 13.ek — un sujet pris dans une liste n'est plus une chaîne de caractères :
   il porte l'identifiant de ce dont il s'agit, et son libellé se relit de là.
   Un frère renommé renomme son sujet. Le texte gardé dans la fiche est un
   repli, pour le jour où ce qu'elle vise a disparu. */
function sujetTxt(id){
  const s=sujet(id); if(!s) return "";
  if(s.lie){
    if(String(s.lie).charAt(0)==="g"){ const n=gensNom(s.lie); if(n) return "Pour "+n; }
    else { const n=node(s.lie); if(n && n.txt) return n.txt; }
  }
  return s.txt;
}
function sujetDeLie(lie){
  const f=(db.sujets||[]).filter(function(s){ return s.lie===lie; })[0];
  return f ? f.id : null;
}
function sujetLie(lie, txt){
  db.sujets=db.sujets||[];
  const f=sujetDeLie(lie); if(f) return f;
  const id=uid("s"); db.sujets.push({id:id, txt:txt, lie:lie, maj:Date.now()}); return id;
}
/* Ce qu'on porte en prière, l'application le tient déjà : les gens, et ce qui
   attend. « Ce qui attend » est exactement ce qu'Aujourd'hui lui remonte — le
   prévu en retard, l'acte de Dieu resté sans réponse de lui. Les retaper
   serait lui faire recopier son propre mémorial (13.cg, 13.ek). On plafonne :
   une liste de prière est une liste, pas l'archive entière. */
const SJ_TEND = 5;
function sujetsAttente(){
  const vus={}, o=[];
  const prends=function(n){ if(n && !vus[n.id]){ vus[n.id]=1; o.push(n); } };
  (db.nodes||[]).filter(function(n){
      return n.etat==="prevu" && !sansDate(n) && n.date && n.date<=today(); })
    .sort(parDateAsc).slice(0, SJ_TEND).forEach(prends);
  dieuNodes().filter(function(n){
      return !enfants(n.id).some(function(e){ return e.act==="moi"; }); })
    .sort(parDateAsc).slice(0, SJ_TEND).forEach(prends);
  return o;
}
function ligneTend(lie, titre, sous){
  return ligne({titre:esc(titre), sous:sous?esc(sous):"",
    attr:'data-sjlie="'+lie+'" data-sjn="'+esc(String(titre).toLowerCase())+'"'});
}
/* Les deux groupes tendus. Un libellé déjà pris ailleurs sur l'écran n'est
   pas retendu : il y est, en « déjà nommé », avec son histoire. */
function tendusSj(pris){
  let h="";
  const dispo=function(lie){
    const sid=sujetDeLie(lie);
    return !sid || !pris[sid];
  };
  const gs=(db.gens||[]).filter(function(g){ return dispo(g.id); })
    .sort(function(a,b){ return (b.maj||0)-(a.maj||0); });
  if(gs.length)
    h+='<div class="sjgrp">'+titreBloc("Ceux que tu portes","ecart")
      + liste(gs.map(function(g){ return ligneTend(g.id, "Pour "+g.nom, ""); }).join(""))+'</div>';
  const at=sujetsAttente().filter(function(n){ return dispo(n.id); });
  if(at.length)
    h+='<div class="sjgrp">'+titreBloc("Ce qui attend","ecart")
      + liste(at.map(function(n){
          return ligneTend(n.id, n.txt,
            n.etat==="prevu" ? "Tu avais prévu · "+human(n) : "Sans réponse de toi · "+human(n));
        }).join(""))+'</div>';
  return h;
}
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
/* Et « la dernière fois » ne peut pas désigner la séance en cours : neuf
   minutes plus tôt, dans la même prière, ce n'est pas une autre fois. Les
   blocs de la séance sont donc écartés d'ici — ils ont leur propre place,
   au-dessus, comme déjà nommés (13.eh). */
function sujetsDerniers(b){
  if(!b) return [];
  const d=discTache(b.t), dans={};
  seanceDe(b).forEach(function(x){ dans[x.id]=1; });
  let der=null;
  (db.temps||[]).forEach(function(x){
    if(dans[x.id] || !(x.sj||[]).length || x.deb>b.deb) return;
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
/* « 7 chapitres » ne dit pas ce qu'on a lu. Le nombre mesure la fidélité, le
   passage dit le chemin — et c'est le chemin qu'on relit : « j'ai lu Jean »
   se retient, « j'ai lu 7 » ne se retient pas. On réunit donc ce qui se
   touche, et sur la suite des chapitres mis bout à bout, pas livre par
   livre : une lecture continue ignore les frontières, et un mois de
   fidélité se dit « Genèse 1 à 50 · Exode 1 à 12 » plutôt qu'en trente
   lignes (13.dz). */
function chapitresFen(t0, t1){
  const vus={};
  (db.temps||[]).forEach(function(b){
    if(!b.lu || !b.lu.length || b.deb<t0 || b.deb>=t1) return;
    b.lu.forEach(function(r){ for(let c=r[1]; c<=r[2]; c++) vus[plat(r[0], c)]=1; });
  });
  const is=Object.keys(vus).map(Number).sort(function(a,z){ return a-z; });
  const segs=[]; let d=null;
  is.forEach(function(i){ if(d && i===d[1]+1) d[1]=i; else { d=[i,i]; segs.push(d); } });
  return segs.reduce(function(acc, s){ return acc.concat(passagesDe(s[0], s[1])); }, []);
}
/* Même réunion pour les livres, mais par livre : des pages ne se suivent
   pas d'un ouvrage à l'autre (13.dz). */
function pagesFenPar(t0, t1){
  const par={}, ordre=[];
  (db.temps||[]).forEach(function(b){
    if(!b.pg || !b.pg.length || b.deb<t0 || b.deb>=t1) return;
    b.pg.forEach(function(r){
      if(!par[r[0]]){ par[r[0]]={}; ordre.push(r[0]); }
      for(let p=r[1]; p<=r[2]; p++) par[r[0]][p]=1;
    });
  });
  const out=[];
  ordre.forEach(function(id){
    const ps=Object.keys(par[id]).map(Number).sort(function(a,z){ return a-z; });
    let d=null;
    ps.forEach(function(p){ if(d && p===d[2]+1) d[2]=p; else { d=[id,p,p]; out.push(d); } });
  });
  return out;
}
/* Au-delà de huit passages, la ligne cesse d'être un résumé. Les autres ne
   sont pas perdus : chaque lecture est sur son bloc, sous la pastille
   « Les blocs », au même écran (13.dz). */
const LUS_MAX = 8;
function resumeLus(rs, nom){
  if(!rs.length) return "";
  const t=rs.slice(0, LUS_MAX).map(nom).join(" · ");
  return rs.length>LUS_MAX ? t+" · …et "+(rs.length-LUS_MAX)+" de plus" : t;
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
/* Ce que chaque support appelle sa prise, et comment on le dit. Le mot
   change ; la question est la même, et il n'y en a qu'une par séance. */
const MOTS_SP={
  bible: {champ:"lu",  nom:"passage",  dire:"Dire les chapitres lus",  plus:"Ajouter un passage"},
  livre: {champ:"pg",  nom:"passage",  dire:"Dire les pages lues",     plus:"Ajouter un passage"},
  sujets:{champ:"sj",  nom:"sujet",    dire:"Dire ce que tu as nommé", plus:"En nommer un autre"},
  gens:  {champ:"qui", nom:"personne", dire:"Dire à qui tu as annoncé",plus:"En ajouter"}
};
function compteSeance(se, m){
  let n=0; (se||[]).forEach(function(x){ n+=(x[m.champ]||[]).length; });
  return n;
}
/* Ouvrir l'écran de la question pour ce bloc-là. Deux chemins y mènent : un
   arrêt qui la pose, et la porte du pointage qui la rouvre (13.ei). */
function ecranDit(b, repli){
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
/* La question se pose au moment où elle est naturelle : on vient de fermer
   la lecture, on sait jusqu'où on est allé, et on est déjà là — aucun écran
   à traverser. L'app demande ; elle n'inscrit rien, et Retour suffit à ne
   rien dire. Un bloc trop court a déjà été effacé : on ne demande pas ce
   qu'on a lu en vingt secondes.
   Et elle ne la pose qu'UNE fois par séance (13.ei). J'avais écrit le
   contraire en 13.eh, en me disant que la seconde moitié d'une prière
   pouvait avoir nommé autre chose. Ses mots : « Sur la question de la
   pause, c'est un seul sujet, pas 4. » Une prière coupée en quatre porte un
   sujet ; redemander trois fois n'était pas de la prudence, c'était la même
   question à quelqu'un qui avait déjà répondu. La reprise dit donc ce que
   la séance tient, et la porte reste au pointage. */
function apresArret(bs, repli){
  const b=(bs||[]).filter(function(x){
    return x && blocT(x.id) && MOTS_SP[x ? spTache(x.t) : ""];
  })[0];
  if(!b) return false;
  const se=seanceDe(b);
  if(se.length>1 && se[0]!==b){
    const m=MOTS_SP[spTache(b.t)], n=compteSeance(se, m);
    toast("Arrêté. Même séance qu'à "+hmin(new Date(se[0].deb))
      + (n ? " — "+n+" "+m.nom+(n>1?"s":"")+" déjà." : "."));
    return false;
  }
  return ecranDit(b, repli);
}
/* La séance qu'on vient de quitter, tant qu'elle peut encore être reprise :
   rien ne tourne, et son dernier bloc s'est fermé il y a moins d'une
   demi-heure — le même seuil que la séance elle-même, puisque c'est la même
   question : est-ce encore ça ? Passé ce délai, ou dès qu'autre chose
   commence, elle est finie et la porte s'efface d'elle-même. On ne laisse
   pas traîner un chemin vers hier. */
function seanceFraiche(){
  if(ouverts().length) return null;
  let d=null;
  (db.temps||[]).forEach(function(b){
    if(typeof b.fin!=="number") return;
    if(!d || b.fin>d.fin) d=b;
  });
  if(!d || Date.now()-d.fin > SEUIL_SEANCE) return null;
  return MOTS_SP[spTache(d.t)] ? d : null;
}
/* La question ne s'impose plus à la reprise — mais elle doit rester à une
   tape, sinon on retombe sur les sept gestes de « Mon temps → le bloc →
   l'écran » que 13.cd avait déjà payés une fois. La porte se tient donc au
   pointage, où l'on revient pour dire ce qui suit. Elle ne reproche rien
   quand la séance n'a rien dit : elle nomme la séance, et ouvre (13.cb). */
function porteSeance(){
  const b=seanceFraiche(); if(!b) return "";
  const m=MOTS_SP[spTache(b.t)], se=seanceDe(b), n=compteSeance(se, m);
  return titreBloc(esc(tacheNom(b.t))+" · "+hmin(new Date(se[0].deb))
      + " → "+hmin(new Date(b.fin)), "ecart")
    + liste(ligne({titre: n ? m.plus : m.dire,
        sous: n ? n+" "+m.nom+(n>1?"s":"")+" pour cette séance" : "",
        attr:'data-dis="'+b.id+'"'}), "lien");
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
/* Une étiquette au-dessus du champ, comme pour les listes déroulantes : une
   date vide ne dit pas ce qu'elle attend, un « placeholder » ne s'affiche
   jamais sur un input[type=date]. */
function champLab(id, label, ctrl){
  return `<li class="item-content item-input"><div class="item-inner">
      <div class="item-title item-label">${label}</div>
      <div class="item-input-wrap">${ctrl}</div>
    </div></li>`;
}
function champSel(id, label, corps){
  return `<li class="item-content item-input"><div class="item-inner">
      <div class="item-title item-label">${label}</div>
      <div class="item-input-wrap"><span class="sel"><select id="${id}">${corps}</select></span></div>
    </div></li>`;
}
/* Chaque ligne dit de quel bloc elle vient. La fiche d'une séance montre ce
   que plusieurs blocs ont recueilli, et « retirer » doit viser celui-là, pas
   le bloc où l'on se trouve : une fiche qu'on ne peut pas corriger n'est pas
   une fiche (13.ct, 13.eh). */
/* Ce que la séance a déjà recueilli, bloc par bloc, sous un seul titre : le
   disciple ne lit pas une fiche par morceau, il lit sa séance. L'heure n'est
   dite que s'il y a plusieurs blocs — sinon elle n'apprend rien (13.eh). */
/* L'écran d'un bloc dit ce que CE bloc a recueilli — c'est sa fiche, et elle
   doit rester la sienne. Mais la séance en a peut-être recueilli dans un
   autre bloc, et taire ce qui existe ailleurs ferait croire à un oubli :
   une porte, donc, plutôt qu'un silence ou qu'une liste recopiée (13.eh). */
function portesSeance(b, champ, nom){
  return seanceDe(b).filter(function(x){ return x!==b && (x[champ]||[]).length; })
    .map(function(x){
      const n=x[champ].length;
      return ligne({titre:"À "+hmin(new Date(x.deb))+", dans la même séance",
        sous:n+" "+nom+(n>1?"s":""), attr:'data-vbloc="'+x.id+'"'});
    }).join("");
}
function dejaSeance(se, reprise, champ, rendu){
  const deja=(se||[]).filter(function(x){ return (x[champ]||[]).length; });
  if(!deja.length) return "";
  return titreBloc(reprise ? "Déjà noté dans cette séance" : "Déjà noté sur ce bloc", "ecart")
    + deja.map(function(x){ return rendu(x, reprise); }).join("");
}
function listeLu(b, horo){
  return liste((b.lu||[]).map(function(r,i){
    return ligne({titre:esc(nomPassage(r)),
      sous:(horo ? hmin(new Date(b.deb))+" · " : "")+chapitresTxt(nbLu(r)),
      apres:`<span class="rouge">Retirer</span>`, attr:'data-lusup="'+b.id+'|'+i+'"'});
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
  /* La fiche est celle de la séance, pas du bloc : une séance interrompue
     reste une séance, et ce qu'elle a déjà recueilli est déjà sous les yeux
     au lieu d'être redemandé à blanc (13.eh). */
  const se=seanceDe(b), reprise=se.length>1, meme=!!der && se.indexOf(der.b)!==-1;
  if(S.luA===null || S.luA===undefined){ S.luA=debutPlat(); S.luZ=S.luA; }
  const a=S.luA, z=Math.max(a, S.luZ);
  Z.titre="Ce que tu as lu"; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">${
    !der ? "Tu commences à <b>"+esc(nomPlat(a))+"</b>. Jusqu'où es-tu allé ?"
    : meme ? "Tu reprends à <b>"+esc(nomPlat(a))+"</b>. Jusqu'où es-tu allé ?"
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
  h+=dejaSeance(se, reprise, "lu", listeLu);
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
  /* La fiche est celle de la séance, pas du bloc : une séance interrompue
     reste une séance, et ce qu'elle a déjà recueilli est déjà sous les yeux
     au lieu d'être redemandé à blanc (13.eh). */
  const se=seanceDe(b), reprise=se.length>1;
  /* Le même fait, dit trois fois selon qu'il vient d'arriver, qu'il est de
     cette séance-ci, ou d'hier : « la dernière fois » sonne faux trois
     secondes après l'avoir noté — et tout autant neuf minutes plus tard,
     dans la même lecture (13.eh). */
  let h=`<div class="block amorce" style="margin-top:16px">${
    !der ? "Dis le livre et les chapitres traversés. Dès la prochaine fois, l'app reprendra là où tu t'arrêtes."
    : der.b===b ? "Tu viens de noter <b>"+esc(nomPassage(der.r))+"</b>. On continue juste après."
    : se.indexOf(der.b)!==-1 ? "Tu as noté <b>"+esc(nomPassage(der.r))+"</b> tout à l'heure, dans cette même séance. On continue juste après."
    : "La dernière fois, tu t'es arrêté à <b>"+esc(nomPassage(der.r))+"</b>. On reprend juste après."
  }</div>`;
  h+=titreBloc("Le passage");
  h+=liste(champSel("luLiv", "Le livre", optsLivres(l.li))
         + champSel("luDeb", "Du chapitre", optsChap(l.li, l.d))
         + champSel("luFin", "Jusqu'au chapitre", optsChap(l.li, l.f, l.d)));
  h+=`<div class="block amorce"><b>${esc(nomPassage([l.li, l.d, l.f]))}</b> — ${chapitresTxt(l.f-l.d+1)}.</div>`;
  h+=dejaSeance(se, reprise, "lu", listeLu);
  Z.html=h;
  Z.action=bouton("Ajouter ce passage", 'data-act="addLu"');
}

/* Ce que l'app demande à une activité se règle une fois, sur l'activité —
   pas à chaque bloc. Un seul réglage pour l'instant, et c'est voulu : on
   n'ouvre pas un atelier de champs sur mesure avant de savoir, à l'usage,
   lesquels manquent vraiment. */
/* Ce que pèse une activité — c'est ce qu'une réunion déplacerait, et c'est
   ce qu'un renommage ne touche pas. Le dire avant les champs donne au geste
   son poids (13.dm). */
function heuresTache(tid){
  let n=0, ms=0;
  (db.temps||[]).forEach(function(b){
    if(b.t!==tid) return;
    n++; ms += Math.max(0, finDe(b)-b.deb);
  });
  return {n:n, ms:ms};
}
function heuresTxt(h){
  return h.n ? hm(h.ms)+" sur "+h.n+" bloc"+(h.n>1?"s":"") : "";
}
/* Une activité qu'on ne peut ni renommer ni ranger ailleurs n'est pas une
   fiche (13.ct) : son nom restait tel qu'il avait été tapé au premier geste,
   et l'écran affirmait pourtant que le rangement « fait les parts » sans
   donner la porte pour le changer (13.cb). */
function vTache(){
  const t=tache(S.tchId);
  if(!t){ depile("temps"); return render(); }
  const sp=spTache(t.id), hr=heuresTache(t.id);
  Z.titre=t.nom; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">${hr.n
    ? `Tu y as compté <b>${esc(heuresTxt(hr))}</b>.`
    : `Rien de compté là-dedans pour l'instant.`}</div>`;
  /* Le nom se garde tout seul, comme l'auteur juste dessous : un champ qui
     attendrait un bouton sur un écran où les listes se gardent seules ferait
     mentir la forme (13.cd, 13.cu). */
  h+=titreBloc("Son nom");
  h+=`<div class="block amorce">Ce que tu écris ici se garde tout seul. Les heures déjà comptées ne bougent pas : c'est la même activité, mieux nommée.</div>`;
  h+=champ("tNom", "Son nom", "text", esc(t.nom), 'autocapitalize="sentences"');
  h+=titreBloc("Où la ranger","ecart");
  h+=`<div class="block amorce">C'est ce rangement, et lui seul, qui fait les parts. En changer refait les parts de tout ce qui a déjà été compté ici.</div>`;
  h+=liste(champSel("tCat","Dans quoi",
      CATS().map(function(c){
        return `<option value="${c.id}"${(t.cat||"reste")===c.id?" selected":""}>${esc(c.nom)}</option>`;
      }).join("")));
  const dc=discTache(t.id), dv=discDevine(t.id);
  h+=titreBloc("La routine");
  h+=`<div class="block amorce">Les seize routines du message de Bertoua. L'activité garde son nom ; elle dit seulement de laquelle elle est la mise en œuvre — et c'est elle qui décide de ce qu'on te demandera en plus du temps.</div>`;
  /* 13.em — l'app dit ce qu'elle a deviné et attend le mot du disciple :
     elle ne coche pas à sa place (P9). Confirmer ne bouge aucun chiffre —
     ça ne change que ce que l'app a le droit d'affirmer. */
  if(dv){
    h+=`<div class="block amorce">Ceci est <b>deviné</b> d'après son nom. L'app compte avec, mais elle ne peut pas l'affirmer tant que tu ne l'as pas dit.</div>`;
    h+=liste(ligne({titre: dc ? "Oui : "+esc(discNom(dc)) : "Oui : aucune routine",
      sous:"Rien ne bougera dans tes chiffres", attr:'data-dok="'+t.id+'"'}), "lien");
  }
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
  /* Réunir, et non supprimer : les heures ne se perdent pas, elles passent.
     C'est la seule façon de rattraper « Priere » tapé un jour et « Prière »
     un autre — un renommage, lui, se heurterait au nom déjà pris (13.ct). */
  const autres=(db.taches||[]).filter(function(x){ return x.id!==t.id; })
    .sort(function(a,b){ return a.nom.localeCompare(b.nom,"fr"); });
  if(autres.length){
    h+=titreBloc("Réunir avec une autre","ecart");
    h+=`<div class="block amorce">Si c'est la même activité écrite deux fois. ${hr.n
      ? `Les <b>${esc(heuresTxt(hr))}</b> comptés ici passeront sur l'autre`
      : `Tout ce qui est rattaché ici passera sur l'autre`}, et cette fiche disparaîtra.</div>`;
    h+=liste(champSel("tFus","L'autre activité",
        `<option value="">— choisis —</option>`
        + autres.map(function(x){
            return `<option value="${x.id}">${esc(x.nom)} — ${esc(catNom(x.cat||"reste"))}</option>`;
          }).join("")));
    h+=liste(ligne({titre:"Réunir les deux", attr:'data-act="tchReunir"'}), "lien");
  }
  Z.html=h;
}

/* 13.em — l'écran où l'on solde les devinettes. Il n'en corrige aucune de
   lui-même : il les montre, la plus lourde d'abord, et chaque ligne se
   confirme d'une tape. Ce qui se trompe s'ouvre, et les seize routines sont
   sur la fiche. */
function vDevine(){
  const ds=tachesDevinees();
  Z.titre="Rangées d'après leur nom"; Z.retour=true;
  if(!ds.length){
    Z.html=`<div class="block amorce" style="margin-top:16px">Plus rien n'est deviné : chacune de tes activités dit elle-même de quelle routine elle est la mise en œuvre.</div>`;
    return;
  }
  const ms=msDevinees();
  let h=`<div class="block amorce" style="margin-top:16px"><b>${esc(String(ds.length))} activité${ds.length>1?"s":""}</b> ${ds.length>1?"n'ont":"n'a"} jamais dit de quelle routine ${ds.length>1?"elles sont":"elle est"} la mise en œuvre : l'app l'a déduit de leur nom. <b>${esc(hm(ms))}</b> comptés reposent là-dessus.</div>`;
  h+=`<div class="block amorce">Touche une ligne pour dire que la devinette est juste. Aucun de tes chiffres ne bougera — ce qui change, c'est que l'app n'aura plus à deviner.</div>`;
  h+=titreBloc("Ce qu'elle a deviné","ecart");
  h+=liste(ds.map(function(x){
    const d=discTache(x.t.id);
    return ligne({titre:esc(x.t.nom),
      sous: d ? esc(discNom(d)) : "Aucune routine",
      apres: x.ms ? esc(hm(x.ms)) : "",
      attr:'data-dok="'+x.t.id+'"'});
  }).join(""));
  h+=liste(ligne({titre:"Si l'une se trompe", sous:"Ouvre-la : les seize routines sont sur sa fiche",
    attr:'data-act="parActivite"'}), "lien");
  Z.html=h;
}

/* ---------- les dynamiques ---------- */
/* 13.eo — une dynamique est un MOUVEMENT : il lui faut deux points et de quoi
   savoir lequel vient d'abord. Mesure du 11 novembre 2026 : quatre jours de
   chronomètre, et 24 des 56 actes datés du même jour — celui où le disciple
   s'est assis pour écrire son mémorial. Une courbe tracée là-dessus dirait
   quand il a commencé à se servir de l'app, pas sa marche avec Dieu.
   L'app nomme donc ce qu'elle suivra, dit ce qu'il lui manque pour le lire,
   et se met à parler toute seule le jour où les données le portent. Afficher
   des lignes à zéro serait mensonger, se taire serait pire (13.co). */
function cleJour(ms){ const d=new Date(ms); return d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate(); }
function joursComptes(){
  const v={};
  (db.temps||[]).forEach(function(b){ if(b.fin) v[cleJour(b.deb)]=1; });
  return Object.keys(v).length;
}
/* Les minutes données à Dieu, heure du jour par heure du jour. Un bloc qui
   enjambe minuit se partage : c'est le seul moyen que « 23 h » veuille dire
   la même chose pour un bloc de dix minutes et pour un bloc de six heures. */
function heuresDuJour(){
  const h=[]; for(let i=0;i<24;i++) h.push(0);
  (db.temps||[]).forEach(function(b){
    if(!b.fin || tacheCat(b.t)!=="dieu") return;
    let t=b.deb;
    while(t<b.fin){
      const d=new Date(t), suite=new Date(t);
      suite.setHours(d.getHours()+1, 0, 0, 0);
      const z=Math.min(b.fin, suite.getTime());
      h[d.getHours()]+=z-t; t=z;
    }
  });
  return h;
}
/* La plus longue suite d'heures où rien n'a jamais été compté pour Lui. On
   ne boucle pas sur minuit : un creux qui enjambe la nuit se dirait « de
   23 h à 7 h », et personne ne lit ça comme un seul trou. */
function creuxDuJour(h){
  let d=-1, f=-1, a=-1;
  for(let i=0;i<24;i++){
    if(!h[i]){ if(a<0) a=i; if(i-a+1 > f-d){ d=a; f=i; } }
    else a=-1;
  }
  return d<0 ? null : [d, f+1];
}
function hhTxt(i){ return (i===24?0:i)+" h"; }
function dynJour(){
  const h=heuresDuJour(), n=joursComptes() || 1;
  const vus=[];
  for(let i=0;i<24;i++) if(h[i]) vus.push({i:i, v:h[i]});
  if(!vus.length) return "";
  /* Trois heures au plus, et aucune qui pèse moins du quart de la plus
     forte : « tu es le plus à Lui vers 5 h, 21 h, 22 h » quand 21 h en porte
     treize fois plus serait vrai au classement et faux à la lecture. */
  const tri=vus.slice().sort(function(a,b){ return b.v-a.v; });
  const seuil=tri[0].v/4;
  const forts=tri.filter(function(x){ return x.v>=seuil; }).slice(0,3)
    .sort(function(a,b){ return a.i-b.i; });
  const cx=creuxDuJour(h);
  return "Tu es le plus à Lui vers "+forts.map(function(x){ return hhTxt(x.i); }).join(", ")
    + " — jusqu'à "+hm(Math.round(forts.reduce(function(m,x){ return Math.max(m,x.v); },0)/n))
    + " par jour."
    + (cx ? " Entre "+hhTxt(cx[0])+" et "+hhTxt(cx[1])+", rien n'a jamais été compté pour Lui." : "");
}
/* Sept jours contre les sept d'avant. En dessous de cinq minutes d'écart, on
   se tait : un mouvement de trois minutes n'en est pas un, et l'annoncer
   ferait douter des vrais. */
const DYN_BRUIT = 300000;
function dynSemaine(){
  const t1=minuit(0)+86400000, a0=minuit(6), b0=minuit(13);
  const a=parDisc(cumul(a0, t1).par), b=parDisc(cumul(b0, a0).par);
  const ids={};
  Object.keys(a).forEach(function(k){ ids[k]=1; });
  Object.keys(b).forEach(function(k){ ids[k]=1; });
  const mv=Object.keys(ids).map(function(k){ return {d:k, e:(a[k]||0)-(b[k]||0)}; })
    .filter(function(x){ return Math.abs(x.e)>=DYN_BRUIT; })
    .sort(function(x,y){ return Math.abs(y.e)-Math.abs(x.e); });
  if(!mv.length) return "Rien n'a bougé de plus de cinq minutes d'une semaine à l'autre.";
  return mv.slice(0,3).map(function(x){
    return discNom(x.d)+" "+(x.e>0?"+":"−")+" "+hm(Math.abs(x.e));
  }).join(" · ")+".";
}
/* Un échange daté : un acte, et le premier qui lui répond de l'autre côté.
   Ce qui est encore prévu n'a pas eu lieu, et ne répond donc à rien (13.en). */
function echanges(){
  const mien=[], sien=[];
  (db.nodes||[]).forEach(function(n){
    const e=enfants(n.id).filter(function(x){ return x.etat!=="prevu"; });
    const r=e.filter(function(x){ return n.act==="moi" ? x.act!=="moi" : x.act==="moi"; })
             .sort(parDateAsc)[0];
    if(!r) return;
    const j=jours(n.date, r.date);
    if(j===null || j<0) return;
    (n.act==="moi" ? sien : mien).push({n:n, r:r, j:j});
  });
  return {mien:mien, sien:sien};
}
function nbEchanges(){ const e=echanges(); return e.mien.length+e.sien.length; }
function dynEchanges(){
  const e=echanges(), out=[];
  const moy=function(a){ return Math.round(a.reduce(function(s,x){ return s+x.j; },0)/a.length); };
  if(e.mien.length) out.push("Tu mets <b>"+esc(duree(moy(e.mien)))+"</b> à Lui rendre quelque chose");
  if(e.sien.length) out.push("Il met <b>"+esc(duree(moy(e.sien)))+"</b> à répondre à ce que tu fais");
  return out.join(" · ")+".";
}
function paroleDelais(){
  return paroles().filter(accomplie).map(function(p){
    const a=accompliesDe(p)[0], j=jours(p.date, a.date);
    return (j===null || j<0) ? null : {p:p, j:j};
  }).filter(Boolean);
}
function nbAccomplies(){ return paroleDelais().length; }
function dynParoles(){
  const ps=paroleDelais();
  if(!ps.length) return "";
  const moy=Math.round(ps.reduce(function(s,x){ return s+x.j; },0)/ps.length);
  const max=ps.slice().sort(function(a,b){ return b.j-a.j; })[0];
  return "Entre une parole et ce qui l'accomplit, <b>"+esc(duree(moy))
    + "</b> en moyenne. Le plus long : <b>"+esc(duree(max.j))+"</b>.";
}
/* Chacune dit ce qu'elle suivra, ce qu'il lui faut, et où l'on en est. Le
   seuil n'est pas un réglage : c'est le nombre de points en dessous duquel
   la phrase serait du bruit présenté comme un mouvement. */
const DYN = [
  {id:"progres", nom:"Ta semaine contre la précédente",
   quoi:"Ce qui va à Dieu, cette semaine contre la semaine d'avant.",
   faut:14, unite:["jour compté","jours comptés"], ou:function(){ return joursComptes(); }, lit:dynProgres},
  {id:"jour", nom:"Le rythme de tes journées",
   quoi:"À quelle heure du jour tu es à Lui, et à quelle heure jamais.",
   faut:14, unite:["jour compté","jours comptés"], ou:function(){ return joursComptes(); }, lit:dynJour},
  {id:"semaine", nom:"Ce qui monte, ce qui baisse",
   quoi:"Chaque routine, cette semaine contre la précédente.",
   faut:21, unite:["jour compté","jours comptés"], ou:function(){ return joursComptes(); }, lit:dynSemaine},
  {id:"vaetvient", nom:"Le va-et-vient",
   quoi:"Le temps qu'Il met à répondre, et celui que tu mets.",
   faut:6, unite:["échange daté","échanges datés"], ou:nbEchanges, lit:dynEchanges},
  {id:"parole", nom:"Ses délais",
   quoi:"Entre une parole et ce qui l'accomplit.",
   faut:3, unite:["parole accomplie","paroles accomplies"], ou:nbAccomplies, lit:dynParoles}
];
function blocDyn(){
  const lues=[], attend=[];
  DYN.forEach(function(d){
    const n=d.ou(), pret=n>=d.faut, txt=pret ? d.lit() : "";
    (pret && txt ? lues : attend).push({d:d, n:n, txt:txt});
  });
  let h=`<div class="block amorce" style="margin-top:4px">Une dynamique, c'est un mouvement — il lui faut deux points, et de quoi savoir lequel vient d'abord. Tant qu'une d'elles n'a pas de quoi se lire, l'app dit ce qui lui manque. Elle ne dessine rien.</div>`;
  if(lues.length){
    h+=titreBloc("Ce qui se lit déjà");
    h+=liste(lues.map(function(x){
      return ligne({titre:esc(x.d.nom), sous:x.txt});
    }).join(""));
  }
  if(attend.length){
    h+=titreBloc("Ce qui attend encore", lues.length?"ecart":"");
    h+=liste(attend.map(function(x){
      const reste=x.d.faut-x.n;
      return ligne({titre:esc(x.d.nom),
        sous:esc(x.d.quoi)+" · il en manque "+reste+" "+esc(x.d.unite[reste>1?1:0]),
        apres:esc(x.n+" / "+x.d.faut)});
    }).join(""));
  }
  return h;
}

/* ---------- mes rythmes : la fidélité, à la mesure qu'il a donnée (13.ep) ----
   Il voulait être prévenu quand il ne prie plus, ne lit plus la Bible. Mais
   « longtemps » n'est pas un nombre que l'application connaît : quatre jours
   de chronomètre et un seul bloc de prière ne disent pas s'il prie chaque
   jour ou chaque semaine. Un seuil inventé l'aurait accusé d'infidélité sur
   rien — le pire des chiffres faux (13.ch), puisqu'il aurait eu la forme d'un
   reproche. Le seuil vient donc de lui, routine par routine, et l'app ne fait
   qu'une chose : le tenir à sa propre parole. */
const RYTHMES = [
  [1,  "Tous les jours"],
  [2,  "Tous les deux jours"],
  [3,  "Tous les trois jours"],
  [7,  "Une fois par semaine"],
  [14, "Une fois par quinzaine"],
  [30, "Une fois par mois"],
  [90, "Une fois par trimestre"]
];
function rythNom(n){
  const r=RYTHMES.filter(function(x){ return x[0]===n; })[0];
  return r ? r[1] : "";
}
/* Zéro n'est pas l'absence d'enregistrement : c'est « aucun rythme », un
   choix qu'il a fait et qui se propage comme les autres. */
function rythFiche(d){ return (db.rythmes||[]).filter(function(x){ return x.d===d; })[0] || null; }
function rythme(d){ const r=rythFiche(d); return (r && r.n>0) ? r : null; }
function rythDits(){ return (db.rythmes||[]).filter(function(r){ return r.n>0; }); }
function joursMs(ms){
  const d=new Date(ms); d.setHours(0,0,0,0);
  return Math.round((minuit(0)-d.getTime())/86400000);
}
/* Le dernier signe d'une routine. Un bloc en cours vaut maintenant : on y est
   (13.cf). Et un temps mis à part compte comme signe, sans peser une heure —
   une retraite ne se chronomètre pas, elle se vit (13.cw). */
function dernierSigne(d){
  let t=0;
  (db.temps||[]).forEach(function(b){
    if(discTache(b.t)===d) t=Math.max(t, (typeof b.fin==="number") ? b.fin : Date.now());
  });
  (db.periodes||[]).forEach(function(p){
    if(p.d===d) t=Math.max(t, perOuverte(p) ? Date.now() : (p.fin||p.deb));
  });
  /* 13.er — et les actes. Donner sa dîme est un signe de la routine
     « donner », et aucun chronomètre n'a tourné pour le dire. */
  actesDisc(d).forEach(function(n){
    const sp=spanActe(n);
    if(sp) t=Math.max(t, Math.min(sp[0], Date.now()));
  });
  return t;
}
/* Un rythme déclaré aujourd'hui n'est pas en retard aujourd'hui : faute de
   signe, l'horloge part de la parole donnée. */
function retard(d){
  const r=rythme(d); if(!r) return null;
  const sg=dernierSigne(d);
  const depuis = sg || r.ts || r.maj || 0;
  if(!depuis) return null;
  const j=joursMs(depuis);
  return {d:d, n:r.n, j:j, jamais:!sg, tard:(j > r.n)};
}
function retards(){
  return DISC.map(function(x){ return retard(x[0]); })
    .filter(function(x){ return x && x.tard; })
    .sort(function(a,b){ return (b.j-b.n)-(a.j-a.n); });
}
function rythTenus(){
  return DISC.map(function(x){ return retard(x[0]); })
    .filter(function(x){ return x && !x.tard; }).length;
}
/* « Rien de compté » et « tu n'as pas prié » ne sont pas la même phrase, et
   l'application n'a le droit que de la première : elle ne sait rien de ce qui
   s'est vécu sans être pointé. */
function fidTxt(x){
  if(!x) return "";
  /* Le jour zéro n'est pas une durée : « rien de compté depuis 0 jours » et
     « 0 jours après l'avoir dit » sont des phrases fausses, et la seconde
     tombe précisément au moment le plus délicat — celui où il vient de
     déclarer son rythme. */
  if(x.jamais)
    return x.j ? "Jamais rien de compté, " + duree(x.j) + " après l'avoir dit"
               : "Dit aujourd'hui — rien de compté encore";
  return x.j ? "Rien de compté depuis " + duree(x.j) : "Compté aujourd'hui";
}
function rappelFid(){
  if(!rythDits().length) return "";
  const rs=retards();
  if(!rs.length){
    /* Une sentinelle qui ne dit jamais rien ne se distingue pas d'une
       sentinelle en panne : quand tout est tenu, elle le dit en une ligne. */
    const n=rythTenus();
    if(!n) return "";
    return titreBloc("Mes rythmes","ecart")
      + `<div class="block amorce">${n} rythme${n>1?"s":""} déclaré${n>1?"s":""}, ${n>1?"tous tenus":"tenu"}.</div>`
      + `<div style="height:18px"></div>`;
  }
  const reste=rs.length-3;
  return titreBloc("Ce qui attend ta fidélité","ecart")
    + liste(rs.slice(0,3).map(function(x){
        return ligne({titre:esc(discNom(x.d)), sous:esc(fidTxt(x)),
          apres:esc(rythNom(x.n)), attr:'data-go="rythmes"'});
      }).join(""), "lien")
    + (reste>0
       ? liste(ligne({titre:"Et "+reste+" autre"+(reste>1?"s":""),
           sous:"Voir les seize rythmes", attr:'data-go="rythmes"'}), "lien")
       : "")
    + `<div class="block amorce">C'est ton rythme qui parle, pas un seuil de l'application. Et ce qu'elle mesure, c'est ce qui a été pointé : ce que tu as vécu sans le compter ne se voit pas d'ici.</div>`
    + `<div style="height:18px"></div>`;
}
function vRythmes(){
  Z.titre="Mes rythmes"; Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">Dis à quel rythme tu veux tenir une routine. L'application ne l'invente pas : ce que tu déclares ici est la seule mesure dont elle se serve pour te prévenir, et elle n'en déduit rien d'elle-même.</div>`;
  h+=liste(DISC.map(function(x){
    const r=rythme(x[0]), rt=retard(x[0]);
    return ligne({titre:esc(x[1]),
      sous: r ? esc(fidTxt(rt)) : "Aucun rythme déclaré",
      apres: r ? esc(rythNom(r.n)) : "—",
      attr:'data-ryth="'+x[0]+'"'});
  }).join(""), "lien");
  Z.html=h;
}
function vRythme(){
  const d=S.rythD;
  if(!d || !DISC.filter(function(x){ return x[0]===d; }).length){ depile("rythmes"); return render(); }
  const r=rythme(d), rt=retard(d), sg=dernierSigne(d);
  Z.titre=discNom(d); Z.retour=true;
  let h=`<div class="block amorce" style="margin-top:16px">${
    sg ? "Dernier signe il y a <b>"+esc(duree(joursMs(sg)))+"</b>."
       : "Rien n'a jamais été compté pour cette routine."}${
    rt && rt.tard ? " Tu avais dit <b>"+esc(rythNom(rt.n).toLowerCase())+"</b>." : ""}</div>`;
  h+=titreBloc("À quel rythme");
  h+=liste(RYTHMES.map(function(x){
      return ligne({titre:esc(x[1]),
        apres:(r && r.n===x[0]) ? `<span class="coche">✓</span>` : "",
        attr:'data-rythn="'+d+':'+x[0]+'"'});
    }).join("")
    + ligne({titre:"Aucun rythme", sous:"L'application ne dira rien sur celle-ci",
        apres: r ? "" : `<span class="coche">✓</span>`,
        attr:'data-rythn="'+d+':0"'}));
  h+=`<div class="block amorce">Ce qui compte comme signe : un bloc pointé sur une activité qui porte cette routine, ou un temps mis à part — une retraite en cours se vit maintenant, même si elle ne pèse aucune heure.</div>`;
  Z.html=h;
}

/* ---------- ceux que je porte (13.eq) --------------------------------------
   « j'ai la responsabilité de prier pour des gens […] des choses spécifiques
   que je demande à Dieu pour chaque personne, ça doit être distinct. »
   Mesure du 12 novembre 2026 : six personnes, deux sujets, et pas un seul
   sujet rattaché à une personne. Ce n'était pas l'alerte qui manquait, c'est
   l'endroit où écrire — une alerte sur du vide n'alerte personne. */

/* Pour qui ce sujet est. Le lien de 13.ek faisait déjà d'une fiche de
   personne le sujet tout entier — « Pour Laure ». Le champ `g`, lui, laisse
   au sujet ses propres mots tout en le rattachant : « sa santé » et « son
   travail » sont deux sujets distincts de la même personne. */
function sujetGens(s){
  if(!s) return null;
  if(s.g && gensNom(s.g)) return s.g;
  if(s.lie && String(s.lie).charAt(0)==="g" && gensNom(s.lie)) return s.lie;
  return null;
}
function sujetsDe(gid){
  if(!gid) return [];
  return (db.sujets||[]).filter(function(s){ return sujetGens(s)===gid; });
}
/* Deux personnes peuvent attendre la même chose. « Sa santé » écrit pour
   l'une ne doit donc pas se confondre avec « sa santé » écrite pour l'autre :
   on retrouve un sujet par le couple (la personne, les mots), jamais par les
   mots seuls comme ailleurs dans le cahier. */
function sujetPour(gid, txt){
  const v=String(txt||"").trim().replace(/\s+/g," ");
  if(!v || !gensNom(gid)) return null;
  db.sujets=db.sujets||[];
  const k=v.toLowerCase();
  const f=db.sujets.filter(function(s){
    return sujetGens(s)===gid && String(s.txt).trim().toLowerCase()===k; })[0];
  if(f) return f.id;
  const id=uid("s");
  db.sujets.push({id:id, txt:v, g:gid, maj:Date.now()});
  return id;
}
/* 13.et — les promesses de Dieu, rangées par besoin. Ce n'est pas une liste
   inventée : c'est la page de son propre livre de prière, sous Proverbes
   30:5, reprise telle quelle — mêmes besoins, mêmes références, même ordre —
   puis prolongée là où elle s'arrête. Elle vit dans le code et non dans
   l'archive : rien de ce qu'il écrit ne peut donc dériver de l'Écriture, et
   corriger une transcription la corrige partout à la fois. Les textes sont
   ceux de la Segond. Une seule référence manquait sur la photo, coupée au
   bas de la colonne (« Ne crains point en temps de trouble ») : elle est
   complétée ici. */
const PROMESSES = [
 {cat:"En général", items:[
  {id:"demander", t:"Demander et vous recevrez", v:[
    ["Luc 11:9","Demandez, et l'on vous donnera ; cherchez, et vous trouverez ; frappez, et l'on vous ouvrira."],
    ["Jean 16:23","En vérité, en vérité, je vous le dis, ce que vous demanderez au Père, il vous le donnera en mon nom."],
    ["1 Jean 5:14","Nous avons auprès de lui cette assurance, que si nous demandons quelque chose selon sa volonté, il nous écoute."]]},
  {id:"entend", t:"Dieu entend les prières de son peuple", v:[
    ["Psaume 34:16","Les yeux de l'Éternel sont sur les justes, et ses oreilles sont attentives à leurs cris."],
    ["Jérémie 33:3","Invoque-moi, et je te répondrai ; je t'annoncerai de grandes choses, des choses cachées, que tu ne connais pas."]]}
 ]},
 {cat:"Besoins personnels", items:[
  {id:"anxiete", t:"Dans l'anxiété", v:[
    ["Philippiens 4:6-7","Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications, avec des actions de grâces. Et la paix de Dieu, qui surpasse toute intelligence, gardera vos cœurs et vos pensées en Jésus-Christ."],
    ["Ésaïe 43:2","Si tu traverses les eaux, je serai avec toi ; et les fleuves, ils ne te submergeront point."]]},
  {id:"fardeaux", t:"Décharger les fardeaux sur Dieu", v:[
    ["1 Pierre 5:7","Déchargez-vous sur lui de tous vos soucis, car lui-même prend soin de vous."]]},
  {id:"besoins", t:"Besoins à rencontrer", v:[
    ["Philippiens 4:19","Et mon Dieu pourvoira à tous vos besoins selon sa richesse, avec gloire, en Jésus-Christ."]]},
  {id:"trouble", t:"Ne crains point en temps de trouble", v:[
    ["Psaume 46:2","Dieu est pour nous un refuge et un appui, un secours qui ne manque jamais dans la détresse."],
    ["Ésaïe 41:10","Ne crains rien, car je suis avec toi ; ne promène pas des regards inquiets, car je suis ton Dieu ; je te fortifie, je viens à ton secours, je te soutiens de ma droite triomphante."]]},
  {id:"jeune", t:"Force pour le jeûne", v:[
    ["Jean 15:5","Celui qui demeure en moi et en qui je demeure porte beaucoup de fruit, car sans moi vous ne pouvez rien faire."]]},
  {id:"volonte", t:"Recherche de la volonté de Dieu, direction", v:[
    ["Psaume 32:8","Je t'instruirai et te montrerai la voie que tu dois suivre ; je te conseillerai, j'aurai le regard sur toi."]]},
  {id:"guerison", t:"Guérison", v:[
    ["Psaume 103:3","C'est lui qui pardonne toutes tes iniquités, qui guérit toutes tes maladies."],
    ["1 Pierre 2:24","Lui par les meurtrissures duquel vous avez été guéris."]]},
  {id:"sagesse", t:"Besoin de sagesse", v:[
    ["Jacques 1:5","Si quelqu'un d'entre vous manque de sagesse, qu'il la demande à Dieu, qui donne à tous simplement et sans reproche, et elle lui sera donnée."]]},
  {id:"biens", t:"Protection des biens", v:[
    ["Psaume 91:10","Aucun malheur ne t'arrivera, aucun fléau n'approchera de ta tente."]]},
  {id:"ouvriers", t:"Demander des co-ouvriers", v:[
    ["Matthieu 9:38","Priez donc le maître de la moisson d'envoyer des ouvriers dans sa moisson."]]}
 ]},
 {cat:"Salut des âmes", items:[
  {id:"repentance", t:"Pour que Dieu accorde la repentance", v:[
    ["Actes 11:18","Dieu a donc accordé la repentance aussi aux païens, afin qu'ils aient la vie."]]},
  {id:"salutames", t:"Désir de Dieu pour le salut des âmes", v:[
    ["2 Pierre 3:9","Le Seigneur use de patience envers vous, ne voulant pas qu'aucun périsse, mais voulant que tous arrivent à la repentance."]]}
 ]},
 {cat:"Sa maison", items:[
  {id:"maison", t:"Le salut de sa maison", v:[
    ["Actes 16:31","Crois au Seigneur Jésus, et tu seras sauvé, toi et ta famille."]]},
  {id:"enfants", t:"Pour ses enfants", v:[
    ["Ésaïe 54:13","Tous tes fils seront disciples de l'Éternel, et grande sera la postérité de tes fils."],
    ["Ésaïe 49:25","Je combattrai tes ennemis, et je sauverai tes fils."]]},
  {id:"conjoint", t:"Le conjoint que Dieu donne", v:[
    ["Genèse 2:18","Il n'est pas bon que l'homme soit seul ; je lui ferai une aide semblable à lui."],
    ["Proverbes 18:22","Celui qui trouve une femme trouve le bonheur ; c'est une grâce qu'il obtient de l'Éternel."]]},
  {id:"enfantdemande", t:"Un enfant demandé", v:[
    ["Psaume 113:9","Il donne une maison à celle qui était stérile, il en fait une mère joyeuse au milieu de ses enfants."],
    ["1 Samuel 1:27","C'est cet enfant que je demandais, et l'Éternel m'a accordé la demande que je lui avais faite."]]}
 ]},
 {cat:"Le travail et le pain", items:[
  {id:"travail", t:"Trouver du travail", v:[
    ["Deutéronome 28:12","L'Éternel t'ouvrira son bon trésor, le ciel, pour envoyer la pluie en son temps et pour bénir tout le travail de tes mains."],
    ["Psaume 37:5","Recommande ton sort à l'Éternel, mets en lui ta confiance, et il agira."]]},
  {id:"pain", t:"Le pain de chaque jour", v:[
    ["Matthieu 6:33","Cherchez premièrement le royaume et la justice de Dieu ; et toutes ces choses vous seront données par-dessus."],
    ["Psaume 37:25","Je n'ai point vu le juste abandonné, ni sa postérité mendiant son pain."]]},
  {id:"dettes", t:"Sortir des dettes", v:[
    ["Deutéronome 28:12","Tu prêteras à beaucoup de nations, et tu n'emprunteras point."]]},
  {id:"etudes", t:"Les études, un examen", v:[
    ["Daniel 1:17","Dieu accorda à ces quatre jeunes gens de la science, de l'intelligence dans toutes les lettres, et de la sagesse."]]}
 ]},
 {cat:"Le combat", items:[
  {id:"delivrance", t:"La délivrance", v:[
    ["Psaume 34:18","Quand les justes crient, l'Éternel entend, et il les délivre de toutes leurs détresses."],
    ["2 Timothée 4:18","Le Seigneur me délivrera de toute œuvre mauvaise, et me sauvera pour me faire entrer dans son royaume céleste."]]},
  {id:"ennemi", t:"Contre l'ennemi", v:[
    ["Ésaïe 54:17","Toute arme forgée contre toi sera sans effet ; et toute langue qui s'élèvera en justice contre toi, tu la condamneras."],
    ["Luc 10:19","Je vous ai donné le pouvoir de marcher sur les serpents et les scorpions, et sur toute la puissance de l'ennemi ; et rien ne pourra vous nuire."]]},
  {id:"tentation", t:"Dans la tentation", v:[
    ["1 Corinthiens 10:13","Dieu, qui est fidèle, ne permettra pas que vous soyez tentés au-delà de vos forces ; mais avec la tentation il préparera aussi le moyen d'en sortir."]]},
  {id:"pardon", t:"Le pardon et la purification", v:[
    ["1 Jean 1:9","Si nous confessons nos péchés, il est fidèle et juste pour nous les pardonner, et pour nous purifier de toute iniquité."]]},
  {id:"voyage", t:"En voyage, sur la route", v:[
    ["Psaume 121:8","L'Éternel gardera ton départ et ton arrivée, dès maintenant et à jamais."],
    ["Psaume 91:11","Il ordonnera à ses anges de te garder dans toutes tes voies."]]}
 ]},
 {cat:"L'œuvre", items:[
  {id:"porteouverte", t:"Une porte ouverte pour la Parole", v:[
    ["Colossiens 4:3","Priez en même temps pour nous, afin que Dieu nous ouvre une porte pour la parole."]]},
  {id:"hardiesse", t:"La hardiesse pour annoncer", v:[
    ["Actes 4:29","Donne à tes serviteurs d'annoncer ta parole avec une pleine assurance."]]},
  {id:"unite", t:"L'unité des frères", v:[
    ["Psaume 133:1","Voici, oh ! qu'il est agréable, qu'il est doux pour des frères de demeurer ensemble !"]]},
  {id:"conducteurs", t:"Pour ceux qui conduisent l'Église", v:[
    ["Jérémie 3:15","Je vous donnerai des bergers selon mon cœur, et ils vous paîtront avec intelligence et avec sagesse."]]},
  {id:"autorites", t:"Pour les autorités et le pays", v:[
    ["1 Timothée 2:1-2","J'exhorte donc à faire des prières pour tous les hommes, pour les rois et pour tous ceux qui sont élevés en dignité, afin que nous menions une vie paisible et tranquille."]]}
 ]},
 {cat:"Quand on attend", items:[
  {id:"tarde", t:"Quand la réponse tarde", v:[
    ["Habacuc 2:3","Si elle tarde, attends-la, car elle s'accomplira, elle s'accomplira certainement."],
    ["Galates 6:9","Ne nous lassons pas de faire le bien ; car nous moissonnerons au temps convenable, si nous ne nous relâchons pas."]]},
  {id:"fatigue", t:"Quand on est à bout de force", v:[
    ["Ésaïe 40:31","Ceux qui se confient en l'Éternel renouvellent leur force ; ils prennent le vol comme les aigles ; ils courent, et ne se lassent point."]]},
  {id:"deuil", t:"Dans le deuil, le cœur brisé", v:[
    ["Psaume 34:19","L'Éternel est près de ceux qui ont le cœur brisé, et il sauve ceux qui ont l'esprit dans l'abattement."],
    ["Apocalypse 21:4","Il essuiera toute larme de leurs yeux."]]},
  {id:"paix", t:"La paix du cœur", v:[
    ["Jean 14:27","Je vous laisse la paix, je vous donne ma paix. Que votre cœur ne se trouble point, et ne s'alarme point."]]}
 ]}
];
/* Un seul attribut sur le sujet : `pr`. Ou bien l'identifiant d'un besoin de
   la liste — et ses versets viennent avec lui —, ou bien sa propre référence,
   dans ses mots. Jamais les deux : écrire détache de la liste, comme ses mots
   détachent un sujet de sa fiche (13.ek). */
function promesse(id){
  let f=null;
  PROMESSES.forEach(function(c){ c.items.forEach(function(x){ if(x.id===id) f=x; }); });
  return f;
}
function sujetProm(s){
  const v=s && s.pr ? String(s.pr) : "";
  if(!v) return null;
  return promesse(v) || {libre:v};
}
function promTitre(p){ return p ? (p.libre || p.t) : ""; }
/* Ce qui se lit sur une ligne de liste : la référence seule, pas le verset.
   Il la relit en priant, il ne relit pas tout le psaume. */
function promRefs(p){
  if(!p) return "";
  return p.libre ? p.libre : p.v.map(function(x){ return x[0]; }).join(" · ");
}
function sujetRefs(s){ return promRefs(sujetProm(s)); }
/* 13.eu — l'échéance d'une demande. La plupart n'en ont pas : la conversion
   d'un frère se demande jusqu'à ce qu'elle vienne. Mais certaines sont
   attachées à un jour que le monde a fixé — une prédication, un examen, un
   voyage — et pour celles-là l'ami de minuit sait à quelle heure le jour se
   lève. Un jour, sans heure, et le rebours se calcule : ce qui se déduit ne
   se range pas. */
function echMs(s){
  const p=parse(s && s.ech);
  return p ? new Date(p.y, p.m-1, p.d).getTime() : 0;
}
/* Positif : à venir. Zéro : aujourd'hui. Négatif : passé. */
function echJours(s){
  const t=echMs(s);
  return t ? -joursMs(t) : null;
}
function echTxt(s){
  const j=echJours(s); if(j===null) return "";
  const q=dateJour(echMs(s));
  if(j===0) return "C'est aujourd'hui, le "+q;
  if(j===1) return "C'est demain, le "+q;
  if(j===-1) return "C'était hier, le "+q;
  return j>0 ? "Dans "+duree(j)+", le "+q
             : "C'était il y a "+duree(-j)+", le "+q;
}
/* Sur une ligne, l'abrégé : il relit vite, il ne relit pas une phrase. */
function echCourt(s){
  const j=echJours(s); if(j===null) return "";
  if(j===0) return "aujourd'hui";
  if(j===1) return "demain";
  if(j===-1) return "hier";
  return j>0 ? "dans "+duree(j) : "il y a "+duree(-j);
}
/* La fenêtre de l'écran d'ouverture : sept jours avant, le jour même, puis
   UN seul jour après — celui-là parce que c'est l'instant du mémorial, «
   c'était hier, dis ce qu'Il a fait ». Ensuite l'application se tait : une
   échéance passée est un fait de l'archive, pas une alarme restée allumée. */
const ECH_AVANT = 7, ECH_APRES = 1;
function echProche(s){
  const j=echJours(s);
  return j!==null && j<=ECH_AVANT && j>=-ECH_APRES;
}
/* Un sujet exaucé quitte la liste : la réponse est venue, le jour n'a plus
   rien à annoncer. */
function echeances(){
  return (db.sujets||[]).filter(function(s){
      return echProche(s) && !exaucesDe(s.id).length; })
    .sort(function(a,b){ return echJours(a)-echJours(b); });
}
/* Le nombre visé n'est pas un objectif que l'application fixe : c'est un
   engagement qu'il prend — douze fois, cent fois. Ce qu'on compte en face,
   depuis 13.es, ce sont ses tapes et non les séances : voir impFois(). */
function sujetBut(s){ return (s && s.n>0) ? s.n : 0; }
function sujetReste(s){
  const n=sujetBut(s); if(!n) return null;
  return Math.max(0, n - impFois(s.id));
}
function sujetCompte(s){ return sujetBut(s) ? impTxt(s) : ""; }
/* Un vœu tenu est une chose qu'Il a vue, pas une alerte : il se dit une fois
   et c'est le disciple qui le retire, jamais l'application (P9). */
function sujetsTenus(){
  return (db.sujets||[]).filter(function(s){
    return !s.vu && sujetBut(s) && impFois(s.id)>=sujetBut(s); });
}
/* Le dernier signe d'une personne : la dernière séance où l'un de ses sujets
   a été nommé. Faute de séance, l'horloge part du jour où le sujet a été
   écrit — écrire ne doit pas condamner (13.ep). */
function porteDepuis(gid){
  let der=null, ecrit=null;
  sujetsDe(gid).forEach(function(s){
    const x=sujetDernier(s.id);
    if(x && (der===null || x>der)) der=x;
    const m=s.maj||0;
    if(m && (ecrit===null || m<ecrit)) ecrit=m;
  });
  return {der:der, depuis:(der||ecrit||0)};
}
function ceuxPortes(){
  return (db.gens||[]).filter(function(g){ return sujetsDe(g.id).length; });
}
/* Rangés par l'attente, et celui qui a été nommé aujourd'hui n'y est pas :
   c'est un tour de garde, pas un reproche — « je ne veux pas me fixer
   d'objectif ». Aucun seuil, donc : le nombre de jours est un fait. */
function porteAttente(){
  return ceuxPortes().map(function(g){
      const p=porteDepuis(g.id);
      return {g:g, der:p.der, j:p.depuis ? joursMs(p.depuis) : 0};
    })
    .filter(function(x){ return x.j>0; })
    .sort(function(a,b){ return b.j-a.j; });
}
function porteTxt(x){
  if(!x) return "";
  return x.der ? "Porté il y a "+duree(x.j)
               : "Jamais nommé, "+duree(x.j)+" après l'avoir écrit";
}
/* 13.eu — ce qui arrive. L'alerter sur le MOUVEMENT, jamais sur un seuil
   manqué : la ligne dit le jour et combien de fois il a déjà demandé, deux
   faits — et elle mène au sujet, où se trouve le `+`. Un chiffre qui amène
   quelque part n'est pas un reproche (13.cb). */
function rappelEch(){
  const e=echeances();
  if(!e.length) return "";
  return titreBloc("Ce qui arrive","ecart")
    + liste(e.map(function(s){
        const f=impFois(s.id);
        return ligne({titre:esc(sujetTxt(s.id)),
          sous:esc([f ? "demandé "+f+" fois"+(sujetBut(s) ? " sur "+sujetBut(s) : "")
                      : "pas encore demandé",
                    sujetRefs(s)].filter(Boolean).join(" · ")),
          apres:`<span class="ech pres">${esc(echCourt(s))}</span>`,
          attr:'data-sujo="'+s.id+'"'});
      }).join(""), "lien")
    + `<div class="block amorce">${e.some(function(s){ return echJours(s)<0; })
        ? "Le jour est passé : ouvre et dis ce qu'Il a fait. Ensuite l'application se tait — une échéance passée n'est pas une alarme."
        : "Le jour approche. Ce n'est pas une cadence à tenir : c'est pour que tu saches où tu en es."}</div>`;
}
function rappelPorte(){
  const at=porteAttente(), tenus=sujetsTenus();
  if(!at.length && !tenus.length) return "";
  let h="";
  if(at.length){
    const reste=at.length-3;
    h+=titreBloc("Ceux que tu portes","ecart")
      + liste(at.slice(0,3).map(function(x){
          return ligne({titre:esc(x.g.nom), sous:esc(porteTxt(x)),
            apres:esc(sujetsTxt(sujetsDe(x.g.id).length)),
            attr:'data-porte="'+x.g.id+'"'});
        }).join(""), "lien")
      + (reste>0
         ? liste(ligne({titre:"Et "+reste+" autre"+(reste>1?"s":""),
             sous:"Voir tous ceux que tu portes", attr:'data-go="portes"'}), "lien")
         : "")
      + `<div class="block amorce">Rangés par l'attente, et celui que tu as nommé aujourd'hui n'y est pas. C'est un tour de garde, pas un reproche.</div>`;
  }
  if(tenus.length){
    h+=titreBloc("Tu l'avais dit, tu l'as fait", at.length?"ecart":"")
      + liste(tenus.map(function(s){
          return ligne({titre:esc(sujetTxt(s.id)),
            sous:"Demandé "+impFois(s.id)+" fois, comme tu l'avais dit",
            apres:`<span class="coche">✓</span>`,
            attr:'data-sjvu="'+s.id+'"'});
        }).join(""), "lien");
  }
  return h+`<div style="height:18px"></div>`;
}
function vPortes(){
  Z.titre="Ceux que je porte"; Z.retour=true;
  const at=porteAttente();
  const dedans={}; at.forEach(function(x){ dedans[x.g.id]=1; });
  const aujourd=ceuxPortes().filter(function(g){ return !dedans[g.id]; });
  const sans=(db.gens||[]).filter(function(g){ return !sujetsDe(g.id).length; });
  let h=`<div class="block amorce" style="margin-top:16px">Pour chacun, ce que tu demandes — et depuis combien de temps tu ne l'as pas nommé. Rien à régler : l'ordre est celui de l'attente.</div>`;
  if(at.length)
    h+=titreBloc("Qui attend")+liste(at.map(function(x){
      return ligne({titre:esc(x.g.nom), sous:esc(porteTxt(x)),
        apres:esc(sujetsTxt(sujetsDe(x.g.id).length)),
        attr:'data-porte="'+x.g.id+'"'});
    }).join(""), "lien");
  if(aujourd.length)
    h+=titreBloc("Nommés aujourd'hui","ecart")+liste(aujourd.map(function(g){
      return ligne({titre:esc(g.nom), sous:"Porté aujourd'hui",
        apres:esc(sujetsTxt(sujetsDe(g.id).length)),
        attr:'data-porte="'+g.id+'"'});
    }).join(""), "lien");
  if(sans.length)
    h+=titreBloc("Rien d'écrit encore","ecart")+liste(sans.map(function(g){
      return ligne({titre:esc(g.nom), sous:"Aucun sujet pour cette personne",
        attr:'data-porte="'+g.id+'"'});
    }).join(""), "lien");
  if(!(db.gens||[]).length)
    h+=`<p class="vide">Personne encore. Les gens entrent dans l'archive en notant ce qu'Il a fait par eux.</p>`;
  Z.html=h;
}
function vPorte(){
  const gid=S.porteG, nom=gensNom(gid);
  if(!gid || !nom){ depile("portes"); return render(); }
  Z.titre=nom; Z.retour=true;
  const ss=sujetsDe(gid).slice().sort(function(a,b){
    return (sujetDernier(b.id)||b.maj||0)-(sujetDernier(a.id)||a.maj||0); });
  const p=porteDepuis(gid);
  let h=`<div class="block amorce" style="margin-top:16px">${
    p.der ? "Dernière fois que tu l'as nommé : <b>"+esc(duree(joursMs(p.der)))+"</b>."
          : "Tu ne l'as encore jamais nommé dans une prière."}</div>`;
  if(ss.length){
    h+=titreBloc("Ce que tu demandes");
    /* 13.es — le + est ici, sur la ligne : demander pour quelqu'un et
       compter la demande sont le même instant, et ce qu'on fait tous les
       jours doit coûter un geste (AGENTS §2.g). La pastille est dans le
       lien, mais closest() la trouve avant lui : taper le nombre compte une
       fois, taper le reste de la ligne ouvre le sujet. */
    h+=liste(ss.map(function(s){
      const ex=exauceTxt(s.id), rf=sujetRefs(s), ec=echCourt(s);
      /* 13.et — la référence se lit là où il prie, sur la ligne même : le
         verset se relit en frappant, pas dans un écran qu'il faut ouvrir. */
      return ligne({titre:esc(sujetTxt(s.id)),
        sous:[esc(sujetHist(s.id) || "jamais demandé"),
              ec?`<span class="ech${echProche(s)?" pres":""}">${esc(ec)}</span>`:"",
              rf?`<span class="promref">${esc(rf)}</span>`:"",
              ex?`<span class="exauce">${esc(ex)}</span>`:""].filter(Boolean).join(" · "),
        apres:`<span class="imp" data-imp="${s.id}">${impFois(s.id)}${PLUS}</span>`,
        attr:'data-sujo="'+s.id+'"'});
    }).join(""), "lien");
    h+=`<div class="block amorce">Le <b>+</b> compte une fois de plus. C'est l'importunité : l'ami de minuit obtient à force de frapper, pas à force d'être ami.</div>`;
  } else {
    h+=`<p class="vide">Rien d'écrit pour l'instant.</p>`;
  }
  h+=titreBloc("Demander autre chose","ecart");
  h+=champ("pgSj","Ce que tu demandes, dans tes mots","text","",'autocapitalize="sentences"');
  h+=`<div class="block amorce">Chaque demande est distincte : « sa santé » et « son travail » ne se mélangent pas, et chacune garde son compte.</div>`;
  h+=`<div class="block">${bouton("Ajouter ce sujet", 'data-act="pgAdd"')}</div>`;
  Z.html=h;
}
/* La dynamique qu'il a demandée à la place d'un objectif : « je ne veux pas
   me fixer d'objectif, mais je veux être dans une dynamique de progrès ».
   UN seul nombre — ce qui va à Dieu — et non seize : un nombre agrégé
   supporte le bruit que seize nombres séparés ne supportent pas. D'où
   quatorze jours comptés ici, contre vingt-et-un pour le détail (13.eo). */
function dynProgres(){
  const t1=minuit(0)+86400000, a0=minuit(6), b0=minuit(13);
  const a=cumul(a0, t1).parCat.dieu||0, b=cumul(b0, a0).parCat.dieu||0;
  if(!a && !b) return "Rien n'est allé à Dieu ces deux semaines.";
  const e=a-b;
  if(Math.abs(e) < DYN_BRUIT)
    return "Tu donnes à Dieu <b>"+hm(a)+"</b> cette semaine — autant que la précédente.";
  return "Tu donnes à Dieu <b>"+hm(a)+"</b> cette semaine, "
    + (e>0 ? "<b>"+hm(e)+" de plus</b>" : "<b>"+hm(-e)+" de moins</b>")
    + " que la semaine d'avant.";
}
function rappelProgres(){
  if(joursComptes() < 14) return "";
  return titreBloc("Où tu en es","ecart")
    + `<div class="block amorce">${dynProgres()}</div>`
    + `<div style="height:18px"></div>`;
}

/* ---------- une routine qui se vit en actes (13.er) -----------------------
   Donner, jeûner, être membre fidèle d'une église, servir : on ne lance pas
   un chronomètre pour ces choses-là. Le lien existait, mais par la seule
   circonstance (`pdt`) et pour les seuls actes de Dieu — or sur ses 56
   actes, 25 sont de lui et pas un ne porte de circonstance. L'acte porte
   donc sa routine lui-même, dans `d`, et seulement l'acte de lui : un acte
   de Dieu n'est pas une routine qu'on pratique. */

/* Comme pour une activité (13.em) : l'absence du champ et le choix explicite
   de « aucune routine » ne sont pas la même chose. */
function acteDit(n){ return !!n && n.act==="moi" && ("d" in n); }
function acteDisc(n){ return (n && n.act==="moi" && n.d) ? n.d : ""; }
/* Un acte prévu n'a rien été vécu, et un acte abandonné ne l'a pas été non
   plus : ni l'un ni l'autre ne compte comme signe d'une routine. */
function acteCompte(n){
  return !!n && n.act==="moi" && n.etat!=="prevu" && n.etat!=="abandon";
}
function actesDisc(d, t0, t1){
  return (db.nodes||[]).filter(function(n){
    if(!acteCompte(n) || acteDisc(n)!==d) return false;
    if(t0===undefined) return true;
    const sp=spanActe(n);
    return !!sp && sp[0]<t1 && sp[1]>t0;
  }).sort(parDate);
}
/* Ce que la circonstance permet de proposer — jamais d'appliquer en silence :
   l'assistant l'écrit en clair avant de garder, et une tape la défait. */
function acteDiscPropose(n){
  if(!n || n.act!=="moi" || acteDit(n)) return "";
  const x=n.pdt ? pdtDe(n.pdt) : null;
  return (x && x.d) ? x.d : "";
}
function actesSansDisc(){
  return (db.nodes||[]).filter(function(n){
    return n.act==="moi" && !acteDit(n); }).sort(parDate);
}
function vActesDisc(){
  Z.titre="Mes actes sans routine"; Z.retour=true;
  const ns=actesSansDisc();
  if(!ns.length){
    Z.html=`<div class="block amorce" style="margin-top:16px">Tous tes actes ont dit leur routine, ou qu'ils n'en avaient aucune.</div>`;
    return;
  }
  const prop=ns.filter(function(n){ return acteDiscPropose(n); });
  let h=`<div class="block amorce" style="margin-top:16px">${ns.length} acte${ns.length>1?"s":""} de toi n'${ns.length>1?"ont":"a"} pas dit de quelle routine ${ns.length>1?"ils relèvent":"il relève"}. L'application ne le devinera pas d'après tes mots : « j'ai donné » dans une phrase ne prouve pas la routine.</div>`;
  if(prop.length)
    h+=`<div class="block amorce">Pour ${prop.length} d'entre eux, la circonstance que tu avais posée répond déjà — une tape suffit.</div>`;
  h+=liste(ns.map(function(n){
    const p=acteDiscPropose(n);
    return ligne({titre:esc(court(n.txt, 52)),
      sous:[human(n), p ? "pendant "+esc(discNom(p)) : ""].filter(Boolean).join(" · "),
      apres: p ? esc(discNom(p)) : "",
      attr:'data-adisc="'+n.id+'"'});
  }).join(""), "lien");
  Z.html=h;
}
/* L'écran d'une seule : les seize, et « aucune », qui est un choix. */
function vActeDisc(){
  const n=node(S.adiscId);
  if(!n || n.act!=="moi"){ depile("adisc"); return render(); }
  const cur = acteDit(n) ? (n.d||"") : acteDiscPropose(n);
  Z.titre="De quelle routine ?"; Z.retour=true;
  let h=`<div class="block" style="margin-top:16px"><p class="grand">${esc(court(n.txt, 90))}</p>
    <p class="meta">${esc(human(n)||"")}</p></div>`;
  if(!acteDit(n) && cur)
    h+=`<div class="block amorce">Proposé d'après la circonstance que tu avais posée. Rien n'est écrit tant que tu n'as pas touché.</div>`;
  h+=liste(DISC.map(function(x){
      return ligne({titre:esc(x[1]),
        apres:(cur===x[0]) ? `<span class="coche">✓</span>` : "",
        attr:'data-adiscn="'+n.id+':'+x[0]+'"'});
    }).join("")
    + ligne({titre:"Aucune routine", sous:"Cet acte n'en relève d'aucune",
        apres:(acteDit(n) && !n.d) ? `<span class="coche">✓</span>` : "",
        attr:'data-adiscn="'+n.id+':"'}));
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
  /* 13.el — on n'additionne pas des pages et des parties : ce sont deux
     unités, et leur somme ne voudrait rien dire. */
  let pages=0, parts=0, ms=0;
  const sien={};
  lv.forEach(function(l){ sien[l.id]=1;
    if(enParties(l)) parts+=partiesVues(l.id); else pages+=pageLue(l.id); });
  (db.temps||[]).forEach(function(b){
    const t=tache(b.t);
    const parLivre=(b.pg||[]).some(function(r){ return sien[r[0]]; });
    if(parLivre || (t && t.au===aid)) ms+=Math.max(0, finDe(b)===SANSFIN ? Date.now()-b.deb : b.fin-b.deb);
  });
  return {livres:lv, taches:ts, pages:pages, parts:parts, ms:ms};
}
function recuTxt(r){
  const p=[];
  if(r.livres.length) p.push(r.livres.length+" ouvrage"+(r.livres.length>1?"s":""));
  if(r.pages) p.push(pagesTxt(r.pages));
  if(r.parts) p.push(partiesTxt(r.parts)+" suivies");
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
/* 13.el — un ouvrage dit comment on y avance, et les champs en découlent
   (13.cn). « En pages » est le livre, et reste le défaut : toute fiche écrite
   avant cette règle en est un. « En parties » est ce qui se suit au lieu de
   se feuilleter — un enseignement, une série, un cours. Un enseignement n'a
   pas de nombre de pages ; la question ne lui est donc pas posée. */
function enParties(l){ const o=(typeof l==="string")?livre(l):l; return !!(o && o.sp==="parties"); }
function uniteTxt(lid, n){ return enParties(lid) ? partiesTxt(n) : pagesTxt(n); }
function partiesTxt(n){ return n+" partie"+(n>1?"s":""); }
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
                                     a:aut||"", sp:"pages", maj:Date.now()}]);
  return id;
}
/* Le signet se lit dans l'archive, jamais tenu à jour à part : la page la
   plus avancée qu'on ait notée dans ce livre-là. */
function partiesVues(lid){
  let n=0;
  (db.temps||[]).forEach(function(b){
    (b.pg||[]).forEach(function(r){ if(r[0]===lid) n+=r[2]-r[1]+1; });
  });
  return n;
}
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
  /* Une série n'annonce pas son dernier numéro : elle ne se ferme donc que
     s'il le dit. Un livre, lui, se ferme à sa dernière page. */
  if(enParties(l)) return false;
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
  const n=livreNom(r[0]), u=enParties(r[0]) ? "partie" : "page";
  return r[1]===r[2] ? n+", "+u+" "+r[1] : n+", "+u+"s "+r[1]+" à "+r[2];
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
function listePg(b, horo){
  return liste((b.pg||[]).map(function(r,i){
    return ligne({titre:esc(nomPassagePg(r)),
      sous:(horo ? hmin(new Date(b.deb))+" · " : "")+uniteTxt(r[0], r[2]-r[1]+1),
      apres:`<span class="rouge">Retirer</span>`, attr:'data-pgsup="'+b.id+'|'+i+'"'});
  }).join(""));
}

function listeSj(b, horo){
  return liste((b.sj||[]).map(function(id,i){
    const ex=exauceTxt(id), h=horo ? hmin(new Date(b.deb)) : "";
    return ligne({titre:esc(sujetTxt(id)),
      sous:[h, ex?`<span class="exauce">${esc(ex)}</span>`:""].filter(Boolean).join(" · "),
      apres:`<span class="rouge">Retirer</span>`, attr:'data-sjsup="'+b.id+'|'+i+'"'});
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
  /* La fiche est celle de la séance. Une prière coupée en quatre posait la
     question quatre fois, chaque fois sur une page blanche — l'app se
     répétait, et elle n'apprenait rien en se répétant (13.cg, 13.eh). Ce
     qui est déjà nommé dans la séance est donc là, et ne se propose plus :
     un sujet porté dans cette prière l'est une fois, pas quatre. */
  const se=seanceDe(b), reprise=se.length>1;
  const sur=[]; se.forEach(function(x){ (x.sj||[]).forEach(function(id){ sur.push(id); }); });
  const pris={};
  sur.forEach(function(id){ pris[id]=1; });
  let h=`<div class="block amorce" style="margin-top:16px">${
    reprise ? "Tu reprends la séance commencée à <b>"+hmin(new Date(se[0].deb))+"</b>. Ce qui y est déjà nommé y reste — ajoute seulement ce qui s'est dit depuis."
            : "Un sujet par ligne, comme dans ton cahier. Ce qui revient, tu le retrouves d'un geste."
  }</div>`;
  if(sur.length){
    h+=titreBloc((reprise ? "Nommés dans cette séance — " : "Nommés ici — ")+sujetsTxt(sur.length));
    se.forEach(function(x){ if((x.sj||[]).length) h+=listeSj(x, reprise); });
  }
  /* 13.ek — les tapes d'abord, le clavier ensuite. Un champ de saisie en tête
     d'écran dit que le clavier est le chemin ; et comme les deux listes
     d'alors ne se remplissaient que de ce qu'il avait déjà tapé, elles
     restaient vides le premier jour — et le restaient tout court. Quatre
     séances de prière, zéro sujet. L'ordre de l'écran est donc l'ordre du
     coût : ce qu'il a nommé la dernière fois, ce que l'application tient
     déjà, ce qu'il a nommé un jour, et en dernier le clavier. */
  const der=sujetsDerniers(b).filter(function(id){ return !pris[id] && sujet(id); });
  const vus={}; der.forEach(function(id){ vus[id]=1; });
  if(der.length)
    h+=`<div class="sjgrp">`+titreBloc("La dernière fois","ecart")+liste(der.map(ligneSj).join(""))+`</div>`;
  const dehors={}; Object.keys(pris).forEach(function(k){ dehors[k]=1; });
  Object.keys(vus).forEach(function(k){ dehors[k]=1; });
  h+=tendusSj(dehors);
  const autres=(db.sujets||[]).filter(function(s){ return !pris[s.id] && !vus[s.id]; })
    .sort(function(a,b2){ return (b2.maj||0)-(a.maj||0); });
  if(autres.length)
    h+=`<div class="sjgrp">`+titreBloc("Déjà nommés, une autre fois","ecart")
      + liste(autres.map(function(s){ return ligneSj(s.id); }).join(""))+`</div>`;
  h+=titreBloc("Nommer autre chose", "ecart");
  h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
    <input type="text" id="sjQ" placeholder="Chercher, ou nommer un sujet" value="${esc(S.sjQ||"")}" autocomplete="off" autocapitalize="sentences"></div></div></li>`);
  h+=`<div class="list list-strong list-outline list-dividers inset" id="sjNeuf" hidden><ul>${
      ligne({titre:`<span class="qn"></span>`, attr:'data-act="sjAdd"'})}</ul></div>`;
  Z.html=h;
  Z.action=bouton("Terminé", 'data-back="1"');
}

/* Le même cahier, une autre unité. Mais une différence qui commande tout :
   on prêche à des foules, et on ne peut pas nommer une foule. Une ligne sans
   nom est donc une ligne entière — quelqu'un a entendu l'Évangile, et c'est
   le fait qui compte, pas le fichier. Le nom, quand on l'a, relie cette
   annonce au reste du mémorial : à la personne, et aux actes de Dieu sur
   elle (13.df). */
function listeQui(b, horo){
  return liste((b.qui||[]).map(function(id,i){
    const n = id ? gensNom(id) : "";
    return ligne({titre: n ? esc(n) : `<span class="amorce">Quelqu'un que tu n'as pas nommé</span>`,
      sous:(horo ? hmin(new Date(b.deb)) : ""),
      apres:`<span class="rouge">Retirer</span>`, attr:'data-qsup="'+b.id+'|'+i+'"'});
  }).join(""));
}
function ligneQui(g){
  return ligne({titre:esc(g.nom), attr:'data-qadd="'+g.id+'" data-gn="'+esc(String(g.nom).toLowerCase())+'"'});
}
function vAnnonce(){
  const b=blocT(S.blocId);
  if(!b){ depile("temps"); return render(); }
  Z.titre="À qui tu as annoncé"; Z.retour=true;
  /* Même règle qu'au cahier : la sortie reprise après un creux est la même
     sortie, et on n'y annonce pas deux fois à la même personne (13.eh). */
  const se=seanceDe(b), reprise=se.length>1;
  const sur=[]; se.forEach(function(x){ (x.qui||[]).forEach(function(id){ sur.push(id); }); });
  const pris={};
  sur.forEach(function(id){ if(id) pris[id]=1; });
  let h=`<div class="block amorce" style="margin-top:16px">${
    reprise ? "Tu reprends la séance commencée à <b>"+hmin(new Date(se[0].deb))+"</b>. Ceux qui y sont déjà comptés y restent."
            : "Une ligne par personne. Celles que tu peux nommer, nomme-les ; les autres comptent quand même."
  }</div>`;
  if(sur.length){
    h+=titreBloc((reprise ? "Dans cette séance — " : "Ici — ")+gensTxt(sur.length));
    se.forEach(function(x){ if((x.qui||[]).length) h+=listeQui(x, reprise); });
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

/* Le cahier, enfin feuilletable. Jusqu'ici un sujet ne se lisait que sur la
   séance qui l'avait nommé ou sur l'acte qui l'avait exaucé : on ne pouvait
   pas poser la question que ce cahier pose depuis des années — « qu'est-ce
   que je porte encore devant Lui ? » (13.di).
   « En attente » ouvre, et non « Tout » : un cahier de prière se tient pour
   ce qui n'a pas encore reçu de réponse. Ce qui est exaucé a déjà sa place
   dans Ses œuvres. */
const SJF = [["attente","En attente"],["exauces","Exaucés"],["tout","Tout"]];
function vCahier(){
  const tous=(db.sujets||[]).slice();
  const exauce=function(s){ return exaucesDe(s.id).length>0; };
  const nEx=tous.filter(exauce).length;
  /* Du dernier nommé au premier : ce qu'on porte en ce moment remonte, ce
     qu'on a cessé de dire descend tout seul. L'ancienneté ne se perd pas
     pour autant — chaque ligne dit depuis quand. */
  const vus=tous.filter(function(s){
      return S.sjF==="tout" || (S.sjF==="exauces" ? exauce(s) : !exauce(s));
    }).sort(function(a,b){
      return (sujetDernier(b.id)||b.maj||0)-(sujetDernier(a.id)||a.maj||0);
    });
  Z.titre="Mes sujets"; Z.retour=true;
  if(!tous.length){
    Z.html=`<div class="block amorce" style="margin-top:16px">Les sujets viennent en priant : à l'arrêt d'une prière, l'app te demande ce que tu as nommé, et chaque ligne se range ici.</div>`;
    return;
  }
  let h=`<div class="block amorce" style="margin-top:16px">${
      esc(sujetsTxt(tous.length))+(nEx?" · "+nEx+" exaucé"+(nEx>1?"s":""):"")}</div>`
    + liste(ligne({titre:"Ceux que je porte",
        sous: ceuxPortes().length
          ? ceuxPortes().length+" personne"+(ceuxPortes().length>1?"s":"")+" pour qui tu demandes quelque chose"
          : "Rattacher un sujet à quelqu'un, et voir qui attend",
        attr:'data-go="portes"'}), "lien")
    + `<div class="puces">${SJF.map(function(f){
        return `<button class="puce" data-sjf="${f[0]}" aria-pressed="${S.sjF===f[0]}">${f[1]}</button>`;
      }).join("")}</div>`
    + champ("sjQ","Chercher un sujet","text",esc(S.sjQ||""),'autocomplete="off" autocapitalize="sentences"');
  if(!vus.length){
    h+=`<p class="vide">${S.sjF==="exauces" ? "Aucun sujet exaucé pour l'instant."
        : "Tout ce que tu as nommé a reçu sa réponse."}</p>`;
  } else {
    h+=liste(vus.map(function(s){
      const ex=exauceTxt(s.id), hi=sujetHist(s.id), rf=sujetRefs(s), ec=echCourt(s);
      const tx=sujetTxt(s.id);
      return ligne({titre:esc(tx),
        sous:[hi?esc(hi):"", ec?`<span class="ech${echProche(s)?" pres":""}">${esc(ec)}</span>`:"",
              rf?`<span class="promref">${esc(rf)}</span>`:"",
              ex?`<span class="exauce">${esc(ex)}</span>`:""].filter(Boolean).join(""),
        attr:'data-sujo="'+s.id+'" data-sjn="'+esc(String(tx).toLowerCase())+'"'});
    }).join(""), "lien");
    h+=`<p class="vide" id="sjRien" hidden>Rien ne correspond.</p>`;
  }
  Z.html=h;
}

/* La fiche d'un sujet, c'est la ligne du cahier dépliée : ce qu'on a
   demandé, depuis quand, combien de fois — et ce qu'Il a fait. Tout s'y lit,
   rien ne s'y tient à jour (13.di). */
function vSujet(){
  const s=sujet(S.sujId);
  if(!s){ depile("cahier"); return render(); }
  const ex=exaucesDe(s.id), se=seancesDe(s.id);
  Z.titre="Un sujet"; Z.retour=true;
  const suit = s.lie ? (String(s.lie).charAt(0)==="g"
      ? (gensNom(s.lie) ? pt("Ce sujet suit la fiche "+de(gensNom(s.lie))) : "")
      : (node(s.lie) ? "Ce sujet suit un acte de ton mémorial." : "")) : "";
  let h=`<div class="block" style="margin-top:20px">
      <p class="grand" style="font-size:21px">${esc(sujetTxt(s.id))}</p>
      <p class="meta">${esc(sujetHist(s.id) || "jamais demandé")}</p>
    </div>`;
  /* 13.es — le compteur en premier et en grand : c'est le geste du
     quotidien, il ne se cherche pas au bas d'un écran. */
  h+=`<div class="block impbloc">
      <div class="impn">${impFois(s.id)}</div>
      <div class="impl">fois demandé${sujetBut(s) ? " sur "+sujetBut(s)+" que tu t'es promis" : ""}</div>
    </div>`;
  /* 13.eu — le terme se lit sous le compteur, et jamais divisé par lui :
     l'engagement est à lui, le jour est au monde. Pas de « il te reste
     treize fois en deux jours » : ce serait une cadence imposée. */
  if(echJours(s)!==null)
    h+=`<div class="block ${echProche(s)?"echbloc pres":"echbloc"}">${esc(echTxt(s))}</div>`;
  h+=`<div class="block">${bouton("J'ai demandé une fois de plus", 'data-imp="'+s.id+'"')}</div>`;
  h+=`<div class="block amorce">« C'est à cause de son importunité qu'il se lèvera et lui donnera. » Compte chaque fois que tu portes ceci devant Dieu — l'application ne frappe pas à ta place.</div>`;
  /* 13.et — la promesse se tient ICI, entre ce qu'il demande et ce qu'Il a
     fait : c'est l'ordre de la phrase d'Ében-Ézer, et sans elle un
     exaucement n'est qu'un fait isolé. L'écran se lit donc dans cet
     ordre-là, et pas dans un autre. */
  const pr=sujetProm(s);
  h+=titreBloc("Ce qu'Il avait dit","ecart");
  if(pr){
    h+=`<div class="block prom">
        <p class="promt">${esc(promTitre(pr))}</p>
        ${(pr.v||[]).map(function(x){
            return `<p class="promv"><span class="promr">${esc(x[0])}</span> ${esc(x[1])}</p>`;
          }).join("")}
      </div>`;
    h+=liste(ligne({titre:"Changer la promesse", sous:"Ou la retirer",
        attr:'data-prom="'+s.id+'"'}), "lien");
  } else {
    h+=`<div class="block amorce">Ton cahier a une colonne pour cela : <i>référence biblique</i> — la parole sur laquelle tu demandes. Elle n'est pas devinée à ta place.</div>`;
    h+=`<div class="block">${bouton("Choisir une promesse", 'data-prom="'+s.id+'"')}</div>`;
  }
  h+=titreBloc("Ce qu'Il a fait","ecart");
  h+= ex.length
    ? liste(ex.map(function(n){ return ligneActe(n,{attr:'data-node="'+n.id+'"'}); }).join(""))
    : `<p class="vide">Rien encore. Tu le portes toujours.</p>`;
  /* Un compteur qu'on ne peut pas reprendre n'est pas un compteur (13.cl) :
     la tape de trop se retire ici. Et la plus ancienne est la « date
     première prière » de son cahier, sans qu'on ait eu à la demander. */
  const im=impsDe(s.id);
  if(im.length){
    h+=titreBloc("Chaque fois que tu as demandé","ecart");
    const montre = im.length>12 ? im.slice(0,10) : im;
    h+=liste(montre.map(function(x){
      return ligne({titre:esc(dateJour(x.ts)), sous:esc(hmin(new Date(x.ts))),
        apres:`<span class="rouge">retirer</span>`,
        attr:'data-impx="'+x.id+'"'});
    }).join("")
    + (montre.length<im.length
       ? ligne({titre:"Et "+(im.length-montre.length)+" autres",
           sous:"La première, le "+esc(dateJour(impPremier(s.id)))})
       : ""), "lien");
  }
  if(se.length){
    h+=titreBloc("Les séances où tu l'as nommé","ecart");
    h+=liste(se.map(function(b){
      const n=seanceDe(b).length;
      return ligne({titre:esc(dateJour(b.deb)),
        sous:esc(tacheNom(b.t))+" · "+hmin(new Date(b.deb))+(n>1 ? " · en "+n+" fois" : ""),
        attr:'data-vbloc="'+b.id+'"'});
    }).join(""), "lien");
  }
  h+=titreBloc("Le dire autrement","ecart");
  /* Un sujet est OU bien celui d'une fiche, OU bien dans ses mots — jamais
     les deux, sinon deux libellés se disputent la même ligne. Ses mots
     l'emportent toujours, mais l'écran le dit avant, pas après (P9). */
  if(suit) h+=`<div class="block amorce">${esc(suit)} Si tu écris tes propres mots, il s'en détache.</div>`;
  h+=champ("sjTxt","Le sujet, dans tes mots","text",esc(sujetTxt(s.id)),'autocapitalize="sentences"');
  h+=`<div class="block">${bouton("Garder ce texte", 'data-act="sjGarder"')}</div>`;
  /* 13.eq — pour qui, et combien de fois. Les deux vivent ensemble : c'est
     le même geste, « ce que je demande à Dieu pour untel, et combien de fois
     je me suis engagé à le demander ». */
  h+=titreBloc("Pour qui","ecart");
  h+=liste(champSel("sjG","La personne",
      `<option value=""${sujetGens(s)?"":" selected"}>— personne en particulier —</option>`
      + (db.gens||[]).map(function(g){
          return `<option value="${g.id}"${sujetGens(s)===g.id?" selected":""}>${esc(g.nom)}</option>`;
        }).join("")));
  /* 13.eq, 13.eu — ce qu'il s'est promis, et le jour que le monde a fixé.
     Deux faits distincts, un seul geste : c'est le même moment où l'on dit
     « je demanderai ceci vingt fois, et c'est pour samedi ». */
  h+=titreBloc("Ton engagement","ecart");
  h+=`<div class="block amorce">${sujetBut(s)
      ? "<b>"+esc(impTxt(s))+".</b> Ce n'est pas l'application qui a fixé ce nombre — c'est toi."
      : "Si tu t'es engagé à demander ceci un certain nombre de fois, dis-le. Vide, ou zéro, pour compter sans fin."}
      ${s.ech ? "" : " Et si la demande est attachée à un jour — une prédication, un examen, un voyage — pose-le : l'écran d'ouverture te le rappellera quand il approchera."}</div>`;
  h+=liste(champLab("sjN","Combien de fois",
        `<input type="number" id="sjN" value="${sujetBut(s)||""}" min="0" inputmode="numeric" placeholder="sans fin">`)
      + champLab("sjE","Jusqu'à quand",
        `<input type="date" id="sjE" value="${esc(s.ech||"")}">`));
  h+=`<div class="block amorce">Vider la date la retire : la demande redevient sans terme.</div>`;
  h+=`<div class="block">${bouton("Garder", 'data-act="sjPour"')}</div>`;
  Z.html=h;
  Z.action = bouton(ex.length ? "Il y a répondu encore" : "Il y a répondu",
    'data-sujrep="'+s.id+'"');
}

/* 13.et — un écran répond à une question (13.cs) : *sur quelle promesse ?*
   Trente besoins au bas d'une fiche, dans un menu déroulant, ne se lisent
   pas ; ici les versets sont écrits en entier, parce que le geste qu'il fait
   avec son livre ouvert est précisément de les LIRE avant de choisir. Le
   champ libre est en dessous, et jamais au-dessus : un besoin choisi dans la
   liste se regroupe et se relie plus tard, un texte tapé ne se relie à rien
   (AGENTS §1). Mais il ne bloque pas : une liste qui ne couvre pas son cas
   lui fermerait la porte. */
function vPromesse(){
  const s=sujet(S.sujId);
  if(!s){ depile("cahier"); return render(); }
  Z.titre="Sur quelle promesse"; Z.retour=true;
  const pr=sujetProm(s);
  let h=`<div class="block" style="margin-top:20px">
      <p class="grand" style="font-size:19px">${esc(sujetTxt(s.id))}</p>
      <p class="meta">${pr ? "Tu t'appuies sur "+esc(promTitre(pr))
                           : "Aucune parole posée pour l'instant"}</p>
    </div>`;
  /* Ce qui est posé se retire (13.cl) : une promesse qu'on ne peut pas
     changer n'est pas une promesse choisie, c'est une étiquette. */
  if(pr) h+=liste(ligne({titre:"Retirer cette promesse",
      apres:`<span class="rouge">retirer</span>`, attr:'data-prx="'+s.id+'"'}), "lien");
  h+=`<div class="block amorce">« Toute parole de Dieu est éprouvée. Il est un bouclier pour ceux qui cherchent en Lui un refuge. » <i>Proverbes 30:5</i> — ta page, rangée par besoin.</div>`;
  h+=champ("prQ","Chercher un besoin, un livre, un mot","text",esc(S.prQ||""),
      'autocomplete="off" autocapitalize="sentences"');
  PROMESSES.forEach(function(c){
    h+=`<div class="prgrp">`+titreBloc(esc(c.cat),"ecart")
      + liste(c.items.map(function(x){
          const mots=(x.t+" "+x.v.map(function(y){ return y[0]+" "+y[1]; }).join(" ")).toLowerCase();
          return ligne({titre:esc(x.t),
            sous:esc(x.v.map(function(y){ return y[0]; }).join(" · ")),
            texte:x.v.map(function(y){ return esc(y[1]); }).join("<br>"),
            apres:(pr && pr.id===x.id) ? `<span class="coch">✓</span>` : "",
            attr:'data-prch="'+x.id+'" data-prn="'+esc(mots)+'"'});
        }).join(""), "lien")
      + `</div>`;
  });
  h+=`<p class="vide" id="prRien" hidden>Rien ne correspond dans la liste. Écris ta référence plus bas.</p>`;
  h+=titreBloc("Une autre parole, dans tes mots","ecart");
  h+=`<div class="block amorce">Si la liste n'a pas ton cas, écris ta référence. Elle détache le sujet de la liste : une demande s'appuie sur une parole, pas sur deux.</div>`;
  h+=champ("prT","Par exemple : Ésaïe 54:17","text", (pr&&pr.libre)?esc(pr.libre):"",
      'autocapitalize="sentences"');
  h+=`<div class="block">${bouton("Garder cette référence", 'data-act="prPose"')}</div>`;
  Z.html=h;
}

/* Une seule liste, comme pour l'Écriture : le départ est le signet, et la
   seule question est jusqu'où. Les autres livres entamés sont là, en
   pastilles — changer de livre reste un geste, pas un écran. */
function vPages(){
  const b=blocT(S.blocId);
  if(!b){ depile("temps"); return render(); }
  /* La fiche est celle de la séance, pas du bloc : une séance interrompue
     reste une séance, et ce qu'elle a déjà recueilli est déjà sous les yeux
     au lieu d'être redemandé à blanc (13.eh). */
  const se=seanceDe(b);
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
  /* 13.el — ce qui s'écoute ne se pagine pas. Un ouvrage en parties ne pose
     pas « jusqu'où » : le signet donne la suivante, et une tape la garde. */
  const par=enParties(l);
  let h=`<div class="block amorce" style="margin-top:16px">${
    par ? (vue ? "Tu reprends <b>"+esc(l.nom)+"</b> à la <b>partie "+a+"</b>."
               : "Tu commences <b>"+esc(l.nom)+"</b>, à la <b>partie "+a+"</b>.")
        : (vue ? "Tu reprends <b>"+esc(l.nom)+"</b> à la page <b>"+a+"</b>. Jusqu'où es-tu allé ?"
               : "Tu commences <b>"+esc(l.nom)+"</b>. Jusqu'où es-tu allé ?")
  }</div>`;
  const ouv=livresOuverts();
  if(ouv.length>1 || (ouv.length===1 && ouv[0].id!==l.id) || (db.livres||[]).length>1){
    h+=`<div class="puces">${(db.livres||[]).filter(function(x){ return !livreFini(x) || x.id===l.id; })
      .map(function(x){ return `<button class="puce" data-pgl="${x.id}" aria-pressed="${x.id===l.id}">${esc(x.nom)}</button>`; }).join("")}</div>`;
  }
  /* La borne : un livre va jusqu'à sa dernière page, une série n'annonce
     rien — on n'offre donc qu'une poignée de parties au-delà, de quoi en
     garder plusieurs d'un coup sans faire défiler un catalogue. */
  h+=titreBloc(par ? "Et si tu en as suivi plusieurs" : "Jusqu'où");
  let o="";
  const bout = par ? a+30 : (tot ? tot : a+500);
  for(let i=a;i<=bout;i++) o+=`<option value="${i}"${i===z?" selected":""}>${i}</option>`;
  h+=liste(champSel("pgZ", par ? "Dernière partie suivie" : "Dernière page lue", o));
  const reste = tot ? Math.max(0, tot-z) : 0;
  const suivies = par ? partiesVues(l.id) : 0;
  h+=`<div class="block amorce"><b>${esc(nomPassagePg([l.id,a,z]))}</b> — ${uniteTxt(l.id, z-a+1)}.${
    par ? (suivies ? " Tu en auras suivi "+(suivies+(z-a+1))+" en tout." : "")
        : (!tot ? "" : (reste ? " Il te restera "+pagesTxt(reste)+" sur "+tot+"." : " Tu l'auras terminé."))}</div>`;
  h+=liste(ligne({titre:"Un autre livre", sous:"En ajouter un, ou corriger ses pages",
      attr:'data-act="livreNeuf"'})
    + ligne({titre: par ? "Cet ouvrage" : "Ce livre",
      sous:esc(l.nom)+(par ? " — en parties" : (tot?" — "+tot+" pages":" — pages inconnues")),
      attr:'data-lv="'+l.id+'"'}), "lien");
  h+=dejaSeance(se, se.length>1, "pg", listePg);
  Z.html=h;
  /* Le bouton dit ce qu'il garde : sur une série, c'est tout ce qu'il y a à
     faire, et il doit se voir comme tel (13.ek — une tape, pas un clavier). */
  Z.action=bouton(par ? (a===z ? "Garder la partie "+a : "Garder les parties "+a+" à "+z)
                      : "Garder", 'data-act="addPg"');
}

/* Un livre est une fiche minuscule — un titre, un nombre de pages — et
   c'est le nombre de pages qui fait tout le reste : sans lui, « page 84 »
   est un chiffre sans horizon. */
function vLivre(){
  const l=S.lvId ? livre(S.lvId) : null;
  /* 13.el — la première question n'est pas le titre, c'est la nature de la
     chose : ce qui se feuillette ou ce qui se suit. Tout le reste de l'écran
     en découle, le nombre de pages comme le mot « livre » lui-même. */
  const sp = S.lvSp || (l ? (l.sp==="parties" ? "parties" : "pages") : "pages");
  const par = sp==="parties";
  Z.titre = l ? (par ? "Cet ouvrage" : "Ce livre") : (par ? "Un ouvrage" : "Un livre");
  Z.retour=true;
  let h=titreBloc("Comment on y avance");
  h+=`<div class="puces">
    <button class="puce" data-lvsp="pages" aria-pressed="${!par}">En pages</button>
    <button class="puce" data-lvsp="parties" aria-pressed="${par}">En parties</button></div>`;
  h+=`<div class="block amorce">${
    par ? "Un enseignement, une série, un cours : ce qui se <b>suit</b> au lieu de se feuilleter. Il n'a pas de nombre de pages, et on ne te le demandera pas."
        : "Un livre. Le titre, et le nombre de pages — c'est lui qui permet de dire où tu en es, et ce qu'il te reste."
  }</div>`;
  h+=titreBloc("Le titre","ecart");
  h+=champ("lvNom", "Le titre du livre", "text", l?esc(l.nom):"", 'autocapitalize="sentences"');
  h+=titreBloc("L'auteur","ecart");
  h+=`<div class="block amorce">Qui l'a écrit. On garde la liste, pour savoir de qui tu reçois.</div>`;
  h+=champ("lvAuteur", "Son nom", "text", (l&&l.a)?esc(auteurNom(l.a)):"", 'autocapitalize="words"');
  h+=pucesAuteurs("lvAuteur");
  if(!par){
    h+=titreBloc("Le nombre de pages","ecart");
    h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
        <input type="number" id="lvPages" inputmode="numeric" min="1" max="9999" placeholder="240" value="${(l&&l.pages)?l.pages:""}"></div></div></li>`);
  }
  if(l){
    const vue=pageLue(l.id);
    h+=titreBloc("Où tu en es","ecart");
    h+=liste(ligne({titre: par ? "Dernière partie suivie" : "Page atteinte",
        apres:esc(par ? String(vue) : String(vue)+(l.pages?" / "+l.pages:""))})
      + ligne({titre: l.fini ? "Finalement, je ne l'ai pas fini" : "Je l'ai fini",
               sous: l.fini ? "Il reviendra dans ce qui est en cours" : "Il quittera ce qui est en cours",
               attr:'data-act="livreFin"'}));
  }
  Z.html=h;
  Z.action=bouton(l ? "Garder" : (par ? "Ajouter cet ouvrage" : "Ajouter ce livre"),
    'data-act="livreGarder"');
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
        sous:"Le livre et les chapitres traversés", attr:'data-act="direLu"'})
      + portesSeance(b, "lu", "passage"), "lien");
  }
  if(spTache(b.t)==="livre"){
    h+=titreBloc("Ce que tu as lu","ecart");
    if((b.pg||[]).length) h+=listePg(b);
    h+=liste(ligne({titre:(b.pg||[]).length ? "Ajouter un passage" : "Dire les pages lues",
        sous:"Le livre et les pages traversées", attr:'data-act="direPg"'})
      + portesSeance(b, "pg", "passage"), "lien");
  }
  if(spTache(b.t)==="sujets"){
    h+=titreBloc("Ce que tu as nommé","ecart");
    if((b.sj||[]).length) h+=listeSj(b);
    h+=liste(ligne({titre:(b.sj||[]).length ? "En nommer un autre" : "Dire ce que tu as nommé",
        sous:"Les sujets, un par ligne", attr:'data-act="direSj"'})
      + portesSeance(b, "sj", "sujet"), "lien");
  }
  if(spTache(b.t)==="gens"){
    h+=titreBloc("À qui tu as annoncé","ecart");
    if((b.qui||[]).length) h+=listeQui(b);
    h+=liste(ligne({titre:(b.qui||[]).length ? "En ajouter" : "Dire à qui tu as annoncé",
        sous:"Une ligne par personne", attr:'data-act="direQui"'})
      + portesSeance(b, "qui", "personne"), "lien");
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
/* ---------- l'état de l'archive ----------
   Le compteur figé de v102 a été trouvé à l'œil : le disciple a vu, à
   13 h 10, que le rail et « Mon temps » ne disaient pas la même chose. Ce
   n'est pas son travail. Une valeur impossible — une heure posée plus loin
   que maintenant, un acte qui répond à un acte effacé — ne fait pas tomber
   l'application : elle la fait mentir doucement, sur un écran, et elle peut
   rester là des semaines.

   L'application se mesure déjà elle-même (13.dn) ; elle se vérifie
   maintenant. Elle NOMME ce qui ne se tient pas, elle dit ce que ça coûte,
   et chaque ligne mène à la fiche — jamais un reproche sans porte (13.cb).
   Elle ne répare rien : corriger une heure, c'est dire ce qu'on a vécu, et
   personne ne le dit à la place du disciple (P9, 13.cf).

   Et elle ne parle que lorsqu'elle a trouvé quelque chose : une porte
   « tout va bien » qu'on ouvre tous les jours pour lire « tout va bien »
   n'apprend plus rien à personne (13.cb). */
const VERIF_MAX = 6;
/* Une minute de battement : deux appareils ne sont jamais à la seconde, et
   il ne s'agit pas de leur reprocher leur écart (13.ea). */
const VERIF_JEU = 60000;
function verifArchive(){
  const n=Date.now(), out=[];
  const T=db.temps||[], P=db.periodes||[], N=db.nodes||[], M=db.morts||{};
  function dit(titre, quoi, items){ if(items.length) out.push({titre:titre, quoi:quoi, items:items}); }
  function pb(b){ return {txt: tacheNom(b.t)+" · "+jourBref(b.deb)+hmin(new Date(b.deb)),
                          attr:'data-vbloc="'+b.id+'"'}; }
  function pp(pr){ return {txt: (discNom(pr.d)||"Un temps mis à part")+" · "+jourBref(pr.deb)+hmin(new Date(pr.deb)),
                           attr:'data-prd="'+pr.id+'"'}; }
  function pn(x){ return {txt: (x.txt||"Un acte sans mot").slice(0,70),
                          attr:'data-node="'+x.id+'"'}; }
  const aVenir = function(ms){ return typeof ms==="number" && ms > n+VERIF_JEU; };

  dit("Une heure qui n'est pas encore arrivée",
      "Un temps qu'on n'a pas vécu ne se déclare pas. Tant qu'il est là, « Mon temps » compte la journée jusqu'au bout et le rail ne compte plus rien (13.ea).",
      T.filter(function(b){ return aVenir(b.deb) || aVenir(b.fin); }).map(pb)
       .concat(P.filter(function(x){ return aVenir(x.deb) || aVenir(x.fin); }).map(pp)));

  dit("Une fin avant son début",
      "Ce bloc ne dure rien. Il ne pèse dans aucun total, et la prochaine réunion de tes deux appareils le laissera tomber sans rien dire.",
      T.filter(function(b){ return typeof b.fin==="number" && b.fin<=b.deb; }).map(pb)
       .concat(P.filter(function(x){ return typeof x.fin==="number" && x.fin<=x.deb; }).map(pp)));

  dit("Un bloc dont l'activité a disparu",
      "Le temps est compté, mais il ne va plus à rien de nommé : les écrans affichent « — » à sa place. Rouvre le bloc et rends-lui son activité.",
      T.filter(function(b){ return !tache(b.t); }).map(pb));

  dit("Un temps mis à part dont la routine a disparu",
      "Il n'a plus de nom, donc plus de place dans « Les routines ».",
      P.filter(function(x){ return !discNom(x.d); }).map(pp));

  dit("Un acte qui répond à un acte effacé",
      "C'est le fil du mémorial qui est coupé : la réponse est là, la recherche qui l'a précédée ne l'est plus. Rouvre l'acte et relie-le à ce qui l'a vraiment précédé.",
      N.filter(function(x){ return (x.par||[]).some(function(id){ return !node(id); }); }).map(pn));

  dit("Un acte lié à un sujet effacé",
      "Le sujet exaucé ne se retrouve plus depuis l'acte, ni l'acte depuis le sujet.",
      N.filter(function(x){ return (x.suj||[]).some(function(id){
        return !(db.sujets||[]).some(function(s){ return s.id===id; }); }); }).map(pn));

  dit("Un acte rattaché à un temps effacé",
      "Il dit « pendant » quelque chose qui n'existe plus (13.cx).",
      N.filter(function(x){ return x.pdt && !pdtDe(x.pdt); }).map(pn));

  dit("Un acte dont la personne a disparu",
      "On ne sait plus par qui Il est passé.",
      N.filter(function(x){ return x.gid && !(db.gens||[]).some(function(g){ return g.id===x.gid; }); }).map(pn));

  /* La plus grave, et la seule qu'on ne voit jamais : tout est à sa place à
     l'écran, et la prochaine synchronisation l'emporte (13.be). */
  const registres = [["nodes", N, pn], ["temps", T, pb], ["periodes", P, pp]];
  const condamnes = [];
  registres.forEach(function(r){
    r[1].forEach(function(x){
      const t=M[x.id];
      if(t && t >= (x.maj||0)) condamnes.push(r[2](x));
    });
  });
  dit("Une fiche qu'une pierre tombale va emporter",
      "Elle est là, et elle porte sa propre pierre tombale : la prochaine réunion de tes deux appareils l'effacera. Rouvre-la et touche-la — la dernière écriture l'emporte.",
      condamnes);

  const vus={}, doubles=[];
  registres.forEach(function(r){
    const dejaVu={};
    r[1].forEach(function(x){
      if(dejaVu[x.id]){ if(!vus[x.id]){ vus[x.id]=1; doubles.push(r[2](x)); } }
      else dejaVu[x.id]=1;
    });
  });
  dit("Deux fiches sous le même identifiant",
      "Elles se disputent la même place : réunir deux appareils n'en gardera qu'une, au hasard.",
      doubles);

  return out;
}
function verifCompte(){
  return verifArchive().reduce(function(a, v){ return a+v.items.length; }, 0);
}
/* Derrière le rouage, la ligne parle dans les deux cas : on y vient pour
   savoir, et « rien à signaler » est une réponse. Sur Aujourd'hui, non — là,
   le silence est la réponse (13.cb). */
function verifDit(){
  const k=verifCompte();
  return k ? k+" chose"+(k>1?"s":"")+" à regarder" : "Tout se tient";
}
function vVerif(){
  Z.titre="L'état de l'archive"; Z.retour=true;
  const vs=verifArchive();
  if(!vs.length){
    Z.html = `<div class="block amorce" style="margin-top:18px">Tout se tient. Chaque acte répond à un acte qui existe, chaque bloc porte une activité, et aucune heure n'est posée plus loin que maintenant.</div>`;
    return;
  }
  Z.html = `<div class="block amorce" style="margin-top:18px">Rien n'est cassé : l'application fonctionne. Mais ces fiches-là disent quelque chose d'impossible, et un écran finira par te mentir à cause d'elles. Touche une ligne pour l'ouvrir — c'est toi qui corriges.</div>`
    + vs.map(function(v, i){
        const trop = v.items.length - VERIF_MAX;
        return titreBloc(esc(v.titre)+" · "+v.items.length, i ? "ecart" : "")
          + `<div class="block amorce">${esc(v.quoi)}</div>`
          + liste(v.items.slice(0, VERIF_MAX).map(function(x){
              return ligne({titre:esc(x.txt), attr:x.attr}); }).join("")
            + (trop>0 ? ligne({titre:"…et "+trop+" de plus"}) : ""), "lien");
      }).join("");
}
/* Une porte qu'on ne pousse jamais ne vérifie rien : quand l'archive a
   quelque chose à dire, elle le dit là où le disciple passe tous les jours —
   tout en bas, après ce qu'il est venu lire, jamais devant (13.cb). */
function rappelVerif(){
  const k=verifCompte();
  if(!k) return "";
  return titreBloc("Ce qui ne se tient pas","ecart")
    + liste(ligne({titre:"L'état de l'archive",
        sous: k+" fiche"+(k>1?"s":"")+" dise"+(k>1?"nt":"")+" quelque chose d'impossible",
        attr:'data-go="verif"'}), "lien")
    + `<div style="height:18px"></div>`;
}

function vReglages(){
  Z.titre="Réglages"; Z.retour=true;
  const sauve = db.exp
    ? "Dernière fois le "+new Date(db.exp).toLocaleDateString("fr-FR")
    : "Jamais sauvegardé";
  Z.html = `<div style="height:10px"></div>`
    + titreBloc("Sur mes deux appareils")
    + liste(ligne({titre:"Synchronisation", sous:esc(syEtat()), attr:'data-go="sync"'}), "lien")
    + titreBloc("Mon archive","ecart")
    + liste(ligne({titre:"Mes données", sous:esc(sauve), attr:'data-go="data"'})
          + ligne({titre:"L'état de l'archive", sous:esc(verifDit()), attr:'data-go="verif"'}), "lien")
    + titreBloc("Cette application","ecart")
    + liste(ligne({titre:"Comment je m'en sers", sous:esc(soEtat()),
                   attr:'data-go="sondes"'}), "lien")
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
    ${(function(){ const o=sondesPoids();
        /* On dit ce qui part. Un fichier qui emporte plus que ce qu'on croit
           n'est pas un fichier qu'on envoie tranquillement (13.ec). */
        return o>200 ? `<div class="block amorce">Le fichier emporte aussi <b>comment je m'en sers</b> — ${esc(poids(o))}, des noms de gestes et rien de ce que tu écris. C'est par là que ça sort du téléphone ; reprendre un fichier ne les ramène jamais.</div>` : ""; })()}
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
/* Ce qui tournait quand c'est arrivé — et aussi ce qu'on vient d'arrêter.
   On note souvent juste après avoir fermé le compteur, et ce qu'on a reçu
   là-dedans n'a pas cessé d'en venir parce qu'on a touché « Arrêter ». Même
   fraîcheur que la séance, et pour la même raison : la demi-heure (13.ei). */
function pdtCandidats(){
  const o=[], ouv=ouverts();
  ouv.forEach(function(b){
    o.push({id:b.id, nom:tacheNom(b.t), sous:"en cours depuis "+hmin(new Date(b.deb))});
  });
  perOuvertes().forEach(function(pr){
    o.push({id:pr.id, nom:discNom(pr.d), sous:"temps mis à part — "+dureePer(pr)});
  });
  if(!ouv.length){
    const b=seanceFraiche();
    if(b) o.push({id:b.id, nom:tacheNom(b.t), sous:"arrêté à "+hmin(new Date(b.fin))});
  }
  return o;
}
/* L'app suppose quand il n'y a qu'une réponse possible, et jamais autrement.
   Une seule chose tournait : le dire est une lecture, pas un pari. Deux, et
   elle se tait — trancher entre elles serait cocher à sa place (P9, 13.bc).
   La supposition se voit et se défait d'une tape, exactement comme celle du
   jour : c'est le même pacte (13.dx, 13.ej). */
function pdtSuppose(){
  const c=pdtCandidats();
  return c.length===1 ? c[0].id : null;
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
  /* Dire que c'est une supposition, et seulement quand ça en est une : une
     circonstance qu'il a choisie lui-même ne se présente pas comme devinée
     (13.ch — un libellé faux est de la famille d'un chiffre faux). */
  const sup = !!cur && !!d.pdtSup;
  const vus={}; let l="";
  if(cur){
    vus[cur.id]=1;
    l+=ligne({titre:esc(cur.nom),
      sous: sup ? "Touche si ce n'était pas pendant ça" : esc(cur.quand),
      apres:`<span class="coche">✓</span>`, attr:'data-pdt="'+cur.id+'"'});
  }
  cands.forEach(function(c){
    if(vus[c.id]) return;
    l+=ligne({titre:esc(c.nom), sous:esc(c.sous), attr:'data-pdt="'+c.id+'"'});
  });
  return titreBloc("Pendant quoi")+liste(l)
    + `<div class="block amorce">${sup
        ? "C'est ce qui tournait quand tu l'as écrit. L'app le suppose ; une tape le retire."
        : "Ce que tu donnais quand c'est arrivé. Touche à nouveau pour le retirer."}</div>`;
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
  /* « C'est toujours en cours ✓ » demandait de DÉCOCHER pour dire qu'un temps
     était fini : la case disait l'état, pas le geste, et on cherchait le
     geste. La ligne dit maintenant ce qu'elle fait — et l'inverse reste
     atteignable d'une touche, car une fin posée par erreur doit pouvoir se
     reprendre (13.cl, 13.dj). */
  h+=titreBloc("La fin","ecart");
  h+=liste(ouverte
    ? ligne({titre:"C'est fini", sous:"Tu pourras corriger l'heure juste après",
        attr:'data-act="perCours"'})
    : ligne({titre:"C'est toujours en cours", attr:'data-act="perCours"'}));
  if(!ouverte){
    h+=liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
        <input type="datetime-local" id="pdFin" value="${dtl(pr.fin)}"></div></div></li>`);
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

const VUES = {today:vToday, oeuvres:vListe(vOeuvres), revel:vListe(vRevel), actes:vListe(vActes), accomplis:vListe(vAccomplis), chemin:vChemin, faits:vFaits,
              note:vNote, node:vNode, edit:vEdit, lier:vLier, data:vData,
              pointer:vPointer, temps:vMonTemps, bloc:vBloc, quand:vQuand, frise:vFrise,
              tache:vTache, devine:vDevine, lecture:vLecture, pages:vPages, livre:vLivre, auteur:vAuteur,
              sujets:vSujets, annonce:vAnnonce, cahier:vCahier, sujet:vSujet, promesse:vPromesse,
              perNeuf:vPerNeuf, periode:vPeriode, epingles:vEpingles,
              rythmes:vRythmes, rythme:vRythme, portes:vPortes, porte:vPorte,
              adisc:vActesDisc, acteDisc:vActeDisc,
              sync:vSync, reglages:vReglages, ordre:vOrdre, verif:vListe(vVerif)};

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
  /* Même forme, même comportement : les deux listes de cette fiche se gardent
     seules. En changer refait les parts de tout l'historique, et c'est voulu —
     une activité mal rangée fausse les parts depuis le premier jour. */
  if(id==="tCat"){
    const t=tache(S.tchId);
    if(t && ev.target.value && t.cat!==ev.target.value){
      t.cat=ev.target.value; touche(t); save(); toast("Rangée dans "+catNom(t.cat)+".");
    }
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
  /* Le même rouage, pour les promesses : trente besoins se cherchent, et
     redessiner à chaque lettre refermerait le clavier (13.et). */
  if(id==="prQ"){
    const q=ev.target.value.trim().toLowerCase();
    S.prQ=ev.target.value;
    [].forEach.call(document.querySelectorAll("[data-prn]"), el=>{
      const li=el.closest("li")||el;
      li.hidden = !!q && (el.getAttribute("data-prn")||"").indexOf(q)===-1;
    });
    [].forEach.call(document.querySelectorAll(".prgrp"), g=>{
      g.hidden = !g.querySelectorAll("li:not([hidden])").length;
    });
    const pn=document.getElementById("prRien");
    if(pn) pn.hidden = !q || [].some.call(document.querySelectorAll("[data-prn]"),
        el => !(el.closest("li")||el).hidden);
    return;
  }
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
    /* Sur le cahier, on ne nomme rien : on cherche. Une recherche qui ne
       trouve rien doit le dire, sinon l'écran paraît vide pour de bon. */
    const rn=document.getElementById("sjRien");
    if(rn) rn.hidden = !q || [].some.call(document.querySelectorAll("[data-sujo]"),
                              function(el){ return !(el.closest("li")||el).hidden; });
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

