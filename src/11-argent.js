/* Ében-Ézer — l'argent
   Le troisième registre.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md.

   Le disciple a donné la raison, et c'est elle qui fixe la forme :
   « la bible dit "là ou est ton trésor là sera ton coeur", donc l'amour pour
   Dieu se mesure sur la manière dont on gère les finances. »

   Donc : ni un budget, ni un compte de banque. Un registre qui pèse, à côté
   du mémorial sans en être — exactement comme les heures (13.ax). Le temps
   est la preuve de la reconnaissance ; l'argent est la preuve du trésor. Ils
   répondent à la même question par deux mesures, et ils ne gardent rien de ce
   que Dieu a fait : ça, c'est le mémorial.

   Et comme le temps, l'argent va à des destinataires. Les cinq de CAT_SOCLE
   se retrouvent ici à l'identique — c'est le même cœur qui répartit l'heure
   et le franc. L'argent en ajoute deux que le temps n'a pas : on n'épargne
   pas une heure, on ne l'investit pas (13.dk). */
"use strict";

/* ---------- la monnaie ---------- */
/* Les sommes se gardent en centimes, en nombres entiers. 0,1 + 0,2 ne fait
   pas 0,3 en virgule flottante, et un registre des finances qui perd un
   centime à chaque addition ne prouve rien du tout (13.dk). */
const DEVISES = [
  ["EUR","Euro","€",2],
  ["XAF","Franc CFA — BEAC","FCFA",0],
  ["XOF","Franc CFA — BCEAO","FCFA",0],
  ["USD","Dollar","$",2],
  ["CHF","Franc suisse","CHF",2],
  ["CAD","Dollar canadien","$",2],
  ["GBP","Livre sterling","£",2],
  ["MAD","Dirham","DH",2]
];
function devLig(){
  const c=db.dev||"EUR";
  return DEVISES.filter(function(x){ return x[0]===c; })[0] || DEVISES[0];
}
function devNom(){ return devLig()[1]; }
function devSym(){ return devLig()[2]; }
function devDec(){ return devLig()[3]; }
/* Un montant se lit toujours avec sa monnaie : « 120 » ne dit pas si c'est
   cent vingt euros ou cent vingt francs, et deux appareils peuvent avoir été
   réglés différemment. */
function sousTxt(c, signe){
  const d=devDec(), neg=(c||0)<0, v=Math.abs(c||0)/Math.pow(10,d);
  const s=v.toLocaleString("fr-FR",{minimumFractionDigits:d, maximumFractionDigits:d});
  return (neg ? "−" : (signe && c>0 ? "+" : "")) + s + " " + devSym();
}
/* Dans un champ, le montant se montre nu : ni symbole, ni espace de
   milliers. Ce qui s'affiche doit pouvoir se retaper tel quel. */
function sousNu(c){
  const d=devDec();
  return (Math.abs(c||0)/Math.pow(10,d))
    .toLocaleString("fr-FR",{minimumFractionDigits:d, maximumFractionDigits:d, useGrouping:false});
}
/* « 12,50 », « 12.5 », « 1 234,56 », « 12 € », « -43,20 » : on prend ce que le
   disciple tape, et ce qu'un relevé de banque recopié donne. Un champ
   numérique l'aurait obligé au point : un clavier qui refuse la virgule n'est
   pas un clavier français. */
function montantLu(txt){
  let v=String(txt==null?"":txt).trim().replace(/[^\d.,\-−]/g,"");
  if(!v) return null;
  const neg=/[-−]/.test(v);
  v=v.replace(/[-−]/g,"");
  if(!v) return null;
  const i=Math.max(v.lastIndexOf(","), v.lastIndexOf("."));
  let ent=v, dec="";
  /* Le dernier séparateur n'est la virgule décimale que s'il reste un ou deux
     chiffres derrière : « 1.234 » est mille deux cent trente-quatre, pas un
     euro vingt-trois. */
  const q=v.length-i-1;
  if(i>=0 && q>0 && q<=2){ ent=v.slice(0,i); dec=v.slice(i+1); }
  ent=ent.replace(/[.,]/g,"");
  const d=devDec();
  const n=parseInt(ent||"0",10)*Math.pow(10,d) + (d ? parseInt((dec+"00").slice(0,d),10) : 0);
  if(!isFinite(n)) return null;
  return neg ? -n : n;
}

