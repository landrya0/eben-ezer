/* Ében-Ézer — ecrans-temps
   Les écrans du temps : pointer, la frise, mon temps.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- pointer : à quoi je suis ---------- */
/* Un seul écran pour deux usages, parce que c'est la même question : à quoi
   suis-je maintenant, et à quoi étais-je tout à l'heure. */
function vPointer(){
  const corr = S.blocId ? blocT(S.blocId) : null;
  const trou = (!corr && S.trou) ? S.trou : null;
  Z.titre = (corr||trou) ? "C'était quoi ?" : "À quoi maintenant ?";
  Z.retour = true;
  const o = ouvert(), ouv = ouverts(), q = (S.tQ||"").trim(), cats = CATS();
  const enCours = {};
  ouv.forEach(function(b){ enCours[b.t]=1; });
  /* Dans un creux, la coche ne dit pas ce qui tourne — rien ne tourne —
     mais ce qu'on y a déjà posé (13.dr). */
  const placees = {};
  if(trou) dansTrou(trou).forEach(function(b){ placees[b.t]=1; });
  /* Un creux vif ne naît que d'un arrêt voulu (13.db) : on le mesure avant
     tout, parce que c'est lui qui décide de ce que la page a à dire. */
  const vif = (!corr && !S.trou && !ouverts().length) ? creuxVif() : null;
  /* Dès qu'on répond « c'était ça », les bornes du creux sont gelées : sans
     cela la deuxième activité tomberait sur un bloc d'une seconde plus
     tard, et « toucher à nouveau pour retirer » ne retrouverait rien
     (13.dr, 13.eg). Le creux gelé se lit ensuite comme le creux vif qu'il
     reste — c'est la même question, et elle garde son rang. */
  const trVif = (trou && S.trouVif) ? trou : null;
  const dv = trVif ? trVif.fin-trVif.deb : vif ? Date.now()-vif.deb : 0;
  const choixVif = !!vif && dv>=SEUIL_CREUX;
  let h = "";
  if(corr) h += `<div class="block amorce" style="margin-top:16px"><b>${esc(tacheNom(corr.t))}</b>, de ${hmin(new Date(corr.deb))} à ${corr.fin?hmin(new Date(corr.fin)):"maintenant"}.</div>`;
  else if(trou){
    /* « Rien n'a été compté » devient faux dès qu'on y a posé quelque
       chose, et l'écran reste ouvert pour en poser d'autres : il dit donc
       ce qu'il tient déjà (13.ch, 13.dr). */
    const dd=dansTrou(trou);
    h += `<div class="block amorce" style="margin-top:16px">De ${hmin(new Date(trou.deb))} à ${hmin(new Date(trou.fin))} — ${hm(trou.fin-trou.deb)} — ${
      dd.length
        ? dd.map(function(b){ return "<b>"+esc(tacheNom(b.t))+"</b>"; }).join(", ")+". Touche-en d'autres si c'était aussi ça — ou une ligne cochée, pour la retirer."
        : "rien n'a été compté. Dis à quoi c'est allé."}</div>`;
  }
  else if(o) h += `<div class="block amorce" style="margin-top:16px">Depuis ${hmin(new Date(o.deb))}, le temps va à <b>${esc(tacheNom(o.t))}</b> — ${hm(Date.now()-o.deb)}.${
      ouv.length>1 ? " En même temps : "+ouv.filter(function(b){ return b!==o; }).map(function(b){ return "<b>"+esc(tacheNom(b.t))+"</b>"; }).join(", ")+"." : ""}</div>`;
  else if(choixVif) h += `<div class="block amorce" style="margin-top:16px">Rien n'est compté depuis que tu as arrêté, à ${hmin(new Date(vif.deb))}.</div>`;
  else h += `<div class="block amorce" style="margin-top:16px">Rien n'est compté. À partir de ce que tu touches ici, le temps aura un destinataire.</div>`;
  /* Le défaut ne peut pas être de donner ce temps-là à la première activité
     choisie : le disciple venait de le retirer à tout le monde. Mais il
     arrive aussi qu'on s'arrête, puis qu'on se remette à prier sans le dire
     — alors on le reprend, d'une tape. Deux positions, et l'écran dit
     laquelle il tient : la forme déjà employée pour « à la place / en
     plus » (13.db). */
  /* Une seule question — ce temps-là, et après ? —, donc un seul rang
     (13.cu). Il lui manquait sa troisième réponse : « c'était ça, et c'est
     fini ». Sans elle, dire ce qu'avaient été quarante-six minutes passées
     coûtait cinq gestes — reprendre depuis l'arrêt, toucher l'activité,
     revenir au pointage, l'arrêter —, et c'est par ce détour-là que le
     disciple passait (13.eg).
     « À personne » reste la position par défaut, et 13.db ne bouge pas :
     ce temps, il venait de le retirer à tout le monde, et l'application ne
     le redonne à personne sans qu'il le dise. */
  if(choixVif || trVif){
    h += `<div class="puces" style="padding-top:2px">`
      + `<button class="puce" data-vif="rien" aria-pressed="${!S.vifPour}">À personne</button>`
      + `<button class="puce" data-vif="clos" aria-pressed="${S.vifPour==="clos"}">C'était ça</button>`
      + `<button class="puce" data-vif="suite" aria-pressed="${S.vifPour==="suite"}">J'y suis encore</button></div>`
      + `<div class="block amorce">${
          S.vifPour==="clos"
            ? "Ces <b>"+esc(hm(dv))+"</b> iront à ce que tu touches, et rien ne se mettra à tourner. Touches-en plusieurs si c'était plusieurs."
          : S.vifPour==="suite"
            ? "Ces <b>"+esc(hm(dv))+"</b> iront à ce que tu touches, et le compteur continuera — comme s'il n'avait jamais été arrêté."
          : "Ce temps-là — <b>"+esc(hm(dv))+"</b> — n'ira à personne : ce que tu touches part de maintenant."}</div>`;
  }
  /* La séance qu'on vient de quitter garde sa porte ici, le temps qu'elle
     reste fraîche : l'arrêt ne pose plus la question une seconde fois, et
     sans cette ligne il faudrait traverser « Mon temps » pour y revenir
     (13.ei). Pas pendant une correction ni dans un creux : là, l'écran
     répond déjà à une autre question (13.cs). */
  if(!corr && !trou) h += porteSeance();
  /* S'arrêter n'était possible qu'au fond d'un menu, sur un bloc, depuis
     « Mon temps » : trois gestes pour dire qu'on ne fait plus rien. Or on
     s'arrête souvent, et sans savoir ce qui vient après. L'arrêt est donc
     ici, en clair, juste sous ce qui tourne. Il ne range rien ailleurs : le
     temps écoulé reste à l'activité qu'il a servie, et ce qui suit n'est
     compté à personne — parce qu'il n'a servi personne. */
  /* Quand plusieurs choses tournent, le seul arrêt visible les arrêtait
     toutes : on finissait de se laver et la prière s'arrêtait avec. Arrêter
     une activité seule existait — toucher sa ligne cochée, tout en bas, dans
     sa catégorie — mais rien ne le disait, et un geste qu'il faut devinier
     n'existe pas. Ce qui tourne se lit donc ici, nommé, chacun avec son
     heure et son arrêt à soi. Tout arrêter reste dessous, pour ce qu'il est :
     un geste de plus, pas le geste par défaut. */
  if(o && !corr && !trou){
    if(ouv.length>1){
      h += titreBloc("Ce qui tourne");
      h += liste(ouv.slice().sort(function(a,b){ return a.deb-b.deb; }).map(function(b){
        return ligne({titre:esc(tacheNom(b.t))+(b.porte?` <span class="pte">porte l'heure</span>`:""),
          sous:"depuis "+hmin(new Date(b.deb))+" — toucher pour arrêter ça seulement",
          apres:esc(hm(Date.now()-b.deb)), attr:'data-stop="'+b.id+'"'});
      }).join(""));
    }
    h += liste(ligne({titre:ouv.length>1 ? "Tout arrêter" : "Arrêter de compter",
      sous:"Le temps déjà passé reste à "+(ouv.length>1 ? "ce qui l'a reçu" : "« "+esc(tacheNom(o.t))+" »"),
      attr:'data-act="arretNet"'}), "lien");
  }
  /* L'interrupteur à deux positions a disparu d'ici. Une position par
     défaut est un choix que l'application fait à sa place — et celui-là
     arrête un compteur, ce qui se corrige mal. La question se pose donc au
     seul moment où elle se pose vraiment : quand il touche une activité
     alors que quelque chose tourne. Elle arrive alors nommée, en deux
     lignes, et sa réponse vaut pour le reste de la visite (13.dt).
     Dans un creux, rien ne tourne et rien ne peut être perdu : chaque tape
     ajoute, et l'écran reste ouvert jusqu'à ce qu'il s'en aille (13.dr). */
  /* La phrase ne se répète pas une fois qu'il y a quelque chose dedans :
     l'amorce du haut le dit déjà, et deux phrases pour une chose en font
     une de trop. */
  if(trou && !dansTrou(trou).length)
    h += `<div class="block amorce">Touche-en autant que c'était : elles couvriront toutes ce même temps.</div>`;

  h += liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <input type="text" id="tQ" placeholder="Chercher, ou nommer autre chose" value="${esc(S.tQ||"")}" autocomplete="off" autocapitalize="sentences"></div></div></li>`);

  const dejaLa = (db.taches||[]).some(t=>t.nom.toLowerCase()===q.toLowerCase());
  h += `<div id="tNeuf"${(!q || dejaLa)?" hidden":""}>
      ${titreBloc("Nouvelle activité")}
      <div class="block amorce">Dans quoi la ranger ? C'est ce rangement, et lui seul, qui fera les parts.</div>
      <div class="puces">${cats.map(c=>`<button class="puce" data-tcat="${c.id}" aria-pressed="${S.tCat===c.id}">${esc(c.nom)}</button>`).join("")}</div>
      ${liste(ligne({titre:`<span class="qn">Compter « ${esc(cap(q))} »</span>`, attr:'data-act="neufTache"'}), "lien")}
    </div>`;

  if(!(db.taches||[]).length){
    h += titreBloc("Pour commencer");
    h += `<div class="block amorce">Touche-en une : elle est créée, rangée, et comptée dès cet instant. Tu en ajouteras autant que tu veux, et tu pourras les ranger autrement.</div>`;
    cats.forEach(function(c){
      const arr = TACHES_SOCLE.filter(x=>x[1]===c.id);
      if(!arr.length) return;
      h += `<div class="tgrp">${titreBloc(esc(c.nom))}${liste(arr.map(x=>ligne({titre:esc(x[0]),
        attr:'data-sugg="'+esc(x[0])+'" data-cat="'+c.id+'" data-nom="'+esc(x[0].toLowerCase())+'"'})).join(""))}</div>`;
    });
  } else {
    /* Ce qu'on fait souvent remonte de soi-même : la liste s'ordonne sur la
       vie, pas sur l'alphabet. */
    const freq = cumul(minuit(29), Date.now()).par;
    cats.forEach(function(c){
      const arr = (db.taches||[]).filter(t=>(t.cat||"reste")===c.id)
        .sort((a,b)=>(freq[b.id]||0)-(freq[a.id]||0) || a.nom.localeCompare(b.nom,"fr"));
      if(!arr.length) return;
      h += `<div class="tgrp">${titreBloc(esc(c.nom))}${liste(arr.map(t=>ligne({titre:esc(t.nom),
        apres:((enCours[t.id] && !corr && !trou) || placees[t.id]) ? `<span class="coche">✓</span>` : (freq[t.id] ? esc(hm(freq[t.id])) : ""),
        attr:'data-tache="'+t.id+'" data-nom="'+esc(t.nom.toLowerCase())+'"'})).join(""))}</div>`;
    });
  }
  if(!corr && !trou) h += liste(ligne({titre:"Mon temps", attr:'data-go="temps"'}), "lien");
  Z.html = h;
}

/* Un creux, c'est un moment où rien ne tournait : il se lit sur l'union des
   périodes, jamais sur la suite des blocs (13.by). Le même calcul sert à la
   liste, à la frise et à la porte qui mène au dernier creux — un vide ne doit
   pas être compté de trois façons.
   Une minute, et non dix. Le récap tient pour non compté tout ce qui dépasse
   la minute ; la liste n'en montrait qu'au-delà de dix. L'app accusait donc
   trois minutes sans offrir de les dire. Deux seuils sur un même écran, c'est
   un reproche sans porte : il n'en reste qu'un (13.cb).
   Le seuil lui-même est déclaré dans `03-temps.js` : le rail s'en sert, et
   le rail est chargé avant cet écran. */
function creuxDe(t0, t1, seuil){
  const n=Date.now(), fus=[];
  (db.temps||[]).map(function(b){ return [Math.max(b.deb,t0), Math.min(b.fin||n, t1)]; })
    .filter(function(sp){ return sp[1]>sp[0]; })
    .sort(function(p,q){ return p[0]-q[0]; })
    .forEach(function(sp){
      const d=fus[fus.length-1];
      if(d && sp[0]<=d[1]){ if(sp[1]>d[1]) d[1]=sp[1]; }
      else fus.push([sp[0], sp[1]]);
    });
  const out=[];
  for(let i=0;i<fus.length-1;i++)
    if(fus[i+1][0]-fus[i][1] >= seuil) out.push([fus[i][1], fus[i+1][0]]);
  const der=fus.length ? fus[fus.length-1][1] : 0;
  const haut=Math.min(n, t1);
  if(der && haut-der >= seuil) out.push([der, haut]);
  return out;
}
/* Cinq teintes sourdes, au même registre que le papier : elles ne décorent
   rien, elles distinguent — sans elles, deux barres côte à côte ne disent pas
   si l'on servait Dieu ou soi-même. Une catégorie ajoutée à la main prend le
   gris du reste : mieux vaut une teinte honnête qu'une couleur inventée. */
const CCOUL = {dieu:"--c-dieu", famille:"--c-famille", travail:"--c-travail",
               moi:"--c-moi", reste:"--c-reste"};
function coulCat(id){ return "var("+(CCOUL[id]||"--c-reste")+")"; }
const PASX = [0.7, 1.6, 3.2];
/* ---------- la frise : la journée vue de haut ---------- */
/* Une liste dit la suite ; elle ne dit pas l'épaisseur. Depuis qu'on mène
   plusieurs choses de front, la question « qu'est-ce qui tournait pendant
   quoi » ne se lit plus en ligne : il faut de la largeur. Le temps descend,
   les activités se rangent en colonnes, et chacune occupe exactement ce
   qu'elle a duré — une heure, un centimètre, la même échelle d'un bout à
   l'autre, sans quoi la frise mentirait pour faire joli.
   La journée seulement : à sept jours, la même échelle ferait dix mille
   pixels, et une frise qu'on ne peut pas embrasser n'est plus une frise. */
function vFrise(){
  const n=Date.now(), f=fenetre(), t1=Math.min(n, f.t1);
  Z.titre=f.ici ? "La journée" : cap(f.court); Z.retour=true;
  const bs=(db.temps||[]).filter(function(b){ return (b.fin||n)>f.t0 && b.deb<t1; })
    .slice().sort(function(a,b){ return a.deb-b.deb; });
  if(!bs.length){ Z.html=`<p class="vide">Rien de compté ${f.nom}.</p>`; return; }
  const t0=Math.max(f.t0, bs[0].deb);
  /* La largeur ne se partage qu'entre ce qui se recouvre vraiment. Une
     seule colonne pour toute la journée gaspillait la moitié de l'écran :
     deux activités se croisaient dix minutes, et les douze heures qui
     suivaient restaient à demi vides. On découpe donc la journée en
     grappes — des suites de blocs qui se touchent de proche en proche — et
     chaque grappe partage la largeur entre ses seules colonnes. Seule, une
     activité prend toute la page ; et un bloc s'étend sur les colonnes
     libres à sa droite tant que rien ne s'y oppose. */
  const pose=bs.map(function(b){
    return {b:b, d:Math.max(b.deb, t0), f:Math.min(finDe(b), t1), l:0, sp:1, n:1};
  });
  /* Une échelle unique ne peut pas servir une journée faite d'un bloc de six
     heures et de huit blocs de sept minutes : à l'échelle du long, les courts
     deviennent des traits sans nom ; à l'échelle des courts, la journée fait
     quatre écrans. On ne triche donc pas sur l'échelle — elle reste la même
     du haut en bas — mais on la laisse se régler, et le réglage par défaut
     est celui qui rend lisible le plus court des blocs sans que la journée
     dépasse ce qu'un pouce parcourt (13.cc). */
  const mins=Math.max(1, (t1-t0)/60000);
  const court=Math.min.apply(null, pose.map(function(x){ return Math.max(1, (x.f-x.d)/60000); }));
  let iz=S.frisZ;
  if(iz===null || iz===undefined){
    iz=0;
    for(let k=0;k<PASX.length;k++){
      if(mins*PASX[k]<=2400) iz=k;
      if(court*PASX[k]>=14 && mins*PASX[k]<=2400){ iz=k; break; }
    }
  }
  const PX=PASX[iz], H=Math.max(180, Math.round(mins*PX));
  const y=function(t){ return Math.round((Math.max(t0, Math.min(t1, t))-t0)/60000*PX); };

  const grappes=[];
  let gr=null;
  pose.forEach(function(x){
    if(!gr || x.d>=gr.fin){ gr={items:[], fin:x.f}; grappes.push(gr); }
    gr.items.push(x); if(x.f>gr.fin) gr.fin=x.f;
  });
  grappes.forEach(function(g){
    const fins=[];
    g.items.forEach(function(x){
      let i=0; while(i<fins.length && fins[i]>x.d) i++;
      if(i===fins.length) fins.push(x.f); else fins[i]=Math.max(fins[i], x.f);
      x.l=i;
    });
    const nc=Math.max(1, fins.length);
    g.items.forEach(function(x){
      x.n=nc;
      let e=x.l+1;
      while(e<nc && !g.items.some(function(o){ return o!==x && o.l===e && o.d<x.f && o.f>x.d; })) e++;
      x.sp=e-x.l;
    });
  });

  /* Une activité ne porte pas l'heure tout du long : elle la porte par
     morceaux, selon ce qui tournait à côté d'elle à chaque instant. Dire
     « pleine » ou « creuse » la barre entière aurait menti sur ses bords.
     Le trait de gauche marque donc exactement les moments portés — c'est la
     règle des parts (13.by) rendue visible, et non une seconde règle. */
  const marques={};
  pose.forEach(function(x){ marques[x.d]=1; marques[x.f]=1; });
  const ts=Object.keys(marques).map(Number).sort(function(p,q){ return p-q; });
  const port={};
  for(let i=0;i<ts.length-1;i++){
    const a=ts[i], z=ts[i+1];
    const act=pose.filter(function(x){ return x.d<=a && x.f>=z; });
    if(!act.length) continue;
    const c=chef(act.map(function(x){ return x.b; }));
    if(!c) continue;
    const arr=port[c.id]||(port[c.id]=[]);
    const d=arr[arr.length-1];
    if(d && d[1]===a) d[1]=z; else arr.push([a, z]);
  }

  let h=`<div class="puces" style="padding-top:15px">${PASX.map(function(v,k){
      return `<button class="puce" data-friz="${k}" aria-pressed="${k===iz}">${["Serré","Normal","Large"][k]}</button>`;
    }).join("")}</div>`;
  h+=`<div class="block amorce">L'échelle est la même du haut en bas ; la couleur dit la catégorie. Le trait plein, à gauche, marque les moments où cette activité <b>portait l'heure</b> — le reste tournait à côté. Touche une barre pour la corriger, un tireté pour dire ce que c'était.</div>`;
  h+=`<div class="frisew"><div class="frise" style="height:${H}px">`;
  const h0=new Date(t0); h0.setMinutes(0,0,0);
  for(let t=h0.getTime(); t<=t1; t+=3600000){
    if(t<t0) continue;
    h+=`<div class="fh" style="top:${y(t)}px"><span>${new Date(t).getHours()} h</span></div>`;
  }
  creuxDe(f.t0, t1, SEUIL_CREUX).forEach(function(v){
    if(v[1]<=t0) return;
    const a=y(v[0]), z=y(v[1]), e=Math.max(2, z-a);
    h+=`<div class="ftrou" style="top:${a}px;height:${e}px" data-creux="${v[0]}|${v[1]}">${
      e>=18 ? `<span>Rien de compté — ${esc(hm(v[1]-v[0]))}</span>` : ""}</div>`;
  });
  /* Un bloc court ne peut pas porter deux lignes : les lui imposer faisait
     déborder son texte sur le suivant. Il dit alors son nom et sa durée sur
     une ligne ; plus court encore, il ne dit rien et se touche — la liste,
     dessous, le nomme. On ne triche pas sur sa hauteur : elle est son temps. */
  pose.forEach(function(x){
    const a=y(x.d), z=y(x.f), col=coulCat(tacheCat(x.b.t)), e=Math.max(9, z-a);
    const w=100/x.n, nom=esc(tacheNom(x.b.t)), dur=esc(hm((x.b.fin||n)-x.b.deb));
    const sp=(port[x.b.id]||[]).map(function(v){
      const sa=Math.max(0, Math.min(e-2, y(v[0])-a));
      return `<span class="fp" style="top:${sa}px;height:${Math.max(3, Math.min(e-sa, y(v[1])-y(v[0])))}px;background:${col}"></span>`;
    }).join("");
    const cl = e<13 ? " mini" : (e<30 ? " court" : "");
    const corps = e<13 ? "" : (e<30 ? `<b>${nom}<em>${dur}</em></b>`
                                    : `<b>${nom}</b><i>${dur}</i>`);
    h+=`<div class="fb${cl}" data-bloc="${x.b.id}" style="top:${a}px;height:${e}px;left:${x.l*w}%;width:calc(${x.sp*w}% - 4px);border-color:${col};color:${col};background:color-mix(in srgb, ${col} 11%, transparent)">${sp}${corps}</div>`;
  });
  h+=`</div></div>`;
  Z.html=h;
}

