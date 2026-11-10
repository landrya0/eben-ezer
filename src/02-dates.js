/* Ében-Ézer — dates
   Dire une date comme on la dit de vive voix.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- dates ---------- */
function today(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function parse(s){ if(!s) return null; const p=String(s).split("-"); if(p.length<3) return null; return {y:+p[0], m:+p[1], d:+p[2]}; }
/* Une date qui n'existe pas encore n'est pas une date oubliée. Un acte
   passé a eu lieu un jour, même si on ne sait plus lequel — d'où le mois,
   d'où l'année. Une action qu'on prévoit, elle, peut n'avoir aucun jour :
   « je ne sais pas encore » est une réponse vraie, et la seule qui
   manquait. Seul un prévu peut la porter (13.ds). */
function sansDate(n){ return !!n && n.prec==="?"; }
function precPour(etat, prec){ return (prec==="?" && etat!=="prevu") ? "j" : (prec||"j"); }
/* Tant que c'est prévu, la date est un POUR-QUAND : une promesse, pas un
   fait. Dès que ce n'est plus prévu, le même champ veut dire QUAND. Le
   laisser en place daterait l'acte du jour promis et non du jour où il a eu
   lieu — une date fausse dans un registre de faits (13.ch). Il n'y avait pas
   une règle mais deux : le menu re-datait, la fiche non. Maintenant une
   seule, et elle vaut pour toute sortie de « prévu », achèvement comme
   début : les deux disent que la chose existe (13.du).
   Ce qui a commencé, en revanche, a déjà sa vraie date : on n'y touche pas.
   Et le jour promis ne se perd pas, il se range dans `prevuLe`. */
function quitterPrevu(n, avant, apres){
  if(!n) return false;
  if(apres==="prevu"){ if(n.prevuLe) delete n.prevuLe; return false; }
  if(avant!=="prevu") return false;
  if(!sansDate(n)) n.prevuLe=n.date;
  n.date=today(); n.prec="j";
  return true;
}
/* Le jour promis était gardé et lu par personne : écrit nulle part, il ne
   servait à rien. Dit sur la fiche, la boucle se ferme — ce qui était prévu,
   et le jour où ça a été tenu. Le redire quand c'est le même jour serait du
   bruit (13.du). */
function jourPromis(n){
  if(!n || !n.prevuLe || n.etat==="prevu" || n.prevuLe===n.date) return "";
  return human({date:n.prevuLe, prec:"j"});
}
/* Une chose qu'on ne voit qu'en ouvrant la fiche, on ne la voit pas : c'est
   en parcourant la liste qu'on se demande si ce qu'on avait promis a été
   tenu. Le pied d'une ligne est télégraphique, d'où la forme courte — et
   « promis » plutôt que « prévu », parce que « prévu » y est déjà l'état :
   deux sens pour un mot dans la même ligne, c'est une ligne qui ment
   (13.cu). L'année ne se dit que si ce n'est pas celle-ci (13.dv). */
function promisBref(n){
  if(!jourPromis(n)) return "";
  const p=parse(n.prevuLe); if(!p) return "";
  const an = p.y===new Date().getFullYear() ? "" : " "+p.y;
  return "promis le "+new Date(p.y, p.m-1, p.d)
    .toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+an;
}
function human(n){
  if(n.kind==="ecriture") return n.ref || "";
  if(sansDate(n)) return "";
  const p=parse(n.date); if(!p) return "";
  if(n.prec==="a") return ""+p.y;
  if(n.prec==="m") return MOIS[p.m-1]+" "+p.y;
  return p.d+" "+MOIS[p.m-1]+" "+p.y;
}
/* On ne range pas un acte plus fin que ce qu'on sait de sa date : une date
   connue à l'année près ne peut pas entrer dans une semaine sans mentir. */
function lundi(p){
  const t=new Date(p.y, p.m-1, p.d);
  t.setDate(t.getDate() - ((t.getDay()+6)%7));
  return t;
}
function tranche(n, grain){
  const p=parse(n.date); if(!p) return "Sans date";
  if(grain==="an" || n.prec==="a") return ""+p.y;
  if(grain==="mois" || n.prec==="m") return MOIS[p.m-1]+" "+p.y;
  const l=lundi(p);
  return "Semaine du "+l.getDate()+" "+MOIS[l.getMonth()]+" "+l.getFullYear();
}
function manCourt(m){ const t=manTxt(m); return t ? t.replace(/^Il (a |m'a |l'a )?/,"") : ""; }