/* ---------- les postes ---------- */
/* Un seul attribut, et le sens en découle (13.cn) : « Pour Dieu » ne peut
   qu'être une sortie, un salaire ne peut qu'être une entrée. Demander la
   somme, puis le sens, puis le poste, ce serait deux champs que le disciple
   devrait tenir d'accord entre eux.
   C'est aussi ce qui donne sa place à « Un retour » : reprendre son épargne
   est une entrée dont l'origine est l'épargne, et sans ce poste il aurait
   fallu rendre l'épargne bidirectionnelle — donc rendre le sens saisissable. */
const POSTES = [
  ["dieu",    "Pour Dieu",   "s", "Dîme, offrande, l'œuvre, les pauvres"],
  ["famille", "Ma famille",  "s", "Les miens, ici et là-bas"],
  ["travail", "Mon travail", "s", "Ce que gagner me coûte"],
  ["moi",     "Moi",         "s", "Vivre : le toit, la table, la route"],
  ["epargne", "J'épargne",   "s", "Mis de côté — ça reste à moi"],
  ["invest",  "J'investis",  "s", "Placé pour rendre"],
  ["reste",   "Le reste",    "s", ""],
  ["salaire", "Mon travail", "e", "Le salaire, ce que le travail rapporte"],
  ["recu",    "Un don reçu", "e", "Venu sans que je l'aie gagné"],
  ["retour",  "Un retour",   "e", "L'épargne reprise, un remboursement"],
  ["ereste",  "Le reste",    "e", ""]
];
function poste(id){ return POSTES.filter(function(p){ return p[0]===id; })[0] || null; }
function posteNom(id){ const p=poste(id); return p ? p[1] : ""; }
function posteSens(id){ const p=poste(id); return p ? p[2] : ""; }
function postesDe(sens){ return POSTES.filter(function(p){ return p[2]===sens; }).map(function(p){ return p[0]; }); }

/* ---------- le registre ---------- */
function sou(id){ return (db.sous||[]).filter(function(x){ return x.id===id; })[0] || null; }
function cumulSous(t0, t1){
  const c={entre:0, sorti:0, par:{}, n:0};
  (db.sous||[]).forEach(function(x){
    if(x.t<t0 || x.t>=t1) return;
    const s=posteSens(x.p); if(!s) return;
    const m=Math.abs(x.m||0);
    c.n++;
    if(s==="e") c.entre+=m; else c.sorti+=m;
    c.par[x.p]=(c.par[x.p]||0)+m;
  });
  return c;
}
function sousDans(t0, t1){
  return (db.sous||[]).filter(function(x){ return x.t>=t0 && x.t<t1 && posteSens(x.p); })
                      .sort(function(a,b){ return b.t-a.t || (b.maj||0)-(a.maj||0); });
}
function souJour(t){
  return dateJour(t)+(memeAn(t) ? "" : " "+new Date(t).getFullYear());
}
/* Le libellé est libre, mais il n'est qu'un libellé : c'est le poste qui
   porte la structure, et donc tout ce qui se déduit (AGENTS §1). */
function souTitre(x){ return x.q ? String(x.q) : posteNom(x.p); }

/* ---------- l'écran ---------- */
const ONG_ARG = [["parts","Les parts"],["mvts","Les mouvements"]];
/* « 17 % » renvoyait le signe seul à la ligne suivante. L'espace fine
   insécable est de toute façon ce que le français demande — et c'est déjà
   celle que les milliers portent. */