/* ---------- mon temps ---------- */
/* Des heures et des parts. Le dénominateur a d'abord été ce qui avait été
   compté, et non la journée : une part sur du temps qu'on n'a jamais réclamé
   paraissait un chiffre inventé. Elle ne l'est plus, depuis qu'on tient pour
   principe que **le temps non comptabilisé n'était pas pour Dieu** (13.bw).
   Ce n'est pas un trou dans la connaissance, c'est une réponse par défaut.
   Le dénominateur est donc le temps entier de la fenêtre, et ce qui n'a pas
   été compté y paraît pour ce qu'il vaut. Sans quoi, celui qui ne pointe que
   sa prière lirait qu'il a donné cent pour cent de sa vie à Dieu — et ce
   serait, au sens strict, une louange empruntée. */
function vMonTemps(){
  Z.titre="Mon temps"; Z.retour=true;
  /* La vue est gardée d'un passage à l'autre, et c'est le seul endroit où
     elle vit : deux champs à tenir d'accord entre eux n'en font jamais un
     bon (13.cn, 13.ee). */
  const f=fenetre(), c=cumul(f.t0, f.t1),
        v=vueDe(S.view, ONG_TEMPS.map(function(o){ return o[0]; }), "parts");
  /* L'écran disait tout à la fois — les parts, les seize routines, les
     lectures, activité par activité, puis la journée bloc par bloc — et neuf
     sections d'affilée ne se lisent pas, elles se traversent. Ce sont trois
     questions distinctes, et chacune a sa vue : où est passé le temps, ce que
     chaque routine a reçu, et ce qui s'est passé heure par heure (13.cs).
     La fenêtre, elle, vaut pour les trois : elle reste au-dessus, et sous
     une forme qui dit qu'elle filtre au lieu de choisir (13.cu). */
  /* Les vues sont des onglets, le grain est un filtre : deux ordres de
     choses, donc deux formes. Trois rangs de pastilles identiques les
     donnaient pour équivalents, et on cherchait lequel changeait quoi. */
  let h = `<div class="ongt" role="tablist">${ONG_TEMPS.map(function(o){
      return `<button role="tab" data-vue="${o[0]}" aria-selected="${v===o[0]}">${o[1]}</button>`;
    }).join("")}</div>`;
  h += barreFen(f);
  if(!c.tot){
    h += `<p class="vide">Rien de compté ${f.nom}. Touche le compteur, en bas, et dis à quoi tu es.</p>`;
    Z.html=h; return;
  }
  const ecoule=Math.max(c.tot, f.t1-f.t0);
  const creux=Math.max(0, ecoule-c.tot);
  /* Deux nombres, et c'est le second qui demande une phrase : la somme des
     activités peut dépasser la journée dès que plusieurs tournent ensemble,
     et sans explication ce serait lu comme une faute de calcul. */
  const porte=c.porte>c.tot ? c.porte : 0;
  /* Cette phrase explique les parts — elle n'a donc rien à faire ailleurs :
     la barre de fenêtre dit déjà, sur les trois vues, ce qu'on regarde. */
  if(v==="parts")
  h += `<div class="block amorce"><b>${esc(hm(c.tot))}</b> comptés sur <b>${esc(hm(ecoule))}</b> ${f.nom}. Les parts se lisent sur le temps entier : ce qu'on n'a pas compté, on le tient pour n'ayant pas été pour Lui.${
    porte ? ` Et ces ${esc(hm(c.tot))} ont porté <b>${esc(hm(porte))}</b> d'activités menées de front — <b>×${String(Math.round(porte*10/c.tot)/10).replace(".", ",")}</b>.` : ""}</div>`;

  const parCat=c.parCat;
  if(v==="parts"){
  const vus=CATS().filter(x=>parCat[x.id]).sort((a,b)=>parCat[b.id]-parCat[a.id]);
  h += titreBloc("La part de chacun");
  h += `<div class="tps">`+vus.map(function(x){
    const l=partPc(parCat[x.id], ecoule), w=ecoule ? parCat[x.id]*100/ecoule : 0;
    return `<div class="tl"><span class="tn">${esc(x.nom)}</span>
      <span class="tv"><b>${l} %</b>${esc(hm(parCat[x.id]))}</span>
      <span class="tj"><i style="width:${w}%"></i></span></div>`;
  }).join("")
   /* Une minute d'écart entre deux lectures d'horloge n'est pas un creux :
      sans ce seuil, un jour entièrement compté affichait « Non compté 0 % ». */
   + (creux>=60000 ? `<div class="tl creuse"><span class="tn">Non compté</span>
      <span class="tv"><b>${partPc(creux, ecoule)} %</b>${esc(hm(creux))}</span>
      <span class="tj"><i style="width:${ecoule?creux*100/ecoule:0}%"></i></span></div>` : "")
   + `</div>`;
  /* La bande « Non compté » disait un chiffre sans mener nulle part. Elle a
     maintenant sa porte, juste dessous : on comble du plus récent vers le
     plus ancien, parce que c'est celui qu'on a encore en mémoire. */
  const cx=creuxDe(f.t0, Math.min(f.t1, Date.now()), SEUIL_CREUX);
  if(cx.length)
    h += liste(ligne({titre:"Combler ce qui n'est pas compté",
      sous: cx.length>1 ? cx.length+" plages — on commence par la dernière"
                        : "Une plage de "+esc(hm(cx[0][1]-cx[0][0])),
      attr:'data-act="comblerDer"'}), "lien");
  }

  /* Ici, chaque activité compte tout son temps, et les pourcentages n'ont
     plus leur place : ils ne se rapporteraient à aucun total commun. Les
     parts vivent au-dessus, dans « La part de chacun », et nulle part
     ailleurs — c'est ce qui évite d'avoir deux chiffres qui se contredisent
     sur le même écran. */
  /* Les seize, toutes, dans l'ordre du message — pas seulement celles qui ont
     reçu quelque chose. Un compte rendu qui masquerait les vides ne dirait
     que ce qu'on a déjà fait ; c'est le « — » qui porte la question (13.co).
     Il reste honnête parce qu'il est dit en toutes lettres : ce tiret compte
     le temps, et une routine vécue en actes attend encore son autre face. */
  const pd=parDisc(c.par);
  /* Les temps mis à part passent avant les routines chronométrées : une
     retraite en cours est le cadre dans lequel tout le reste se lit. */
  if(v==="routines"){
    const prs=perDans(f.t0, f.t1);
    h += titreBloc("Un temps mis à part","ecart");
    if(prs.length){
      h += liste(prs.map(function(pr){
        const cp=cumulPer(pr);
        return ligne({titre:esc(discNom(pr.d)), sous:esc(perTxt(pr)),
          apres: cp.tot ? esc(hm(cp.tot)) : "", attr:'data-prd="'+pr.id+'"'});
      }).join(""));
    }
    h += liste(ligne({titre: prs.length ? "En mettre un autre" : "Mettre un temps à part",
        sous:"Une retraite, un jeûne — ce qui dure et qui encadre",
        attr:'data-act="perNeuve"'}), "lien");
    if(!prs.length)
      h += `<div class="block amorce">Une retraite, un jeûne, ne se chronomètrent pas : on ne les FAIT pas, on y EST. Ils ne pèsent aucune heure — ils disent à l'intérieur de quoi le reste s'est passé, et ce qu'on y a donné se compte dedans.</div>`;
  }

  if(v==="routines" && routineDite()){
    h += titreBloc("Les routines","ecart");
    const rep=actesParDisc(f.t0, f.t1);
    h += liste(DISC.map(function(x){
      const ps=perDisc(x[0], f.t0, f.t1), pt=perDiscTxt(ps);
      /* Le tiret dit « rien reçu ». Devant une retraite en cours, ce serait
         faux : la routine est vécue, elle ne se compte simplement pas en
         heures. On le tait donc, et le cadre parle en dessous (13.cw). */
      const o={titre:esc(x[1]),
               apres: pd[x[0]] ? esc(hm(pd[x[0]])) : (pt ? "" : "—")};
      const m=mesureDisc(x[0], f.t0, f.t1), r=rep[x[0]];
      /* Ce que le lien « pendant » permet enfin de dire : non plus seulement
         ce que j'ai donné, mais ce qu'Il y a répondu (13.cx). */
      const sous=[pt, m, r ? (r+" fois qu'Il y a parlé ou agi") : ""].filter(Boolean).join(" · ");
      if(sous) o.sous=esc(sous);
      /* Une seule période : la ligne y mène. Plusieurs, et c'est la section
         du dessus qui les tient — on ne choisit pas à la place du disciple. */
      if(ps.length===1) o.attr='data-prd="'+ps[0].id+'"';
      return ligne(o);
    }).join(""));
    h += `<div class="block amorce">Les seize routines du message de Bertoua : <b>le temps</b>, et ce que chacune compte en propre. Un tiret dit que cette routine n'a rien reçu ${esc(f.nom)}, pas qu'elle n'a pas été vécue — un temps mis à part ne pèse aucune heure et se lit en dessous, et ce qui se vit en actes, une dîme, une âme touchée, se comptera à côté.</div>`;
  }

  const pf=pagesFen(f.t0, f.t1);
  if(v==="routines" && (pf.pg || (db.livres||[]).length)){
    h += titreBloc("Mes lectures","ecart");
    const quoiPg=resumeLus(pagesFenPar(f.t0, f.t1), nomPassagePg);
    h += liste(ligne({titre:"Pages et parties",
        sous: quoiPg || "Rien de lu "+f.nom,
        apres:esc(String(pf.pg))})
      + (db.livres||[]).slice()
        .sort(function(x,y){ return (livreFini(x)?1:0)-(livreFini(y)?1:0)
                                 || pageLue(y.id)-pageLue(x.id); })
        .map(function(l){
          const vu=pageLue(l.id), tot=l.pages||0, reste=Math.max(0, tot-vu);
          /* 13.el — une série n'a ni dernière page ni pourcentage : la seule
             chose vraie à en dire est combien de parties ont été suivies.
             Un pourcentage sur un total inconnu serait un chiffre faux. */
          const par=enParties(l);
          return ligne({titre:esc(l.nom),
            sous: (l.a?esc(auteurNom(l.a))+" · ":"")
                + (livreFini(l) ? "Fini"
                : par ? partiesTxt(partiesVues(l.id))+" suivies"
                : (tot ? partPc(Math.min(vu,tot), tot)+" % — il reste "+pagesTxt(reste)
                       : "Nombre de pages inconnu")),
            apres: esc(par ? "partie "+vu : (tot ? vu+" / "+tot : String(vu))),
            attr:'data-lv="'+l.id+'"'});
        }).join(""));
  }

  /* La liste des auteurs vit sous les lectures : c'est là qu'on se demande de
     qui l'on reçoit, et c'est de là qu'on atteint leur fiche. */
  if(v==="routines" && (db.auteurs||[]).length){
    h += titreBloc("Ceux dont tu reçois","ecart");
    h += liste(auteursConnus().map(function(x){
      const r=recuDe(x.id);
      return ligne({titre:esc(x.nom), sous:esc(recuTxt(r)), attr:'data-au="'+x.id+'"'});
    }).join(""));
  }

  const tids=Object.keys(c.par).sort((a,b)=>c.par[b]-c.par[a]);
  if(v==="parts"){
  h += titreBloc("Activité par activité","ecart");
  if(porte) h += `<div class="block amorce">Chacune compte tout son temps. Quand plusieurs sont menées de front, leur somme dépasse la journée — c'est voulu : la journée, elle, est au-dessus.</div>`;
  /* Le rangement d'abord — c'est lui qui fait les parts — et la routine
     derrière, quand elle est déclarée : c'est là qu'on veut voir l'association,
     à côté du temps qu'elle a reçu. */
  h += liste(tids.map(function(tid){
    const dd=discTache(tid);
    return ligne({titre:esc(tacheNom(tid)),
      sous:esc(catNom(tacheCat(tid))) + (dd ? " · "+esc(discNom(dd)) : ""),
      apres:esc(hm(c.par[tid])), attr:'data-tch="'+tid+'"'});
  }).join(""));
  }

  /* Le temps dit la fidélité, pas le chemin. Deux heures dans la Parole
     peuvent être dix chapitres ou un seul relu dix fois : les deux sont
     justes, et aucun des deux ne se déduit de l'autre. On compte donc à
     part — les chapitres lus sur la fenêtre, et le terrain parcouru depuis
     le début, qui lui ne grandit qu'une fois par chapitre. */
  const lf=chapFen(f.t0, f.t1), lt=chapDistincts(null);
  if(v==="routines" && (lf.ch || lt)){
    h += titreBloc("La Parole","ecart");
    /* Le nombre reste — il dit la fidélité — mais il ne reste plus seul :
       sous lui, ce qui a été lu (13.dz). */
    const quoi=resumeLus(chapitresFen(f.t0, f.t1), nomPassage);
    h += liste(ligne({titre:"Chapitres lus",
        sous: quoi || "Rien de lu "+f.nom,
        apres:esc(String(lf.ch))})
      + ligne({titre:"Depuis le début",
        sous:partPc(lt, BIBLE_CH)+" % de l'Écriture — il reste "+(BIBLE_CH-lt)+" chapitres",
        apres:esc(lt+" / "+BIBLE_CH)}));
  }

  /* Les blocs ne se lisaient qu'aujourd'hui, tant qu'ils ne portaient qu'une
     heure : une heure passée ne se relit pas. Depuis qu'ils portent ce qu'on
     y a vécu, ils se relisent — sur toute la fenêtre choisie, et les plus
     récents d'abord. On en montre soixante : au-delà, ce n'est plus une
     relecture, c'est un registre. */
  const n2=Date.now();
  const bs=(db.temps||[]).filter(b=>(b.fin||n2)>f.t0 && b.deb<f.t1).slice().reverse();
  const lus=bs.slice(0,60);
  if(v==="blocs"){
  /* La frise n'a de sens que sur un jour : c'est la seule fenêtre qu'un
     regard embrasse à la même échelle. */
  if(S.per==="jour")
    h += liste(ligne({titre:"Voir la frise de la journée",
      sous:"Les activités côte à côte, heure par heure", attr:'data-go="frise"'}), "lien");
  h += titreBloc(S.per==="jour" ? "La journée, bloc par bloc" : "Bloc par bloc","ecart");
  h += `<div class="block amorce">Touche un bloc pour corriger ses heures — ou pour dire ce qui s'y est passé.</div>`;
  /* Toute une vie a précédé le compteur, et une nuit de prière ne se rattrape
     pas en touchant un creux : avant le premier bloc d'une fenêtre, on ne
     montre aucun creux, et c'est justement là que la nuit se trouve. Il faut
     donc une porte qui n'attende rien de l'existant — deux heures écrites à
     la main, puis la question habituelle : à quoi ce temps est-il allé. */
  h += liste(ligne({titre:"Ajouter un temps passé",
    sous:"Pour ce qui a eu lieu avant qu'on le compte", attr:'data-act="ajoutTemps"'}), "lien");
  /* Entre deux blocs, il y a parfois un creux : on s'est arrêté, et on n'a
     rien compté pendant ce temps-là. On ne fabrique pas une activité pour
     le remplir — « non comptabilisé » serait une part sur du temps qu'on
     n'a jamais réclamé, et le compteur tournerait toute la nuit sur rien.
     Le creux se montre donc pour ce qu'il est : un vide, nommé, daté, qu'on
     peut venir combler plus tard d'une tape. Tant qu'on ne le comble pas,
     il ne pèse sur aucune part.
     Une minute au moins, le même seuil que la bande « Non compté » du récap :
     deux seuils différents sur un même écran accusaient sans laisser
     répondre (13.cb). Et pas de creux de tête : avant le premier bloc d'une
     fenêtre il y a surtout la nuit, qu'on n'a pas à justifier — elle s'écrit
     à la main, par « Ajouter un temps passé ». */
  /* Un creux, c'est un moment où RIEN ne tournait — donc il se lit sur
     l'union des périodes, jamais sur la suite des blocs. Tant qu'un seul
     bloc courait à la fois, les deux revenaient au même ; depuis qu'on peut
     en mener plusieurs de front (13.by), comparer un bloc au précédent
     invente des trous là où une autre mission tournait encore.
     On fusionne donc les périodes, et ce qui reste entre elles est vide.
     Toute fenêtre finit à l'instant présent : le dernier creux est celui
     qu'on vient d'ouvrir en s'arrêtant. */
  const vides=creuxDe(f.t0, Math.min(n2, f.t1), SEUIL_CREUX);

  /* Blocs et creux se mêlent par l'heure, pas par le rang : un creux peut
     tomber entre deux blocs qui ne se suivent pas dans la liste. */
  const plusVieux = lus.length ? Math.max(lus[lus.length-1].deb, f.t0) : f.t0;
  const items=lus.map(function(b){ return {d:Math.max(b.deb, f.t0), b:b}; })
    .concat(vides.filter(function(v){ return v[0]>=plusVieux; })
                 .map(function(v){ return {d:v[0], v:v}; }))
    .sort(function(p,q){ return q.d-p.d; });
  h += liste(items.map(function(it){
    if(it.v) return ligneCreux(it.v[0], it.v[1]);
    const b=it.b, p=partBloc(b, f.t0, f.t1);
    /* Les heures restent celles du bloc — les rogner à minuit effacerait
       l'heure à laquelle on s'est vraiment mis là. C'est le chiffre de
       droite qui ne compte que la part, et une phrase qui dit le reste. */
    const deborde = p.avant && p.apres ? "traverse "+f.nom+" de part en part"
                  : p.avant ? "commencé avant "+f.nom
                  : p.apres ? "se poursuit après "+f.nom : "";
    return ligne({titre:esc(tacheNom(b.t))+(b.porte?` <span class="pte">porte l'heure</span>`:""),
      sous:(S.per==="jour"?"":jourBref(b.deb))+hmin(new Date(b.deb))+" → "+(b.fin?hmin(new Date(b.fin)):"maintenant")
        +(deborde ? " · "+esc(deborde)+", "+esc(hm(p.tot))+" en tout" : "")
        +((b.lu&&b.lu.length)?`<span class="lus">${esc(passagesTxt(b))}</span>`:"")
        +((b.pg&&b.pg.length)?`<span class="lus">${esc(passagesPgTxt(b))}</span>`:"")
      +((b.sj&&b.sj.length)?`<span class="lus">${esc(sujetsTxt(b.sj.length))}</span>`:"")
      +((b.qui&&b.qui.length)?`<span class="lus">${esc(gensTxt(b.qui.length))}</span>`:"")
        +(lectureAilleurs(b, f.t0, f.t1)
          ? `<span class="lus ailleurs">Cette lecture compte au ${esc(dateJour(b.deb))}</span>` : "")
        +(b.note?`<span class="medNote">${esc(b.note)}</span>`:""),
      apres:esc(hm(p.duree)), attr:'data-bloc="'+b.id+'"'});
  }).join(""));
  if(bs.length>lus.length) h += `<p class="vide">…et ${bs.length-lus.length} blocs plus anciens.</p>`;
  }
  /* Une vue qui n'a rien à montrer le dit, plutôt que de laisser la page
     s'arrêter sur ses pastilles sans un mot. */
  if(v==="routines" && !routineDite() && !pf.pg && !lf.ch && !lt && !perDans(f.t0, f.t1).length)
    h += `<p class="vide">Rien à montrer ici tant qu'aucune activité n'a dit de quelle routine elle est la mise en œuvre. Touche-en une dans « Les parts », puis choisis sa routine.</p>`;
  Z.html=h;
}

