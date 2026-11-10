/* Ében-Ézer — temps
   Les blocs : compter, couper, réunir. Le cœur du compte.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- le temps ---------- */
/* Le temps donné n'est pas un acte : il ne se garde pas dans le mémorial, il
   se pèse à côté. Quarante blocs par jour noieraient l'archive, et l'archive
   existe pour être relue. Deux registres, donc : les actes, et les heures. */
function CATS(){
  return CAT_SOCLE.map(function(c){ return {id:c[0], nom:c[1]}; })
    .concat((db.cats||[]).map(function(c){ return {id:c.id, nom:c.nom}; }));
}
function catNom(id){ const c=CATS().filter(x=>x.id===id)[0]; return c ? c.nom : "Le reste"; }
function tache(id){ return (db.taches||[]).filter(t=>t.id===id)[0]; }
function tacheNom(id){ const t=tache(id); return t ? t.nom : "—"; }
function tacheCat(id){ const t=tache(id); return t ? (t.cat||"reste") : "reste"; }
/* Une activité naît avec son type, comme elle naît avec sa catégorie : le
   deviner d'après le nom dépannait les anciennes, ce n'est pas une manière
   de créer les nouvelles. À défaut de choix, le nom tranche — mais le choix
   est offert, au même écran (13.cg). */
function tacheId(nom, cat, d){
  const v=String(nom||"").trim(); if(!v) return "";
  const t=(db.taches||[]).filter(x=>x.nom.toLowerCase()===v.toLowerCase())[0];
  if(t){ if(cat && t.cat!==cat){ t.cat=cat; touche(t); } return t.id; }
  const id=uid("a");
  db.taches.push({id:id, nom:cap(v), cat:cat||"reste",
                  d:(d===undefined||d===null) ? discDeNom(v) : d, maj:Date.now()});
  return id;
}
function blocT(id){ return (db.temps||[]).filter(b=>b.id===id)[0]; }
/* Un bloc qui en recouvre un autre, même partiellement : c'est le seul cas
   où la question « lequel porte l'heure ? » se pose. Ailleurs, l'offrir
   serait proposer un choix qui n'existe pas. */
function chevauche(b){
  const f=finDe(b);
  return (db.temps||[]).some(function(x){ return x!==b && x.deb<f && finDe(x)>b.deb; });
}

/* Permanent, mais pas en marche : une page web s'arrête dès qu'on la quitte,
   et aucun chronomètre ne survit à l'app fermée. On ne garde que l'heure de
   départ — la soustraction reste juste après trois jours de silence.
   Plusieurs blocs peuvent tourner ensemble (13.by) : deux missions que l'IA
   fait avancer en parallèle ne se disputent pas la journée, elles la
   couvrent toutes les deux. Ce qui ne se duplique jamais, c'est la journée
   elle-même — et c'est le calcul qui s'en charge, pas le pointage. */
function ouverts(){ return (db.temps||[]).filter(function(b){ return !b.fin; }); }
/* Quand plusieurs tournent, un seul porte l'heure pour « La part de chacun »
   — celui qui le réclame, sinon celui qui tournait déjà. « ouvert() » rend
   ce porteur : c'est lui que le rail nomme, et lui que le reste du code
   attend là où il n'en espérait qu'un. */
function chef(arr){
  let c=null;
  for(let i=0;i<arr.length;i++){
    const b=arr[i];
    if(!c) { c=b; continue; }
    if(!!b.porte > !!c.porte) c=b;
    else if(!c.porte && b.deb<c.deb) c=b;
  }
  return c;
}
function ouvert(){ return chef(ouverts()); }
/* Vingt secondes passaient pour une erreur de pouce, et l'app les effaçait
   d'elle-même. Mais une intercession de dix secondes est du temps vécu, et
   rien n'autorise l'outil à décider que ce qui est bref n'a pas eu lieu —
   surtout dans un registre dont toute la valeur tient à ce qu'il ne maquille
   rien. Le disciple efface ce qu'il veut effacer ; l'app garde (13.ci).
   Reste un plancher d'une seconde, qui n'invente aucune durée vécue : il
   tient seulement le bloc au-dessus de la durée nulle, que la fusion laisse
   tomber sans rien dire. */
function fermeBloc(b){
  if(!b || b.fin) return;
  b.fin=Math.max(Date.now(), b.deb+1000); touche(b);
}
function pointe(tid, enPlus, deb){
  const n=Date.now(), ouv=ouverts();
  if(ouv.some(function(b){ return b.t===tid; })) return false;
  if(!enPlus) ouv.forEach(fermeBloc);
  /* Un début repris ne peut être qu'antérieur : on ne commence pas à compter
     dans le futur, et on ne remonte que jusqu'où le disciple l'a demandé. */
  const d=(typeof deb==="number" && deb<n) ? deb : n;
  db.temps.push({id:uid("b"), t:tid, deb:d, maj:n});
  db.temps.sort(function(a,b){ return a.deb-b.deb; });
  save(); return true;
}
function arrete(){
  const ouv=ouverts(); if(!ouv.length) return;
  ouv.forEach(fermeBloc); save();
}
function arreteUn(b){ if(!b || b.fin) return; fermeBloc(b); save(); }