function pc(x, tot){ return partPc(x, tot)+"\u202f%"; }
function partsSous(ids, par, tot){
  const vus=ids.filter(function(p){ return par[p]; })
               .sort(function(a,b){ return par[b]-par[a]; });
  if(!vus.length) return `<p class="vide">Rien.</p>`;
  return `<div class="tps">`+vus.map(function(p){
    const x=par[p], w=tot ? x*100/tot : 0;
    return `<div class="tl"><span class="tn">${esc(posteNom(p))}</span>
      <span class="tv"><b>${pc(x,tot)}</b>${esc(sousTxt(x))}</span>
      <span class="tj"><i style="width:${w}%"></i></span></div>`;
  }).join("")+`</div>`;
}
function vArgent(){
  Z.titre="Mon argent"; Z.retour=true;
  const f=fenetre(), c=cumulSous(f.t0, f.t1), v=S.vueA||"parts";
  /* Deux questions, deux vues — comme Mon temps (13.cs) : où va le trésor, et
     ce qui a bougé, pièce par pièce. La fenêtre vaut pour les deux et reste
     au-dessus, sous la forme qui dit qu'elle filtre (13.cu). */
  let h = `<div class="ongt" role="tablist">${ONG_ARG.map(function(o){
      return `<button role="tab" data-vuea="${o[0]}" aria-selected="${v===o[0]}">${o[1]}</button>`;
    }).join("")}</div>`;
  h += barreFen(f);
  if(!c.n){
    h += `<p class="vide">Rien de noté ${esc(f.nom)}.</p>`;
    h += `<div class="block amorce">« Là où est ton trésor, là aussi sera ton cœur. » Ce registre ne juge pas, il montre : note ce qui entre et ce qui sort, et les parts diront d'elles-mêmes à qui va ton cœur.</div>`;
    Z.html=h;
    Z.action=bouton("Noter un mouvement", 'data-act="souNeuf"');
    return;
  }
  if(v==="parts"){
    const ecart=c.entre-c.sorti;
    /* Ce n'est pas un solde : l'application ne connaît pas ce qu'il y avait
       sur le compte avant. Un chiffre faux est pire que pas de chiffre
       (13.ch) — alors on dit exactement ce que l'écart est. */
    h += `<div class="block amorce">Il est entré <b>${esc(sousTxt(c.entre))}</b> et il est sorti <b>${esc(sousTxt(c.sorti))}</b> ${esc(f.nom)}${
      ecart ? ` — ${ecart>0 ? "il est resté" : "il a manqué"} <b>${esc(sousTxt(Math.abs(ecart)))}</b>` : ""}. Ce n'est pas un solde de compte : c'est ce qui a bougé, rien de plus.</div>`;
    /* La part de Dieu se dit en une phrase, et pas seulement dans une jauge :
       c'est la question que ce registre existe pour poser. Et quand elle est
       vide, elle mène quelque part — jamais un reproche sans porte (13.cb) :
       le geste de noter est en bas de l'écran, toujours. */
    const dd=c.par["dieu"]||0;
    h += `<div class="block tresor">${dd
      ? `Sur ce qui est sorti, <b>${esc(sousTxt(dd))}</b> sont allés à Dieu — <b>${pc(dd,c.sorti)}</b>.`
      : `Rien n'est allé à Dieu ${esc(f.nom)}.`}</div>`;
    h += titreBloc("Où c'est allé");
    h += partsSous(postesDe("s"), c.par, c.sorti);
    h += titreBloc("D'où c'est venu","ecart");
    h += partsSous(postesDe("e"), c.par, c.entre);
  } else {
    const xs=sousDans(f.t0, f.t1);
    h += titreBloc(xs.length>1 ? xs.length+" mouvements" : "Un mouvement");
    h += liste(xs.map(function(x){
      const e=posteSens(x.p)==="e";
      return ligne({titre:esc(souTitre(x)),
        sous:(x.q ? esc(posteNom(x.p))+" · " : "")+esc(souJour(x.t)),
        apres:esc((e?"+":"−")+" "+sousTxt(Math.abs(x.m||0))),
        attr:'data-sou="'+x.id+'"'});
    }).join(""), "lien");
  }
  Z.html=h;
  Z.action=bouton("Noter un mouvement", 'data-act="souNeuf"');
}

/* Choisir un poste redessine l'écran. Si on ne ramasse pas d'abord ce qui est
   tapé, le montant s'efface sous les doigts du disciple : une fiche qu'on
   perd en la remplissant n'est pas une fiche (13.ct). */