/* Ce qui a déjà été posé dans ce creux : les blocs qui en couvrent
   exactement les bornes. On ne le retient pas dans l'état, on le relit —
   rien à tenir à jour, rien qui puisse se désaccorder (13.dr). */
function dansTrou(t){
  if(!t) return [];
  return (db.temps||[]).filter(function(b){ return b.deb===t.deb && b.fin===t.fin; });
}

function ligneCreux(d, f){
  return ligne({titre:`<span class="creux">Rien de compté</span>`,
    sous:(S.per==="jour"?"":jourBref(d))+hmin(new Date(d))+" → "+hmin(new Date(f))+" — dire ce que c'était",
    apres:esc(hm(f-d)), attr:'data-creux="'+d+"|"+f+'"'});
}

/* ---------- corriger un bloc de temps ---------- */
/* On pointe toujours en retard : on prie vingt minutes avant d'y penser, on
   referme l'ordinateur sans le dire. Les deux bornes doivent donc s'écrire à
   la main — et elles n'engagent que leur bloc (13.cv). Le voisin reste ou il
   est : ce qu'on lui rend devient un creux, et le creux se montre. */
function dtl(ms){
  const d=new Date(ms), p=function(n){ return String(n).padStart(2,"0"); };
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());
}
/* Les champs d'heure du téléphone comptent en minutes ; l'archive, elle,
   compte à la seconde. Rouvrir l'écran de correction et toucher Garder
   arasait donc les secondes d'une borne qu'on n'avait même pas touchée — et
   un bloc de quelques secondes ne pouvait plus être gardé du tout, sa fin
   retombant sur son début, l'app répondant « la fin doit venir après le
   début » à qui n'avait rien demandé.
   Tant que la minute affichée n'a pas changé, c'est l'heure d'origine qui
   est rendue, secondes comprises : un champ ne corrige que ce qu'on y a
   corrigé. Dès qu'on en change la minute, on parle bien de cette minute-là,
   et elle commence à zéro seconde (13.cj). */