/* Sous la minute, l'app annonçait « 0 min » d'un temps qu'elle avait pourtant
   compté à la milliseconde. Un bloc de trente-cinq secondes existe, il pèse
   dans les totaux, et l'écran le niait — or un chiffre faux, si petit soit-il,
   fait douter de tous les autres. Elle le dit maintenant en secondes, et le
   dernier mot sur ce qui est trop court pour être gardé reste au seuil des
   vingt secondes, qui lui efface vraiment (13.ch). */
function hm(ms){
  const s=Math.max(0, Math.round(ms/1000));
  if(s<60) return s+" s";
  const m=Math.floor(s/60), h=Math.floor(m/60), r=m%60;
  if(!h) return m+" min";
  return r ? h+" h "+String(r).padStart(2,"0") : h+" h";
}
function hmin(d){ return d.getHours()+" h "+String(d.getMinutes()).padStart(2,"0"); }
/* Dans une fenêtre de sept ou trente jours, « 9 h 20 » ne dit pas quel jour.
   Aujourd'hui n'a pas besoin d'être daté ; le reste si. */
function jourBref(ms){
  const m=new Date(); m.setHours(0,0,0,0);
  if(ms>=m.getTime()) return "";
  return new Date(ms).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" · ";
}
function minuit(dec){ const d=new Date(); d.setHours(0,0,0,0); if(dec) d.setDate(d.getDate()-dec); return d.getTime(); }

/* Un bloc qui traverse la nuit appartient aux deux jours. On ne le coupe pas
   en mémoire — on le coupe à la lecture, en ne comptant que ce qui tombe dans
   la fenêtre. Le sommeil rend ainsi à chaque jour sa part, sans qu'on ait
   touché à quoi que ce soit à minuit. */
/* Trois nombres, et il ne faut jamais les confondre (13.by).
   « par »   — ce que chaque activité a duré, pour elle-même. Deux missions
               menées ensemble durent chacune tout leur temps : on les
               additionne et la somme peut dépasser la journée, c'est juste.
   « tot »   — la journée vécue : l'UNION des périodes, jamais leur somme.
               Dix heures à seize heures occupées par deux missions font six
               heures de vie, pas douze. C'est le seul nombre qui ait le
               droit d'être comparé au temps écoulé.
   « parCat »— la part de chaque catégorie dans cette union. Sur chaque
               tranche, un seul bloc porte : celui qui le réclame, sinon
               celui qui tournait déjà. C'est ce qui fait qu'un repas pris
               en codant ne retire rien à l'œuvre.
   On balaie les bornes dans l'ordre en tenant à jour la liste de ce qui est
   ouvert : comparer chaque tranche à tous les blocs serait quadratique, et
   la fenêtre « Tout » en contient des milliers. */
/* Une fenêtre ne garde que sa part. Un bloc commencé à 23 h 51 et fini à
   3 h 06 a duré trois heures, mais neuf minutes seulement appartiennent à la
   veille : les compter entières des deux côtés ferait lire la même heure
   deux fois. La part se compte donc, et le reste se DIT — sans quoi on
   aurait troqué un chiffre faux contre un chiffre amputé (13.da). */
function partBloc(b, t0, t1){
  const n=Date.now(), deb=b.deb, fin=(typeof b.fin==="number") ? b.fin : n;
  const a=Math.max(deb, t0), z=Math.min(fin, t1);
  return {a:a, z:z, duree:Math.max(0, z-a), tot:Math.max(0, fin-deb),
          avant:deb<t0, apres:fin>t1, ouvert:typeof b.fin!=="number"};
}
/* Les heures d'un bloc se partagent entre les jours qu'il traverse ; ce qu'on
   y a lu, non — cinquante-deux pages lues d'une traite ne se coupent pas au
   prorata de minuit. Elles restent au jour où la lecture a commencé, et sur
   l'autre jour le bloc le dit, pour qu'on ne cherche pas dans « Mes lectures »
   des pages qui se comptent ailleurs (13.da). */
function lectureAilleurs(b, t0, t1){
  if(!b || (b.deb>=t0 && b.deb<t1)) return false;
  return !!(((b.lu||[]).length) || ((b.pg||[]).length));
}
/* « le 1 novembre » n'est pas du français. Le premier du mois est le seul
   qui porte son rang. */