function souLit(){
  const d=S.sd; if(!d) return;
  const m=document.getElementById("souM"), j=document.getElementById("souJ"), q=document.getElementById("souQ");
  if(m) d.mTxt=m.value;
  if(q) d.q=q.value;
  if(j){ const t=jourLu(j.value); if(t!==null) d.t=t; }
}
function jdate(ms){
  const d=new Date(ms), p=function(n){ return (n<10?"0":"")+n; };
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
}
function jourLu(s){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||"")); if(!m) return null;
  const d=new Date(+m[1], +m[2]-1, +m[3]); d.setHours(0,0,0,0);
  const t=d.getTime();
  return isFinite(t) ? t : null;
}
function listePostes(sel){
  let h="";
  [["s","Ce qui sort"],["e","Ce qui entre"]].forEach(function(g, i){
    h += titreBloc(g[1], i ? "ecart" : "");
    h += liste(POSTES.filter(function(p){ return p[2]===g[0]; }).map(function(p){
      const pris=sel===p[0];
      return ligne({titre:pris ? `<span class="coche">${esc(p[1])}</span>` : esc(p[1]),
                    sous:p[3] ? esc(p[3]) : "",
                    apres:pris ? `<span class="coche">✓</span>` : "",
                    attr:'data-poste="'+p[0]+'"'});
    }).join(""));
  });
  return h;
}
/* Un même écran pour noter et pour corriger : ce qui se saisit doit pouvoir
   se reprendre, et deux écrans jumeaux dériveraient l'un de l'autre (13.ct).
   Rien n'entre en mémoire avant « Garder » — un poste touché par erreur ne
   laisse pas de ligne vide dans le registre. */
function vSou(){
  const d=S.sd;
  if(!d){ depile("argent"); return render(); }
  const neuf=!d.id;
  Z.titre = neuf ? "Un mouvement" : "Ce mouvement"; Z.retour=true;
  let h = `<div style="height:10px"></div>`;
  h += titreBloc("Combien");
  h += liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
    <input type="text" inputmode="decimal" id="souM" placeholder="0${devDec()?",00":""} ${esc(devSym())}"
      value="${esc(d.mTxt||"")}" autocomplete="off" autocorrect="off" spellcheck="false"></div></div></li>`);
  h += titreBloc("Quel jour","ecart");
  h += liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
    <input type="date" id="souJ" value="${jdate(d.t)}"></div></div></li>`);
  h += listePostes(d.p);
  h += titreBloc("À qui, à quoi","ecart");
  h += liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
    <input type="text" id="souQ" placeholder="Dîme de novembre, le loyer, le marché…"
      value="${esc(d.q||"")}"></div></div></li>`);
  if(!neuf)
    h += liste(ligne({titre:`<span class="rouge">Effacer</span>`, attr:'data-act="souEffacer"'}));
  Z.html=h;
  Z.action=bouton("Garder", 'data-act="souGarder"');
}

/* ---------- la monnaie, une fois pour toutes ---------- */
/* Un registre dont on ne peut pas dire la monnaie n'est pas un registre : il
   compterait des nombres sans unité (13.cl, 13.dk). Changer la monnaie ne
   convertit rien — on ne devine pas un taux de change, et il serait faux pour
   la moitié des lignes. L'écran le dit. */
function vDevise(){
  Z.titre="Ma monnaie"; Z.retour=true;
  const n=(db.sous||[]).length;
  Z.html = `<div style="height:10px"></div>`
    + liste(DEVISES.map(function(x){
        const pris=(db.dev||"EUR")===x[0];
        return ligne({titre:pris ? `<span class="coche">${esc(x[1])}</span>` : esc(x[1]),
          sous:esc(x[2]),
          apres:pris ? `<span class="coche">✓</span>` : "",
          attr:'data-dev="'+x[0]+'"'});
      }).join(""))
    + (n ? `<div class="block amorce">Changer de monnaie ne convertit rien : les <b>${n}</b> montant${n>1?"s":""} déjà noté${n>1?"s":""} garde${n>1?"nt":""} leur nombre et se liront dans la nouvelle. Aucun taux n'est deviné.</div>` : "");
}

VUES.argent = vArgent;
VUES.sou = vSou;
VUES.devise = vDevise;