function valHeure(id, origine){
  const e=document.getElementById(id);
  if(!e || !e.value) return null;
  if(typeof origine==="number" && e.value===dtl(origine)) return origine;
  const t=new Date(e.value).getTime();
  return isNaN(t) ? null : t;
}
/* Le voisin ne suit plus le mouvement (13.cv) : on le nomme seulement, pour
   que le disciple sache contre quoi sa borne vient buter, et ce qu'il laisse
   derrière lui en la déplaçant. */
function voisins(b){
  const arr=(db.temps||[]).filter(function(x){ return x.id!==b.id; });
  return {avant:arr.filter(function(x){ return finDe(x)===b.deb; }),
          apres:arr.filter(function(x){ return x.deb===finDe(b); })};
}
function nomVoisins(arr){
  return "<b>"+esc(tacheNom(arr[0].t))+"</b>"
    + (arr.length>1 ? " et "+(arr.length-1)+" autre"+(arr.length>2?"s":"") : "");
}
/* Ce qui est tapé et pas encore gardé doit survivre à un redessin : on le
   relit du champ avant chaque geste qui redessine l'écran. */
function notePer(pr){
  const e=document.getElementById("pdNote");
  if(!pr || !e) return;
  const v=e.value.trim();
  if(v) pr.note=v; else delete pr.note;
}
function noteBloc(b){
  const e=document.getElementById("bNote");
  if(!b || !e) return;
  const v=e.value.trim();
  if(v) b.note=v; else delete b.note;
}