function dateJour(ms){
  const d=new Date(ms), q=d.getDate();
  return (q===1 ? "1er" : q)+" "+MOIS[d.getMonth()];
}
/* Ce qu'un acte occupe de temps, au plus fin de ce qu'on sait de sa date :
   un jour s'il est daté au jour, tout un mois si l'on ne se souvient que du
   mois. On ne le range jamais plus fin que ce qu'on en sait. */
function spanActe(n){
  const p=parse(n && n.date); if(!p) return null;
  if(n.prec==="a") return [new Date(p.y,0,1).getTime(), new Date(p.y+1,0,1).getTime()];
  if(n.prec==="m") return [new Date(p.y,p.m-1,1).getTime(), new Date(p.y,p.m,1).getTime()];
  return [new Date(p.y,p.m-1,p.d).getTime(), new Date(p.y,p.m-1,p.d+1).getTime()];
}
function cumul(t0, t1){
  const n=Date.now(), par={}, parCat={}, bs=[];
  (db.temps||[]).forEach(function(b){
    const a=Math.max(b.deb, t0), z=Math.min(b.fin||n, t1);
    if(z>a){ par[b.t]=(par[b.t]||0)+(z-a); bs.push({a:a, z:z, b:b}); }
  });
  let porte=0;
  Object.keys(par).forEach(function(k){ porte+=par[k]; });
  if(!bs.length) return {par:par, parCat:parCat, tot:0, porte:0};

  const cat={};
  function catDe(tid){ if(cat[tid]===undefined) cat[tid]=tacheCat(tid); return cat[tid]; }

  const marques={};
  bs.forEach(function(x){ marques[x.a]=1; marques[x.z]=1; });
  const ts=Object.keys(marques).map(Number).sort(function(p,q){ return p-q; });
  bs.sort(function(p,q){ return p.a-q.a; });

  let tot=0, k=0; const actifs=[];
  for(let i=0;i<ts.length-1;i++){
    const x=ts[i], y=ts[i+1];
    while(k<bs.length && bs[k].a<=x){ actifs.push(bs[k]); k++; }
    for(let j=actifs.length-1;j>=0;j--) if(actifs[j].z<=x) actifs.splice(j,1);
    if(!actifs.length) continue;
    let c=null;
    for(let j=0;j<actifs.length;j++){
      const o=actifs[j].b;
      if(!c){ c=o; continue; }
      if(!!o.porte > !!c.porte) c=o;
      else if(!c.porte && o.deb<c.deb) c=o;
    }
    tot+=y-x;
    const k2=catDe(c.t);
    parCat[k2]=(parCat[k2]||0)+(y-x);
  }
  return {par:par, parCat:parCat, tot:tot, porte:porte};
}
/* Les fenêtres étaient glissantes — « les sept derniers jours », « les
   trente derniers » — et une fenêtre glissante ne se remonte pas : il n'y a
   pas de jour d'avant les sept derniers jours. Elles sont devenues des
   fenêtres du calendrier, qui se parcourent : le jour, la semaine, le mois,
   l'année. Les pastilles ne disent plus que le grain ; c'est la barre en
   dessous qui dit laquelle on regarde. */
const ONG_TEMPS = [["parts","Les parts"],["routines","Les routines"],["blocs","Les blocs"]];
const PERIODES = [["jour","Jour"],["sem","Semaine"],["mois","Mois"],["an","Année"],["tout","Tout"]];
/* Les bornes se calculent toujours sur un objet Date, jamais en ajoutant des
   millisecondes : l'heure d'hiver fait des journées de vingt-cinq heures, et
   un mois n'a pas de durée. */
function bornes(per, t){
  const d=new Date(t); d.setHours(0,0,0,0);
  if(per==="jour"){ const f=new Date(d); f.setDate(f.getDate()+1); return [d.getTime(), f.getTime()]; }
  if(per==="sem"){ d.setDate(d.getDate()-((d.getDay()+6)%7));
                   const f=new Date(d); f.setDate(f.getDate()+7); return [d.getTime(), f.getTime()]; }
  if(per==="mois"){ d.setDate(1); const f=new Date(d); f.setMonth(f.getMonth()+1); return [d.getTime(), f.getTime()]; }
  d.setMonth(0,1); const f=new Date(d); f.setFullYear(f.getFullYear()+1); return [d.getTime(), f.getTime()];
}
/* On ne décale jamais qu'un début de période — le 1er du mois, un lundi,
   minuit — ce qui évite le piège du 31 janvier qu'on avance d'un mois. */