/* ---------- la Parole : les chapitres traversés ---------- */
/* Deux heures de lecture ne disent pas si l'on a traversé un livre ou relu
   trois versets. Le compte pèse le temps ; il ne dit rien du chemin parcouru
   dans l'Écriture — or c'est le chemin qui se relit : « j'en suis à Jérémie »,
   « j'ai lu les évangiles cette année ». On garde donc, sur le bloc, les
   chapitres lus ; et comme l'Écriture a un nombre de chapitres fini et connu,
   l'app sait où l'on s'est arrêté et propose de reprendre juste après.
   Les chapitres tiennent au bloc, jamais à l'activité : « Lecture de la
   Parole » revient tous les jours, et ce qu'on y lit change chaque fois.
   Soixante-six livres, mille cent quatre-vingt-neuf chapitres — le canon
   protestant, dans les noms de la Segond, ceux qu'on lit à la CMCI. */
const BIBLE = [
  ["Genèse",50],["Exode",40],["Lévitique",27],["Nombres",36],["Deutéronome",34],
  ["Josué",24],["Juges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],["1 Rois",22],
  ["2 Rois",25],["1 Chroniques",29],["2 Chroniques",36],["Esdras",10],["Néhémie",13],
  ["Esther",10],["Job",42],["Psaumes",150],["Proverbes",31],["Ecclésiaste",12],
  ["Cantique des cantiques",8],["Ésaïe",66],["Jérémie",52],["Lamentations",5],
  ["Ézéchiel",48],["Daniel",12],["Osée",14],["Joël",3],["Amos",9],["Abdias",1],
  ["Jonas",4],["Michée",7],["Nahum",3],["Habacuc",3],["Sophonie",3],["Aggée",2],
  ["Zacharie",14],["Malachie",4],
  ["Matthieu",28],["Marc",16],["Luc",24],["Jean",21],["Actes",28],["Romains",16],
  ["1 Corinthiens",16],["2 Corinthiens",13],["Galates",6],["Éphésiens",6],
  ["Philippiens",4],["Colossiens",4],["1 Thessaloniciens",5],["2 Thessaloniciens",3],
  ["1 Timothée",6],["2 Timothée",4],["Tite",3],["Philémon",1],["Hébreux",13],
  ["Jacques",5],["1 Pierre",5],["2 Pierre",3],["1 Jean",5],["2 Jean",1],["3 Jean",1],
  ["Jude",1],["Apocalypse",22]
];
const BIBLE_NT = 39, BIBLE_CH = 1189;
function nomLivre(li){ const l=BIBLE[li]; return l ? l[0] : "?"; }
function nbChap(li){ const l=BIBLE[li]; return l ? l[1] : 1; }
function nbLu(r){ return r[2]-r[1]+1; }
function nomPassage(r){
  const n=nomLivre(r[0]);
  return r[1]===r[2] ? n+" "+r[1] : n+" "+r[1]+" à "+r[2];
}
function passagesTxt(b){ return (b.lu||[]).map(nomPassage).join(" · "); }
function chapitresTxt(n){ return n+" chapitre"+(n>1?"s":""); }

/* Une activité ne porte pas toutes les questions : on ne demande pas des
   chapitres à un trajet. Le nom donne un premier avis — « Lecture de la
   Parole » lit la Bible — et l'écran de l'activité tranche quand le nom se
   trompe. Son avis tient : un champ posé à la main vaut mieux qu'une
   devinette qui revient. */
/* ---------- les seize routines ---------- */
/* Le message de Bertoua (2008) nomme seize disciplines à revêtir. Elles ne
   sont pas de cette application : elles lui préexistent, et c'est pourquoi
   on les cite dans leur ordre et sous leurs noms, sans les réécrire.
   On les avait d'abord rangées par mode — ce qui se mesure en durée, ce qui
   se compte en actes, ce qui se tient en posture — et le disciple a tranché :
   « toutes les routines peuvent avoir deux faces, on verra à l'usage. » Il
   avait raison dès son premier exemple : prêcher l'Évangile prend du temps.
   Aucune n'est donc fermée au compteur, et le mode a disparu (13.co). */
const DISC = [
  ["disciple","Devenir et être disciple de Jésus-Christ"],
  ["priere","La prière seul"],
  ["rdqd","Rencontres quotidiennes avec Dieu"],
  ["parole","Lecture de la Bible"],
  ["litt","Lecture de littérature chrétienne"],
  ["retraite","Retraites pour le progrès spirituel"],
  ["ensemble","Prière avec les autres"],
  ["donner","Donner à Dieu"],
  ["jeune","Le jeûne"],
  ["ames","La conquête des âmes"],
  ["former","Faire des disciples"],
  ["cr","Le compte-rendu"],
  ["eglise","Être membre fidèle d'une église locale"],
  ["servir","Servir selon son appel"],
  ["volonte","Vivre dans la volonté de Dieu en tout"],
  ["gloire","Tout faire pour la gloire de Jésus-Christ"]
];
/* Le temps n'est pas la seule mesure d'une routine : la Bible se compte
   aussi en chapitres, la littérature en pages, et demain un jeûne se comptera
   en jours. Chaque routine rend donc ce qu'elle compte en propre, en plus de
   ses heures (13.cp).
   On ne prend que les blocs dont l'activité porte cette routine-là : sans
   quoi deux routines se voleraient leurs nombres le jour où une autre
   activité se met à lire des pages. */
function mesureDisc(id, t0, t1){
  /* 13.el — neuf heures d'enseignement écouté ne se disent pas en pages.
     Les deux unités cohabitent dans la même routine et se disent ensemble. */
  let n=0, p=0;
  const m=mesureProposee(id);
  (db.temps||[]).forEach(function(b){
    if(b.deb<t0 || b.deb>=t1 || discTache(b.t)!==id) return;
    if(id==="parole") (b.lu||[]).forEach(function(r){ n+=nbLu(r); });
    else if(id==="litt") (b.pg||[]).forEach(function(r){
      if(enParties(r[0])) p+=r[2]-r[1]+1; else n+=r[2]-r[1]+1; });
    else if(m==="sujets") n+=(b.sj||[]).length;
    else if(m==="gens") n+=(b.qui||[]).length;
  });
  if(id==="litt"){
    return [n?pagesTxt(n):"", p?partiesTxt(p):""].filter(Boolean).join(" · ");
  }
  if(!n) return "";
  if(id==="parole") return chapitresTxt(n);
  if(m==="sujets") return sujetsTxt(n);
  if(m==="gens") return gensTxt(n);
  return "";
}
/* Une activité déclare-t-elle une routine ? C'est ce qui ouvre le compte
   rendu : sans cela, seize lignes vides n'apprendraient rien. */