function decale(per, t0, sens){
  const d=new Date(t0);
  if(per==="jour") d.setDate(d.getDate()+sens);
  else if(per==="sem") d.setDate(d.getDate()+7*sens);
  else if(per==="mois") d.setMonth(d.getMonth()+sens);
  else d.setFullYear(d.getFullYear()+sens);
  return bornes(per, d.getTime())[0];
}
function memeAn(t){ return new Date(t).getFullYear()===new Date().getFullYear(); }
/* Deux noms pour la même fenêtre : celui qui entre dans une phrase — « rien
   de compté le mardi 4 novembre » — et celui qui tient dans la barre. */
function nomFen(per, t0){
  const n=Date.now(), ici=bornes(per,n)[0], av=decale(per,ici,-1), d=new Date(t0);
  if(per==="jour"){
    if(t0===ici) return "aujourd'hui";
    if(t0===av) return "hier";
    return "le "+d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})
      +(memeAn(t0) ? "" : " "+d.getFullYear());
  }
  if(per==="sem"){
    if(t0===ici) return "cette semaine";
    if(t0===av) return "la semaine dernière";
    return "la semaine du "+d.toLocaleDateString("fr-FR",{day:"numeric",month:"long"})
      +(memeAn(t0) ? "" : " "+d.getFullYear());
  }
  if(per==="mois"){
    if(t0===ici) return "ce mois-ci";
    if(t0===av) return "le mois dernier";
    return "en "+d.toLocaleDateString("fr-FR",{month:"long"})+(memeAn(t0) ? "" : " "+d.getFullYear());
  }
  if(t0===ici) return "cette année";
  if(t0===av) return "l'an dernier";
  return "en "+d.getFullYear();
}
function courtFen(per, t0){
  const n=Date.now(), ici=bornes(per,n)[0], d=new Date(t0);
  if(per==="jour"){
    if(t0===ici) return "Aujourd'hui";
    if(t0===decale(per,ici,-1)) return "Hier";
    return cap(d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}))
      +(memeAn(t0) ? "" : " "+d.getFullYear());
  }
  if(per==="sem") return (t0===ici ? "Cette semaine"
    : "Semaine du "+d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})
      +(memeAn(t0) ? "" : " "+d.getFullYear()));
  if(per==="mois") return cap(d.toLocaleDateString("fr-FR",{month:"long"}))
    +(memeAn(t0) ? "" : " "+d.getFullYear());
  return String(d.getFullYear());
}
function fenetre(){
  const n=Date.now();
  if(S.per==="tout"){
    const d=(db.temps||[])[0];
    return {t0:d?d.deb:n, t1:n, nom:"depuis le début", court:"Tout",
            ici:true, avant:false, apres:false};
  }
  const b=bornes(S.per, S.anc===null ? n : S.anc), ici=(b[0]===bornes(S.per,n)[0]);
  const prem=(db.temps||[])[0];
  /* Une fenêtre passée s'arrête à sa propre fin ; celle d'aujourd'hui
     s'arrête maintenant. C'est ce qui fait qu'hier se lit sur vingt-quatre
     heures et aujourd'hui sur ce qui s'est écoulé. */
  return {t0:b[0], t1:Math.min(b[1], n), nom:nomFen(S.per,b[0]), court:courtFen(S.per,b[0]),
          ici:ici,
          /* On ne remonte pas avant le premier bloc de l'archive, et on ne
             descend pas dans un jour qui n'a pas eu lieu. */
          avant: !!prem && prem.deb < b[0],
          apres: !ici};
}
/* Le nom du retour suit le grain : on ne revient pas « à aujourd'hui »
   quand on lit des années. */
function retourTxt(per){
  if(per==="sem") return "Revenir à cette semaine";
  if(per==="mois") return "Revenir à ce mois-ci";
  if(per==="an") return "Revenir à cette année";
  return "Revenir à aujourd'hui";
}
/* La ligne reste même sur « Tout », où les chevrons n'ont rien à faire :
   elle est la seule porte vers le grain, et une porte ne se retire pas. */
function barreFen(f){
  return `<div class="fnav">
    <button class="fnp" data-fdec="-1" aria-label="Avant"${f.avant?"":" disabled"}>&lsaquo;</button>
    <button class="fnt${f.ici?"":" loin"}" data-act="fenGrain" aria-haspopup="true">${esc(f.court)}${BAS}</button>
    <button class="fnp" data-fdec="1" aria-label="Après"${f.apres?"":" disabled"}>&rsaquo;</button>
  </div>`;
}
/* Sur trente jours, une heure de prière pèse deux dixièmes de pour cent.
   L'arrondir à zéro serait faux — une heure a été donnée — et dur pour
   rien. Sous le demi pour cent, on écrit donc le dixième. */
function partPc(x, tot){
  if(!tot) return "0";
  const p=x*100/tot;
  if(p>0 && p<0.5) return String(Math.round(p*10)/10).replace(".", ",");
  return String(Math.round(p));
}

