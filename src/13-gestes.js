/* Ében-Ézer — gestes
   Le délégué : un seul écouteur, et le démarrage.
   Chargé en DERNIER : son code racine appelle render(), donc tout ce qu'un
   écran peut toucher doit déjà exister. C'est pourquoi il porte le numéro le
   plus haut, et pourquoi un nouveau fichier d'écrans se glisse AVANT lui.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- gestes ---------- */
document.addEventListener("change", function(ev){
  if(ev.target.id==="tAuteur"){
    const t=tache(S.tchId);
    if(t){
      const au=auteurId(ev.target.value);
      if(t.au!==au){ t.au=au; touche(t); save(); toast(au?"Noté.":"Retiré."); }
      /* On rend le nom tel qu'il est rangé : le disciple voit tout de suite
         sous quelle orthographe son auteur a été retenu. */
      ev.target.value = au ? auteurNom(au) : "";
    }
    return;
  }
  /* Le nom d'une activité se corrige (13.dm). Un nom déjà pris est refusé
     avec son orthographe exacte, et l'écran dit quoi faire à la place : les
     réunir. On ne réunit pas à sa place (13.ct). */
  if(ev.target.id==="tNom"){
    const t=tache(S.tchId);
    if(!t) return;
    const nom=String(ev.target.value||"").trim().replace(/\s+/g," ");
    if(!nom){ ev.target.value=t.nom; toast("Une activité porte un nom"); return; }
    const autre=(db.taches||[]).filter(function(x){
      return x.id!==t.id && String(x.nom).toLowerCase()===nom.toLowerCase(); })[0];
    if(autre){
      ev.target.value=t.nom;
      toast("« "+autre.nom+" » existe déjà — réunis les deux activités");
      return;
    }
    if(cap(nom)===t.nom){ ev.target.value=t.nom; return; }
    t.nom=cap(nom); touche(t); save(); toast("Noté.");
    return render();
  }
  if(ev.target.id==="medIn" || ev.target.id==="medCam" || ev.target.id==="medVid"){
    /* On recopie les fichiers AVANT de vider le champ : `files` est une liste
       vivante, attachée au champ, et la vider vide aussi ce qu'on croyait
       tenir à la main. C'est ainsi qu'une photo pouvait être prise, et
       n'arriver nulle part, sans qu'un seul mot soit dit. */
    const fs=[].slice.call(ev.target.files||[]);
    const n=node(S.nodeId);
    ev.target.value="";
    if(!fs.length) return;
    /* Et si l'acte a disparu entre-temps, on le dit : une photo prise pour
       rien doit au moins être annoncée pour rien. */
    if(!n) return toast("L'acte n'est plus ouvert : la photo n'a pas été jointe.");
    medJoint(n, fs);
    return;
  }
  if(ev.target.id!=="fin") return;
  const f=ev.target.files && ev.target.files[0];
  ev.target.value="";
  if(!f) return;
  const r=new FileReader();
  r.onload=function(){
    try{
      const v=JSON.parse(String(r.result));
      if(!v || !Array.isArray(v.nodes)) throw 0;
      const sacs=(v.med && typeof v.med==="object") ? v.med : null;
      db=sane(v); save(); S.pile=[]; S.view="today";
      toast("Repris"); render();
      /* Les fichiers joints reviennent en réserve derrière l'écran : on ne
         fait pas attendre devant une barre pour une photo. */
      if(sacs) Object.keys(sacs).reduce(function(suite, id){
        return suite.then(function(){
          const d=sacs[id]; if(!d || !d.b64) return;
          try{ return medPose(id, b64Blob(d.b64, d.mime)); }catch(e){}
        });
      }, Promise.resolve()).then(function(){ medRend(); }, function(){});
    }catch(e){ toast("Ce fichier n'est pas une sauvegarde"); }
  };
  r.onerror=function(){ toast("Fichier illisible"); };
  r.readAsText(f);
});
fond.addEventListener("click", function(){ if(ENR) return; fermeMenu(); });
document.addEventListener("click", function(ev){
  const t=ev.target.closest("[data-go],[data-creux],[data-plus],[data-vif],[data-stop],[data-friz],[data-node],[data-filtre],[data-fret],[data-grain],[data-rev],[data-qui],[data-dest],[data-gens],[data-par],[data-man],[data-eman],[data-etat],[data-netat],[data-prec],[data-sug],[data-mic],[data-act],[data-ctype],[data-attach],[data-lierview],[data-chemin],[data-faits],[data-fait],[data-abandon],[data-back],[data-tache],[data-sugg],[data-tcat],[data-bloc],[data-per],[data-vue],[data-medsup],[data-tch],[data-mes],[data-aut],[data-lusup],[data-pgl],[data-pgsup],[data-lv],[data-au],[data-fdec],[data-prd],[data-pdt],[data-pdtneuf],[data-vbloc],[data-ep],[data-eptog],[data-sjadd],[data-sjsup],[data-qadd],[data-qsup],[data-sujp],[data-sujo],[data-sjf],[data-sujrep],[data-perfin],[data-sou],[data-poste],[data-vuea],[data-dev]");
  if(!t) return;
  /* UN SEUL entonnoir pour tous les gestes de l'application : la sonde se
     tient ici, et nulle part ailleurs. Le `finally` est ce qui la rend
     fiable — le corps est fait de retours, et un geste qui part par l'un
     d'eux doit être compté comme les autres (13.dn). */
  if(SONDE) SONDE.ouvre(t.dataset);
  try{ geste(t.dataset, t); }
  finally{ if(SONDE) SONDE.ferme(); }
});
function geste(g, t){
  if(g.mic) return micBascule(g.mic);
  if(g.vuea){ S.vueA=g.vuea; return render(); }
  if(g.sou){
    const x=sou(g.sou); if(!x) return;
    S.sd={id:x.id, t:x.t, p:x.p, q:x.q||"", mTxt:sousNu(x.m)};
    empile(); S.view="sou"; return render();
  }
  /* Le poste est le seul attribut à choisir : le sens en découle (13.cn). */
  if(g.poste){ souLit(); if(S.sd){ S.sd.p=g.poste; } return render(); }
  if(g.dev){
    if(!DEVISES.some(function(x){ return x[0]===g.dev; })) return;
    if(db.dev!==g.dev){ db.dev=g.dev; db.maj=Date.now(); save(); toast("Noté : "+devNom()); }
    return render();
  }
  /* Un onglet est un point de départ : il vide la pile. Le reste s'empile. */
  if(g.go){ fermeMenu();
    if(ONGLETS.some(o=>o[0]===g.go)){ S.pile=[]; }
    else { empile(); }
    S.view=g.go; if(g.go==="note"){S.step=0;S.draft=null;} return render(); }
  if(g.back){
    gardeNote();
    if(S.cNeuf){ S.cNeuf=false; S.cTxt=""; S.cType=""; return render(); }
    if(S.view==="note" && S.step>0){ S.step--; return render(); }
    if(S.view==="note") S.draft=null;
    depile(S.view==="lier"||S.view==="edit" ? "node" : "today"); return render();
  }
  /* Un raccourci : s'il tourne, on l'arrête — et l'arrêt demande ce que sa
     routine commande ; sinon il part. Le même geste pour les deux, parce que
     c'est la même ligne (13.dc). */
  if(g.ep){
    const b=ouverts().filter(function(x){ return x.t===g.ep; })[0];
    if(b){ arreteUn(b); S.pile=[]; S.view="today";
           toast("Arrêté : "+tacheNom(g.ep)); apresArret([b]); return render(); }
    /* L'interrupteur ne vaut que pour le geste qu'on vient de faire : laissé
       en place, il lancerait la prochaine activité par-dessus une autre sans
       qu'on l'ait voulu (13.db, 13.dd). */
    const enPlus=!!S.enPlus; S.enPlus=false;
    pointe(g.ep, enPlus); S.pile=[]; S.view="today";
    toast(enPlus ? "En plus : "+tacheNom(g.ep) : "On compte : "+tacheNom(g.ep));
    return render();
  }
  /* Épingler, c'est une date : elle dit aussi dans quel ordre les lignes se
     rangent. Zéro, et non « absent », pour qu'un décochage voyage à la
     synchronisation au lieu de se faire écraser par l'autre appareil. */
  if(g.sjadd){
    const b=blocT(S.blocId); if(!b) return;
    b.sj=(b.sj||[]);
    if(b.sj.indexOf(g.sjadd)<0) b.sj.push(g.sjadd);
    /* Reprendre un sujet le remet au-dessus de la pile : ce qu'on redit
       souvent se retrouve vite, ce qu'on a dit une fois il y a deux ans
       descend tout seul. */
    touche(sujet(g.sjadd)); touche(b); S.sjQ=""; save(); return render();
  }
  if(g.sjsup){
    const b=blocT(S.blocId); if(!b) return;
    const i=+g.sjsup;
    b.sj=(b.sj||[]).filter(function(x,k){ return k!==i; });
    touche(b); save(); return render();
  }
  if(g.qadd){
    const b=blocT(S.blocId); if(!b) return;
    b.qui=(b.qui||[]);
    if(b.qui.indexOf(g.qadd)<0) b.qui.push(g.qadd);
    touche(db.gens.filter(function(x){ return x.id===g.qadd; })[0]);
    touche(b); S.gQ=""; save(); return render();
  }
  if(g.qsup){
    const b=blocT(S.blocId); if(!b) return;
    const i=+g.qsup;
    b.qui=(b.qui||[]).filter(function(x,k){ return k!==i; });
    touche(b); save(); return render();
  }
  if(g.sujo){ empile(); S.sujId=g.sujo; S.view="sujet"; return render(); }
  /* On referme au moment où il le dit, et on l'emmène aussitôt sur la fiche :
     l'heure exacte de la fin est rarement « maintenant », et la corriger doit
     être le geste suivant, pas une chose à retrouver (13.dj). */
  if(g.perfin){
    const pr=periode(g.perfin); if(!pr) return;
    if(perOuverte(pr)){ pr.fin=Math.max(Date.now(), pr.deb+60000); touche(pr); save(); }
    S.pile=[]; empile(); S.perId=pr.id; S.view="periode";
    toast("Terminé. Corrige l'heure si besoin.");
    return render();
  }
  if(g.sjf){ const e=document.getElementById("sjQ"); if(e) S.sjQ=e.value;
    S.sjF=g.sjf; return render(); }
  /* Le geste du cahier de prière : la réponse vient, on l'écrit, et le lien
     est déjà posé — c'est le sujet qui a ouvert l'assistant (13.di). */
  if(g.sujrep){
    if(!sujet(g.sujrep)) return;
    S.draft=neuf("dieu"); S.draft.fige=true; S.draft.suj=[g.sujrep];
    S.step=0; empile(); S.view="note"; return render();
  }
  if(g.eptog){
    const t=tache(g.eptog);
    if(t){ t.ep = t.ep ? 0 : Date.now(); touche(t); save(); }
    return render();
  }
  if(g.medsup){
    S.medId=g.medsup;
    return ouvreMenu([[{label:"Ce fichier sera retiré de l'acte, et effacé de cet appareil."},
                       {txt:"Retirer", rouge:true, attr:'data-act="medSup"'}],
                      [{txt:"Annuler", attr:'data-act="fermeMenu"'}]]);
  }
  if(g.node){ fermeMenu(); empile(); S.nodeId=g.node; S.view="node"; return render(); }
  if(g.lierview){ empile(); S.nodeId=g.lierview; S.view="lier"; return render(); }
  if(g.chemin){ empile(); S.cheminId=g.chemin; S.view="chemin"; return render(); }
  if(g.faits){ empile(); S.faits=+g.faits; S.view="faits"; return render(); }
  if(g.ctype){ S.cTxt=((document.getElementById("cNeuf")||{}).value)||S.cTxt; S.cType=g.ctype; return render(); }
  if(g.attach){
    fermeMenu(); S.nodeId=g.attach;
    S.draft=neuf("moi"); S.draft.fige=true; S.draft.par=[g.attach];
    S.step=0; empile(); S.view="note"; return render();
  }
  if(g.vue){ S.vue=g.vue; return render(); }
  if(g.per){
    fermeMenu();
    /* Changer de grain garde la date qu'on regardait — passer de « octobre »
       à « Semaine » reste en octobre — sauf si le nouveau grain contient
       déjà le présent. */
    S.per=g.per;
    if(S.anc!==null && (g.per==="tout" || bornes(g.per,S.anc)[0]===bornes(g.per,Date.now())[0])) S.anc=null;
    return render(); }
  if(g.fdec){
    const fd=fenetre(), t=decale(S.per, fd.t0, +g.fdec);
    S.anc = (t===bornes(S.per, Date.now())[0]) ? null : t;
    return render(); }
  if(g.plus!==undefined){ const e=document.getElementById("tQ"); if(e) S.tQ=e.value; S.enPlus=(g.plus==="1"); return render(); }
  if(g.vif!==undefined){ const e=document.getElementById("tQ"); if(e) S.tQ=e.value; S.vifPrend=(g.vif==="1"); return render(); }
  if(g.tcat){ const e=document.getElementById("tQ"); if(e) S.tQ=e.value; S.tCat=g.tcat; return render(); }
  if(g.creux){
    const p=g.creux.split("|");
    S.blocId=null; S.trou={deb:+p[0], fin:+p[1]};
    empile(); S.view="pointer"; return render();
  }
  if(g.friz!==undefined){ S.frisZ=+g.friz; return render(); }
  if(g.stop){
    const b=blocT(g.stop); if(!b) return;
    const n=tacheNom(b.t);
    arreteUn(b); toast("Arrêté : "+n);
    apresArret([b]); return render();
  }
  /* Une ligne d'« activité par activité » ne menait nulle part : elle est
     maintenant la porte de l'activité elle-même, et de ce qu'on y note. */
  if(g.tch){ empile(); S.tchId=g.tch; S.view="tache"; return render(); }
  /* La pastille remplit le champ sans redessiner : un redessin perdrait le
     titre qu'on vient de taper juste au-dessus. */
  if(g.aut!==undefined){
    const e=document.getElementById(g.pour||"lvAuteur");
    if(e){ e.value=auteurNom(g.aut); e.dispatchEvent(new Event("change",{bubbles:true})); }
    return;
  }
  if(g.mes!==undefined){
    const t=tache(S.tchId); if(!t) return;
    if(g.mes==="0") t.m=0; else delete t.m;
    touche(t); save(); toast("Noté."); return render();
  }
  if(g.pgl){ S.pgL=g.pgl; S.pgA=null; S.pgZ=null; return render(); }
  if(g.lv){ empile(); S.lvId=g.lv; S.view="livre"; return render(); }
  if(g.au){ empile(); S.auId=g.au; S.view="auteur"; return render(); }
  if(g.prd){ empile(); S.perId=g.prd; S.view="periode"; return render(); }
  if(g.vbloc){ if(!blocT(g.vbloc)) return; empile(); S.blocId=g.vbloc; S.view="bloc"; return render(); }
  if(g.pdt){ if(S.draft) S.draft.pdt = (S.draft.pdt===g.pdt) ? null : g.pdt; return render(); }
  /* Depuis un bloc ou une période : noter ce qu'Il y a fait, le lien déjà posé. C'est le chemin réel — on est dans la vidéo, Il parle. */
  if(g.pdtneuf){
    S.draft=neuf(null); S.draft.pdt=g.pdtneuf;
    S.step=0; empile(); S.view="note"; return render();
  }
  if(g.pgsup!==undefined){
    const b=blocT(S.blocId); if(!b || !b.pg) return;
    const r=b.pg[+g.pgsup]; if(!r) return;
    b.pg.splice(+g.pgsup, 1);
    if(!b.pg.length) delete b.pg;
    touche(b); save(); toast("Retiré : "+nomPassagePg(r)); return render();
  }
  if(g.lusup!==undefined){
    const b=blocT(S.blocId); if(!b || !b.lu) return;
    const r=b.lu[+g.lusup]; if(!r) return;
    b.lu.splice(+g.lusup, 1);
    if(!b.lu.length) delete b.lu;
    touche(b); save(); toast("Retiré : "+nomPassage(r)); return render();
  }
  if(g.tache) return poseTache(g.tache);
  if(g.sugg){ return poseTache(tacheId(g.sugg, g.cat)); }
  if(g.bloc){
    S.blocId=g.bloc; const b=blocT(g.bloc); if(!b) return;
    ouvreMenu([[{label:tacheNom(b.t)+" · "+hmin(new Date(b.deb))+" → "+(b.fin?hmin(new Date(b.fin)):"maintenant")}],
      [{txt: b.note ? "Relire ou compléter la note" : "Dire ce qui s'y est passé",
        attr:'data-act="direBloc"'},
       {txt:"C'était autre chose", attr:'data-act="corrBloc"'},
       {txt:"Corriger les heures", attr:'data-act="heuresBloc"'}]
        .concat(spTache(b.t)==="bible" ? [{txt:(b.lu&&b.lu.length) ? "Corriger les chapitres lus"
                                                                   : "Dire les chapitres lus",
                                            attr:'data-act="direLu"'}] : [])
        .concat(spTache(b.t)==="livre" ? [{txt:(b.pg&&b.pg.length) ? "Corriger les pages lues"
                                                                   : "Dire les pages lues",
                                            attr:'data-act="direPg"'}] : [])
        .concat(spTache(b.t)==="sujets" ? [{txt:(b.sj&&b.sj.length) ? "Corriger ce que tu as nommé"
                                                                     : "Dire ce que tu as nommé",
                                            attr:'data-act="direSj"'}] : [])
        .concat(spTache(b.t)==="gens" ? [{txt:(b.qui&&b.qui.length) ? "Corriger à qui tu as annoncé"
                                                                    : "Dire à qui tu as annoncé",
                                          attr:'data-act="direQui"'}] : [])
        .concat(chevauche(b) ? [{txt: b.porte ? "Rendre l'heure à ce qui tournait déjà"
                                               : "C'est ça qui portait l'heure",
                                  attr:'data-act="porteBloc"'}] : [])
        .concat(b.fin ? [] : [{txt:"Arrêter ça seulement", attr:'data-act="stopBloc"'}])
        .concat([{txt:"Effacer ce bloc", rouge:true, attr:'data-act="delBloc"'}]),
      [{txt:"Annuler", attr:'data-act="fermeMenu"'}]]);
    return;
  }
  if(g.filtre){ S.filtre=g.filtre; return render(); }
  if(g.fret){ S.ret=g.fret; return render(); }
  if(g.grain){ S.grain=g.grain; return render(); }
  if(g.rev){ S.rev=g.rev; return render(); }
  if(g.qui){
    const a=S.draft||{}, prevu=(g.qui==="moiPrevu");
    S.draft=neuf(prevu?"moi":g.qui);
    S.draft.etat = prevu ? "prevu" : "fait";
    /* Changer d'acteur refait le brouillon : la circonstance doit traverser,
       sinon le lien posé depuis un bloc se perd au premier choix (13.cx). */
    S.draft.par=(a.par||[]).slice(); S.draft.fige=!!a.fige; S.draft.pdt=a.pdt||null;
    S.step=1; return render();
  }
  if(g.dest){ S.draft.dest=g.dest; S.step++; return render(); }
  if(g.gens){ S.draft[g.champ]=g.gens; S.step++; return render(); }
  if(g.sug){ const e=document.getElementById("nTxt"); if(e){ e.value=g.sug; e.dispatchEvent(new Event("input",{bubbles:true})); e.focus(); } return; }
  if(g.man){ S.draft.man=(S.draft.man===g.man?"":g.man); return render(); }
  if(g.eman){ S.eMan=(S.eMan===g.eman?"":g.eman); return render(); }
  if(g.etat){ if(S.view==="edit") S.eEtat=g.etat; else if(S.draft) S.draft.etat=g.etat; return render(); }
  if(g.netat){ const n=node(S.nodeId);
    if(n && (n.etat||"fait")!==g.netat){ n.etat=g.netat; touche(n); save(); toast(cap(ETAT[g.netat])+"."); }
    return render(); }
  if(g.prec){
    const el=document.getElementById(g.prec), v=el&&el.value;
    if(S.view==="edit"){ S.ePrec=(S.ePrec==="m")?"j":"m"; if(v){ const n=node(S.nodeId); if(n) n.date=v; } }
    else if(S.draft){ if(v) S.draft.date=v; S.draft.prec=(S.draft.prec==="m")?"j":"m"; }
    return render();
  }
  if(g.par){
    if(S.view==="lier"){ const n=node(S.nodeId); if(!n) return; n.par=n.par||[];
      const i=n.par.indexOf(g.par); i===-1?n.par.push(g.par):n.par.splice(i,1); touche(n); save(); }
    else if(S.draft){ const i=S.draft.par.indexOf(g.par); i===-1?S.draft.par.push(g.par):S.draft.par.splice(i,1); }
    return render();
  }
  /* Le même geste que pour une cause gardée — il ne va pas dans la même
     liste, parce qu'un sujet n'est pas un acte (13.dg). */
  if(g.sujp){
    if(S.view==="lier"){ const n=node(S.nodeId); if(!n) return; n.suj=n.suj||[];
      const i=n.suj.indexOf(g.sujp); i===-1?n.suj.push(g.sujp):n.suj.splice(i,1); touche(n); save(); }
    else if(S.draft){ S.draft.suj=S.draft.suj||[];
      const i=S.draft.suj.indexOf(g.sujp); i===-1?S.draft.suj.push(g.sujp):S.draft.suj.splice(i,1); }
    return render();
  }
  if(g.fait){ fermeMenu(); const n=node(g.fait); if(n){ n.etat="fait"; n.prevuLe=n.date; n.date=today(); n.prec="j"; touche(n); save(); toast("Fait."); } return render(); }
  if(g.abandon){ fermeMenu(); const n=node(g.abandon); if(n){ n.etat="abandon"; touche(n); save(); toast("Noté."); } return render(); }
  if(g.act) return actions[g.act] && actions[g.act](t);
}

/* Choisir une activité, c'est soit dire à quoi je suis maintenant, soit
   rendre à un bloc passé son vrai nom. Le même geste, deux destinations. */
function poseTache(id){
  if(!id) return;
  /* On ne crée le bloc qu'ici, quand il reçoit enfin un nom : un bloc sans
     activité, posé d'avance, resterait dans l'archive si on repartait sans
     choisir. Et on range par heure de départ, pour que le bloc en cours —
     s'il y en a un — reste le dernier, ce dont tout le compte dépend. */
  /* Un trou en attente ne doit pas détourner une correction de bloc :
     corriger, c'est désigner un bloc, et le bloc désigné passe devant. */
  if(S.trou && !S.blocId){
    const t=S.trou; S.trou=null;
    const b={id:uid("b"), t:id, deb:t.deb, maj:Date.now()};
    if(!t.vif) b.fin=t.fin;
    db.temps.push(b);
    db.temps.sort(function(a,b){ return a.deb-b.deb; });
    save();
    if(t.vif){ S.pile=[]; S.view="today"; toast("On compte : "+tacheNom(id)+", depuis "+hmin(new Date(t.deb))); return render(); }
    toast("Comblé : "+tacheNom(id)); depile("temps"); return render();
  }
  if(S.blocId){
    const b=blocT(S.blocId);
    if(b){ b.t=id; touche(b); save(); toast("Corrigé."); }
    S.blocId=null; depile("temps"); return render();
  }
  /* Toucher une activité qui tourne déjà, c'est l'arrêter — elle seule.
     C'est la seule lecture possible d'une tape sur une ligne cochée, et
     c'est ce qui permet de fermer une mission sans fermer l'autre. */
  const dejaLa=ouverts().filter(function(b){ return b.t===id; })[0];
  if(dejaLa){
    arreteUn(dejaLa); S.pile=[]; S.view="today";
    toast("Arrêté : "+tacheNom(id));
    apresArret([dejaLa]); return render();
  }
  const enPlus=!!S.enPlus;
  /* L'interrupteur ne vaut que pour le geste qu'on vient de faire : laissé
     en place, il reprendrait un creux qu'on n'a pas regardé (13.db). */
  const vif=S.vifPrend ? creuxVif() : null;
  S.vifPrend=false;
  const chg=pointe(id, enPlus, vif && vif.deb);
  save(); S.pile=[]; S.view="today";
  const dep = vif ? ", depuis "+hmin(new Date(vif.deb)) : "";
  toast(chg ? (enPlus ? "En plus : "+tacheNom(id)+dep : "On compte : "+tacheNom(id)+dep) : "C'était déjà ça.");
  render();
}
function valDate(id, repli){ const e=document.getElementById(id); return (e&&e.value)?e.value:(repli||today()); }
/* La proposition se met à jour pendant la frappe, sans redessiner l'écran :
   un curseur qui saute au milieu d'une phrase est pire que pas de proposition. */
function majRef(){
  const b=document.getElementById("ref"); if(!b) return;
  const r=S.draft ? reference(S.draft.txt) : "";
  b.hidden = !r;
  const e=b.querySelector(".q"); if(e && r) e.textContent=r;
}
function saveTxt(){
  const e=document.getElementById("nTxt"); if(e&&S.draft) S.draft.txt=e.value;
  const d=document.getElementById("nDesc"); if(d&&S.draft) S.draft.desc=d.value;
}

const actions={
  /* Une sonde qu'on ne peut ni arrêter ni effacer n'est pas une sonde :
     c'est une surveillance. Les deux portes sont sur l'écran même qui
     montre ce qu'elle a vu (13.dn). */
  soBascule(){ toast(soBascule() ? "On mesure." : "Arrêté."); render(); },
  soVider(){ soVide(); toast("Effacé — ton journal n'a pas bougé."); render(); },
  menu(){ if(S.view==="node") menuNode(); },
  fermeMenu(){ fermeMenu(); },
  demo(){ seed(); save(); toast("Exemple chargé"); render(); },
  suite(){
    const d=S.draft, et=etapes(d), cle=et[S.step];
    if(cle==="txt"){ saveTxt(); if(!d.txt.trim()) return toast("Écris ou dicte quelque chose"); }
    S.step++; render();
  },
  suiteDate(){ const v=valDate("nDate", S.draft&&S.draft.date); if(v && S.draft) S.draft.date=v; S.step++; render(); },
  addGens(t){
    const ch=(t&&t.dataset.champ)||"gid";
    const id=gensId((document.getElementById("newGens")||{}).value);
    if(!id) return toast("Écris un nom");
    S.draft[ch]=id; save(); S.step++; render();
  },
  plier(){ S.plie=!S.plie; render(); },
  neufTache(){
    const e=document.getElementById("tQ");
    const v=((e&&e.value)||S.tQ||"").trim();
    if(!v) return toast("Écris le nom de l'activité");
    if(!S.tCat) return toast("Dis dans quoi la ranger");
    poseTache(tacheId(v, S.tCat));
  },
  corrBloc(){ fermeMenu(); empile(); S.view="pointer"; render(); },
  heuresBloc(){ fermeMenu(); empile(); S.view="bloc"; render(); },
  /* Le même écran, mais le curseur déjà dans la note : la porte manquait,
     et « Corriger les heures » ne disait à personne qu'on pouvait écrire. */
  direBloc(){ fermeMenu(); empile(); S.view="bloc"; S.noteFocus=true; render(); },
  livreGo(){
    const id=tacheLivre(); if(!id) return;
    pointe(id, false); S.pile=[]; S.view="today";
    toast("On compte : "+tacheNom(id)); render();
  },
  livreStop(){
    const id=tacheLivre();
    const b=ouverts().filter(function(x){ return x.t===id; })[0];
    if(!b) return render();
    arreteUn(b); S.pile=[]; S.view="today";
    toast("Arrêté : "+tacheNom(id));
    apresArret([b]); render();
  },
  bibleGo(){
    const id=tacheBible() || tacheId("Lecture de la Parole", "dieu", "parole");
    pointe(id, false); S.pile=[]; S.view="today";
    toast("On compte : "+tacheNom(id)); render();
  },
  bibleStop(){
    const id=tacheBible();
    const b=ouverts().filter(function(x){ return x.t===id; })[0];
    if(!b) return render();
    arreteUn(b); S.pile=[]; S.view="today";
    toast("Arrêté : "+tacheNom(id));
    apresArret([b]); render();
  },
  direLu(){ fermeMenu(); empile(); S.lu=null; S.luA=null; S.luZ=null; S.luPlein=false;
    S.view="lecture"; render(); },
  direPg(){ fermeMenu(); empile(); S.pgL=null; S.pgA=null; S.pgZ=null;
    S.view="pages"; render(); },
  direSj(){ fermeMenu(); empile(); S.sjQ=""; S.view="sujets"; render(); },
  direQui(){ fermeMenu(); empile(); S.gQ=""; S.view="annonce"; render(); },
  /* Un sujet qu'on ne peut pas corriger n'est pas une fiche (13.ct). Mais on
     ne réunit rien à sa place : si le texte est déjà celui d'un autre sujet,
     on le dit et on s'arrête là. */
  sjGarder(){
    const s=sujet(S.sujId); if(!s) return;
    const v=String(val("sjTxt")||"").trim().replace(/\s+/g," ");
    if(!v) return toast("Un sujet ne peut pas être vide");
    if(v===s.txt) return;
    const k=v.toLowerCase();
    if((db.sujets||[]).some(function(x){
        return x.id!==s.id && String(x.txt).trim().toLowerCase()===k; }))
      return toast("Un autre sujet porte déjà ce texte");
    s.txt=v; touche(s); save(); toast("Noté."); render();
  },
  qAdd(){
    const b=blocT(S.blocId); if(!b) return;
    const e=document.getElementById("gQ");
    const v=((e&&e.value)||S.gQ||"").trim();
    if(!v) return;
    const id=gensId(v); if(!id) return;
    b.qui=(b.qui||[]);
    if(b.qui.indexOf(id)<0) b.qui.push(id);
    touche(b); S.gQ=""; save(); render();
  },
  /* Une foule ne se nomme pas, et le fait ne dépend pas du nom : la ligne
     entre sans lui (13.df). */
  qAnon(){
    const b=blocT(S.blocId); if(!b) return;
    b.qui=(b.qui||[]); b.qui.push("");
    touche(b); save(); render();
  },
  /* On garde ce qui est écrit, pas ce qui est choisi : le champ sert à la
     fois à chercher et à nommer, et ce qu'il contient au moment du geste est
     ce que le disciple vient de dire. */
  sjAdd(){
    const b=blocT(S.blocId); if(!b) return;
    const e=document.getElementById("sjQ");
    const v=((e&&e.value)||S.sjQ||"").trim();
    if(!v) return;
    const id=sujetId(v); if(!id) return;
    b.sj=(b.sj||[]);
    if(b.sj.indexOf(id)<0) b.sj.push(id);
    touche(b); S.sjQ=""; save(); render();
  },
  livreNeuf(){ empile(); S.lvId=null; S.view="livre"; render(); },
  livreFin(){
    const l=livre(S.lvId); if(!l) return;
    if(l.fini) delete l.fini; else l.fini=1;
    touche(l); save(); toast(l.fini ? "Fini." : "Remis en cours."); render();
  },
  auGarder(){
    const a=auteur(S.auId); if(!a) return;
    const nom=String(val("auNom")||"").trim();
    if(!nom) return toast("Écris son nom");
    const autre=(db.auteurs||[]).filter(function(x){
      return x.id!==a.id && x.nom.toLowerCase()===nom.toLowerCase(); })[0];
    if(autre) return toast("« "+autre.nom+" » existe déjà — réunis les deux fiches");
    a.nom=capNom(nom); touche(a); save();
    toast("Gardé."); depile("temps"); render();
  },
  /* Les blocs changent d'activité AVANT que la fiche meure : la réunion de
     deux archives écarte tout bloc dont l'activité a disparu, et l'ordre
     inverse perdrait les heures au premier échange (13.ct, 13.be). */
  tchReunir(){
    const t=tache(S.tchId), vers=tache(val("tFus"));
    if(!t) return;
    if(!vers) return toast("Choisis l'autre activité");
    if(vers.id===t.id) return;
    (db.temps||[]).forEach(function(b){ if(b.t===t.id){ b.t=vers.id; touche(b); } });
    db.taches=(db.taches||[]).filter(function(x){ return x.id!==t.id; });
    tue(t.id); save();
    toast("Réunies sous « "+vers.nom+" »");
    S.tchId=vers.id; render();
  },
  auReunir(){
    const a=auteur(S.auId), vers=auteur(val("auFus"));
    if(!a) return;
    if(!vers) return toast("Choisis l'autre fiche");
    (db.livres||[]).forEach(function(l){ if(l.a===a.id){ l.a=vers.id; touche(l); } });
    (db.taches||[]).forEach(function(t){ if(t.au===a.id){ t.au=vers.id; touche(t); } });
    db.auteurs=(db.auteurs||[]).filter(function(x){ return x.id!==a.id; });
    tue(a.id); save();
    toast("Réunis sous « "+vers.nom+" »");
    S.auId=vers.id; render();
  },
  livreGarder(){
    const nom=String(val("lvNom")||"").trim();
    const pg=parseInt(val("lvPages"), 10);
    if(!nom) return toast("Écris le titre du livre");
    if(!(pg>0)) return toast("Dis combien il a de pages");
    const au=auteurId(val("lvAuteur"));
    if(S.lvId){
      const l=livre(S.lvId);
      if(l){ l.nom=cap(nom); l.pages=pg; l.a=au; touche(l); save(); }
      toast("Gardé."); depile("temps"); return render();
    }
    const id=livreId(nom, pg, au); save();
    S.pgL=id; S.pgA=null; S.pgZ=null;
    toast("Ajouté : "+livreNom(id));
    depile("pages"); render();
  },
  addPg(){
    const b=blocT(S.blocId);
    if(!b || !S.pgL || S.pgA===null) return;
    const a=S.pgA, z=Math.max(a, S.pgZ);
    b.pg=(b.pg||[]).concat([[S.pgL, a, z]]);
    touche(b); save();
    toast(nomPassagePg([S.pgL,a,z])+" · "+pagesTxt(z-a+1));
    depile("temps"); render();
  },
  /* Le cas rare s'atteint depuis le cas courant, jamais l'inverse. */
  luPlein(){ S.luPlein=true; S.lu=null; render(); },
  addLuSimple(){
    const b=blocT(S.blocId);
    if(!b || S.luA===null) return;
    const ps=passagesDe(S.luA, Math.max(S.luA, S.luZ));
    b.lu=(b.lu||[]).concat(ps);
    touche(b); save();
    toast(ps.map(nomPassage).join(" · ")+" · "+chapitresTxt(Math.max(S.luA,S.luZ)-S.luA+1));
    depile("temps"); render();
  },
  addLu(){
    const b=blocT(S.blocId), l=S.lu;
    if(!b || !l) return;
    const r=[l.li, Math.min(l.d, l.f), Math.max(l.d, l.f)];
    b.lu=(b.lu||[]).concat([r]);
    touche(b); save();
    toast(nomPassage(r)+" · "+chapitresTxt(nbLu(r)));
    S.lu=apresLu(r);
    render();
  },
  bCours(){
    const b=blocT(S.blocId); if(!b) return;
    /* Le début déjà tapé ne doit pas se perdre en basculant la fin. */
    const d=valHeure("bDeb", b.deb);
    if(d!==null && d<=Date.now()) b.deb=d;
    noteBloc(b);
    /* Rouvrir un bloc était refusé dès qu'un autre avait commencé après
       lui : il n'y avait qu'une file, et la rouvrir l'aurait fait mordre
       sur son suivant. Depuis qu'on mène plusieurs choses de front, mordre
       n'est plus une faute — c'est le cas même qu'on voulait servir. On a
       prié en se lavant, la toilette est finie, la prière continue : il
       faut pouvoir le dire. */
    if(b.fin){
      delete b.fin;
    } else {
      /* Le même plancher d'une seconde qu'à l'arrêt : forcer la minute ici
         gonflerait un bloc de trente secondes au moment même où l'on vient
         de dire qu'il avait duré trente secondes. */
      b.fin=Math.max(Date.now(), b.deb+1000);
    }
    touche(b); save(); render();
  },
  delBlocIci(){
    const id=S.blocId;
    db.temps=(db.temps||[]).filter(function(x){ return x.id!==id; });
    tue(id); S.blocId=null; save(); toast("Effacé.");
    depile("temps"); render();
  },
  majBloc(){
    const b=blocT(S.blocId); if(!b) return;
    const d=valHeure("bDeb", b.deb), f=b.fin ? valHeure("bFin", b.fin) : null;
    if(d===null) return toast("Pose une heure de début");
    if(b.fin && f===null) return toast("Pose une heure de fin");
    if(f!==null && f<=d) return toast("La fin doit venir après le début");
    if(d>Date.now()) return toast("Ce début n'est pas encore arrivé");
    /* Corriger un bloc ne corrige que ce bloc (13.cv). On a longtemps
       entraîné le voisin collé, pour que la journée reste sans trou ; mais
       raccourcir une prière rallongeait d'autant la lecture d'avant, et
       inscrivait à l'archive des minutes que personne n'avait données. Le
       creux, lui, existe et se montre pour ce qu'il est. */
    b.deb=d; if(f===null) delete b.fin; else b.fin=f;
    noteBloc(b);
    touche(b);
    const avant=(db.temps||[]).map(function(x){ return x.id; });
    db.temps=fusionTemps(db.temps);
    const reste={}; db.temps.forEach(function(x){ reste[x.id]=1; });
    avant.forEach(function(id){ if(!reste[id]) tue(id); });
    save(); toast("Gardé.");
    depile("temps"); render();
  },
  stopBloc(){ fermeMenu(); const b=blocT(S.blocId); arreteUn(b); S.blocId=null; toast("Arrêté.");
    if(b) apresArret([b], "temps"); render(); },
  /* Les deux heures sont proposées, pas devinées : s'il y a un vide entre le
     début de la fenêtre et le premier bloc, c'est très probablement celui-là
     qu'on vient combler — la nuit qu'on a passée debout. */
  perNeuve(){ empile(); S.view="perNeuf"; render(); },
  perCommencer(){
    const d=valHeure("pdDeb");
    const quoi=(document.getElementById("pdDisc")||{}).value||"";
    if(!quoi) return toast("Choisis la routine");
    if(d===null) return toast("Pose une heure de début");
    if(d>Date.now()) return toast("Ce début n'est pas encore arrivé");
    const id=uid("p");
    db.periodes=(db.periodes||[]).concat([{id:id, d:quoi, deb:d, maj:Date.now()}]);
    db.periodes.sort(function(a,b){ return a.deb-b.deb; });
    save(); toast("Commencé : "+discNom(quoi));
    depile("temps"); empile(); S.perId=id; S.view="periode"; render();
  },
  /* Personne ne referme un temps mis à part à la place du disciple : la ligne
     se touche, elle ne se déclenche pas toute seule (13.cf). */
  perCours(){
    const pr=periode(S.perId); if(!pr) return;
    notePer(pr);
    if(perOuverte(pr)) pr.fin=Math.max(Date.now(), pr.deb+60000);
    else delete pr.fin;
    touche(pr); save(); render();
  },
  perGarder(){
    const pr=periode(S.perId); if(!pr) return;
    const d=valHeure("pdDeb", pr.deb);
    const f=perOuverte(pr) ? null : valHeure("pdFin", pr.fin);
    if(d===null) return toast("Pose une heure de début");
    if(!perOuverte(pr) && f===null) return toast("Pose une heure de fin");
    if(f!==null && f<=d) return toast("La fin doit venir après le début");
    if(d>Date.now()) return toast("Ce début n'est pas encore arrivé");
    pr.deb=d; if(f!==null) pr.fin=f;
    notePer(pr); touche(pr); save();
    toast("Gardé."); depile("temps"); render();
  },
  chCopie(){
    try{ navigator.clipboard.writeText(CONSIGNE).then(
      function(){ toast("Copié — colle-le à Claude avec ton relevé."); },
      function(){ toast("Sélectionne le texte et copie-le"); }); }
    catch(x){ toast("Sélectionne le texte et copie-le"); }
  },
  chLire(){
    const e=document.getElementById("chTxt");
    S.chTxt = e ? e.value : "";
    if(!String(S.chTxt).trim()) return toast("Colle d'abord ce que Claude t'a rendu");
    S.ch = chLis(S.chTxt);
    if(!S.ch.ok.length && !S.ch.deja.length && !S.ch.ko.length){
      S.ch=null; return toast("Aucune ligne de mouvement là-dedans");
    }
    render();
  },
  chRetour(){ S.ch=null; render(); },
  chAjoute(){
    const r=S.ch; if(!r || !r.ok.length) return;
    const n=r.ok.length;
    db.sous=(db.sous||[]).concat(r.ok.map(function(x){
      return {id:uid("mv"), t:x.t, m:x.m, p:x.p, q:x.q, maj:Date.now()};
    }));
    db.sous.sort(function(a,b){ return a.t-b.t; });
    save();
    S.ch=null; S.chTxt="";
    toast(n>1 ? n+" mouvements ajoutés." : "Ajouté.");
    depile("argent"); render();
  },
  souNeuf(){ empile(); S.sd={id:null, t:minuit(0), p:"", q:"", mTxt:""}; S.view="sou"; render(); },
  souGarder(){
    souLit();
    const d=S.sd; if(!d) return;
    const m=montantLu(d.mTxt);
    /* Un mouvement de zéro n'a rien bougé : il ne pèserait dans aucune part
       et encombrerait le registre d'une ligne qui ne dit rien. */
    if(!m) return toast("Combien ?");
    if(!d.p) return toast("Dis d'où ça vient, ou où ça va");
    if(d.t>minuit(0)) return toast("Ce jour n'est pas encore arrivé");
    /* Le signe ne se garde pas : c'est le poste qui dit le sens (13.cn). Un
       montant recopié d'un relevé arrive souvent négatif — on le prend tel
       quel et on n'en retient que la somme. */
    const v=Math.abs(m), q=String(d.q||"").trim();
    if(d.id){
      const x=sou(d.id); if(!x) return;
      x.t=d.t; x.m=v; x.p=d.p; x.q=q; touche(x);
    } else {
      db.sous=(db.sous||[]).concat([{id:uid("mv"), t:d.t, m:v, p:d.p, q:q, maj:Date.now()}]);
    }
    db.sous.sort(function(a,b){ return a.t-b.t; });
    save(); S.sd=null; toast("Noté."); depile("argent"); render();
  },
  souEffacer(){
    const d=S.sd; if(!d || !d.id) return;
    db.sous=(db.sous||[]).filter(function(x){ return x.id!==d.id; });
    tue(d.id); S.sd=null; save(); toast("Effacé.");
    depile("argent"); render();
  },
  perEffacer(){
    const id=S.perId;
    db.periodes=(db.periodes||[]).filter(function(x){ return x.id!==id; });
    tue(id); S.perId=null; save(); toast("Effacé.");
    depile("temps"); render();
  },
  fenIci(){ fermeMenu(); S.anc=null; render(); },
  /* Le grain et le retour au présent tiennent dans la même feuille : ils
     répondent tous deux à la question « quelle portion ? ». */
  fenGrain(){
    const f=fenetre();
    const grains=PERIODES.map(function(x){
      return {txt: x[1] + (S.per===x[0] ? "   \u2713" : ""), attr:'data-per="'+x[0]+'"'};
    });
    const g=[[{label:"La portion qu'on regarde"}].concat(grains)];
    if(!f.ici) g.push([{txt:retourTxt(S.per), attr:'data-act="fenIci"'}]);
    g.push([{txt:"Annuler", attr:'data-act="fermeMenu"'}]);
    ouvreMenu(g);
  },
  ajoutTemps(){
    const f=fenetre(), n=Date.now();
    const bs=(db.temps||[]).filter(function(b){ return (b.fin||n)>f.t0 && b.deb<f.t1; });
    /* Une heure proposée dans la fenêtre qu'on regarde : sur une journée
       passée, « il y a une heure » ne tombe pas dedans. */
    let deb=n-3600000, fin=n;
    if(f.t1<n){ deb=f.t0; fin=Math.min(f.t0+3600000, f.t1); }
    if(bs.length){
      const prem=Math.min.apply(null, bs.map(function(b){ return b.deb; }));
      if(prem-f.t0 >= 600000){ deb=f.t0; fin=prem; }
    }
    S.quand={deb:deb, fin:fin}; empile(); S.view="quand"; render();
  },
  comblerDer(){
    const f=fenetre(), cx=creuxDe(f.t0, Math.min(f.t1, Date.now()), SEUIL_CREUX);
    if(!cx.length) return toast("Tout est compté");
    const v=cx[cx.length-1];
    S.blocId=null; S.trou={deb:v[0], fin:v[1]};
    empile(); S.view="pointer"; render();
  },
  poseQuand(){
    const q=S.quand||{};
    const d=valHeure("qDeb", q.deb), f=valHeure("qFin", q.fin);
    if(d===null) return toast("Pose une heure de début");
    if(f===null) return toast("Pose une heure de fin");
    if(f<=d) return toast("La fin doit venir après le début");
    if(d>Date.now()) return toast("Ce début n'est pas encore arrivé");
    S.quand=null; S.blocId=null;
    S.trou={deb:d, fin:Math.min(f, Date.now())};
    S.view="pointer"; render();
  },
  /* L'app choisit par défaut celui qui tournait déjà. Elle ne sait pas
     laquelle des deux choses était vraiment l'œuvre : lui, il le sait. */
  porteBloc(){
    fermeMenu();
    const b=blocT(S.blocId); if(!b) return;
    const f=finDe(b), veut=!b.porte;
    if(veut){
      (db.temps||[]).forEach(function(x){
        if(x!==b && x.porte && x.deb<f && finDe(x)>b.deb){ delete x.porte; touche(x); }
      });
      b.porte=1;
    } else delete b.porte;
    touche(b); save(); S.blocId=null;
    toast(veut ? "C'est « "+tacheNom(b.t)+" » qui porte l'heure."
               : "L'heure revient à ce qui tournait déjà.");
    render();
  },
  /* Le rail est le geste habituel pour dire à quoi l'on est. Quand rien ne
     tourne, il montrait le temps non compté et menait au pointage — mais en
     décidant au passage que l'activité choisie commencerait à l'arrêt. Or un
     creux vif ne naît QUE d'un arrêt explicite : on ne peut pas donner à
     quelqu'un un temps que le disciple vient de retirer à tout le monde
     (13.db). Le rail ouvre donc le pointage, et rien de plus ; la reprise se
     choisit là-bas, en clair. */
  comblerVif(){ S.blocId=null; S.trou=null; S.vifPrend=false;
    empile(); S.view="pointer"; render(); },
  arretNet(){ const o=ouvert(); const n=o?tacheNom(o.t):""; const ouv=ouverts().slice();
    arrete(); S.pile=[]; S.view="today";
    toast(n ? "Arrêté. Le temps ne va plus à « "+n+" »." : "Arrêté.");
    apresArret(ouv); render(); },
  delBloc(){
    fermeMenu();
    db.temps=(db.temps||[]).filter(b=>b.id!==S.blocId);
    tue(S.blocId); S.blocId=null; save(); toast("Effacé."); render();
  },
  ouvreDesc(){ saveTxt(); S.descOuvert=true; render(); },
  refDesc(){
    saveTxt();
    const d=S.draft; if(!d) return;
    const r=reference(d.txt); if(!r) return toast("Rien à déplacer");
    const t=d.txt.trim(), i=t.lastIndexOf(r);
    d.txt = (i>0 ? t.slice(0,i) : t).replace(/[\s,.;:–—-]+$/,"").trim();
    d.desc = d.desc && d.desc.trim() ? (d.desc.trim()+"\n"+r) : r;
    S.descOuvert = true;
    toast("Référence déplacée"); render();
  },
  addMan(){
    const e=document.getElementById("newMan");
    const id=manId(e&&e.value);
    if(!id) return toast("Écris la manière");
    if(S.view==="edit") S.eMan=id; else if(S.draft) S.draft.man=id;
    save(); render();
  },
  addNom(){ const v=((document.getElementById("newNom")||{}).value||"").trim(); if(!v) return toast("Écris le nom"); db.noms.push({id:uid("p"),txt:v,nodes:[],maj:Date.now()}); save(); render(); },
  /* La cause n'était pas encore gardée : on la garde ici, et on la lie.
     Elle hérite de la date de l'acte qu'elle précède — à corriger d'un geste
     en l'ouvrant, c'est toujours plus juste qu'aujourd'hui. */
  causeNeuf(){ S.cNeuf=true; S.cTxt=""; S.cType=""; render(); },
  causeListe(){ S.cNeuf=false; S.cTxt=""; S.cType=""; render(); },
  ajoute(){
    const el=document.getElementById("cNeuf");
    const v=((el&&el.value)||S.cTxt||"").trim();
    if(!v) return toast("Écris ou dicte la cause");
    if(!S.cType) return toast("Dis ce que c'est");
    const quoi=S.cType, cible=(S.view==="lier") ? node(S.nodeId) : S.draft;
    const n={id:nid(), act:(quoi==="moi"?"moi":"dieu"), gid:null,
      dest:(quoi==="moi"?"dieu":null), dgid:null, txt:v,
      man:(quoi==="rhema"?"parle":""),
      kind:(quoi==="ecriture"?"ecriture":(quoi==="rhema"?"rhema":"acte")), ref:"",
      date:(cible&&cible.date)||today(), prec:(cible&&cible.prec)||"j",
      etat:"fait", par:[], ts:ts(), maj:Date.now()};
    db.nodes.push(n);
    if(S.view==="lier"){ const c=node(S.nodeId); if(c){ c.par=c.par||[]; c.par.push(n.id); touche(c); } }
    else if(S.draft){ S.draft.par.push(n.id); }
    save(); S.cNeuf=false; S.cTxt=""; S.cType="";
    toast("Ajouté et lié"); render();
  },
  saveNote(){
    const d=S.draft;
    const n={id:nid(),act:d.act,gid:d.gid,dest:d.act==="moi"?d.dest:null,dgid:d.dgid,txt:d.txt.trim(),desc:(d.desc||"").trim(),man:d.man,
      kind:(d.act==="dieu"&&d.man==="parle")?"rhema":"acte",
      date:valDate("nDate", d.date),prec:d.prec||"j",etat:d.act==="moi"?(d.etat||"fait"):"fait",par:d.par.slice(),ts:ts(),maj:Date.now()};
    if((d.suj||[]).length) n.suj=d.suj.slice();
    if(d.pdt && pdtDe(d.pdt)) n.pdt=d.pdt;
    db.nodes.push(n); save();
    /* On repart là où l'acte est désormais rangé : le disciple le voit,
       et l'écran a ses onglets — il n'est jamais enfermé. */
    const onglet = n.act==="moi" ? "actes" : "oeuvres";
    const ou = n.act==="moi" ? "Mes actes" : "Ses œuvres";
    const fige=d.fige;
    S.draft=null; S.step=0;
    if(fige){ S.view="node"; S.nodeId=d.par[0] || n.id; }
    else { S.pile=[]; S.view=onglet; S.nodeId=n.id; }
    toast(fige ? "Rattaché · dans "+ou : "Gardé dans "+ou); render();
  },
  edit(){ fermeMenu(); const n=node(S.nodeId); if(!n) return; S.eMan=n.man||""; S.eEtat=n.etat||"fait"; S.ePrec=n.prec||"j"; empile(); S.view="edit"; render(); },
  saveEdit(){
    const n=node(S.nodeId), e=document.getElementById("eTxt");
    if(n){
      if(e&&e.value.trim()) n.txt=e.value.trim();
      const ed=document.getElementById("eDesc"); if(ed) n.desc=ed.value.trim();
      n.date=valDate("eDate"); n.prec=S.ePrec||"j";
      if(n.act!=="moi"){ n.man=S.eMan; if(n.kind!=="ecriture") n.kind=(n.act==="dieu"&&n.man==="parle")?"rhema":"acte"; }
      else { n.etat=S.eEtat||"fait"; }
      touche(n); save(); toast("Corrigé.");
    }
    depile("node"); render();
  },
  askDel(){
    fermeMenu();
    ouvreMenu([[{label:"Cet acte sera effacé, et ses liens avec."},
                {txt:"Supprimer", rouge:true, attr:'data-act="delNode"'}],
               [{txt:"Annuler", attr:'data-act="fermeMenu"'}]]);
  },
  delNode(){
    fermeMenu();
    const id=S.nodeId;
    db.nodes=db.nodes.filter(n=>n.id!==id);
    db.nodes.forEach(n=>{ if(n.par && n.par.indexOf(id)!==-1){ n.par=n.par.filter(p=>p!==id); touche(n); } });
    db.noms.forEach(nm=>{ if(nm.nodes && nm.nodes.indexOf(id)!==-1){ nm.nodes=nm.nodes.filter(p=>p!==id); touche(nm); } });
    tue(id); save(); depile("today"); toast("Supprimé."); render();
  },
  copy(){ const e=document.getElementById("dump"); e.select(); try{ navigator.clipboard.writeText(e.value).then(()=>toast("Copié"),()=>toast("Sélectionne et copie")); }catch(x){ toast("Sélectionne et copie"); } },
  /* Un fichier de sauvegarde qui laisserait les photos derrière lui ne
     serait pas une sauvegarde : il faut qu'on puisse tout reprendre sur un
     appareil neuf. Elles y entrent donc, transcrites en texte — c'est ce qui
     les rend transportables, et c'est aussi ce qui alourdit le fichier.
     L'écran dit le poids avant qu'on le sorte. */
  fichier(){
    const ids=medTout();
    if(!ids.length) return actions.fichierAvec(null);
    toast("Préparation du fichier…");
    ids.reduce(function(suite, m){
      return suite.then(function(sacs){
        return medPrend(m.id).then(function(b){
          if(!b) return sacs;
          return blobB64(b).then(function(x){ sacs[m.id]={mime:b.type||m.mime||"", b64:x}; return sacs; },
                                 function(){ return sacs; });
        });
      });
    }, Promise.resolve({})).then(function(sacs){ actions.fichierAvec(sacs); },
       function(){ toast("Les fichiers joints n'ont pas pu être relus."); actions.fichierAvec(null); });
  },
  fichierAvec(sacs){
    const txt=JSON.stringify(sacs ? Object.assign({}, db, {med:sacs}) : db),
          nom="eben-ezer-"+today()+".json";
    const fait=()=>{ db.exp=Date.now(); save(); };
    try{
      const f=new File([txt], nom, {type:"application/json"});
      if(navigator.share && navigator.canShare && navigator.canShare({files:[f]})){
        navigator.share({files:[f], title:nom}).then(()=>{ fait(); render(); }, ()=>{});
        return;
      }
    }catch(e){}
    try{
      const u=URL.createObjectURL(new Blob([txt],{type:"application/json"}));
      const a=document.createElement("a");
      a.href=u; a.download=nom; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(u), 5000);
      fait(); toast("Fichier sorti"); render();
    }catch(e){ toast("Copie le texte, plus bas"); }
  },
  ouvreFichier(){ const i=document.getElementById("fin"); if(i) i.click(); },
  medPioche(){
    const g=[{label:"Joindre à cet acte"},
             {txt:"Prendre une photo", attr:'data-act="medCam"'},
             {txt:"Filmer", attr:'data-act="medVid"'}];
    if(peutEnr()) g.push({txt:"Enregistrer un son", attr:'data-act="medSon"'});
    g.push({txt:"Choisir un fichier", attr:'data-act="medFic"'});
    ouvreMenu([g, [{txt:"Annuler", attr:'data-act="fermeMenu"'}]]);
  },
  medCam(){ fermeMenu(); const i=document.getElementById("medCam"); if(i) i.click(); },
  medVid(){ fermeMenu(); const i=document.getElementById("medVid"); if(i) i.click(); },
  medFic(){ fermeMenu(); const i=document.getElementById("medIn"); if(i) i.click(); },
  medSon(){ fermeMenu(); enrOuvre(); },
  enrGarde(){ enrFerme(true); },
  enrJette(){ enrFerme(false); },
  medSup(){
    fermeMenu();
    const id=S.medId, n=node(S.nodeId);
    S.medId=null;
    if(!id || !n) return;
    n.med=(n.med||[]).filter(function(m){ return m.id!==id; });
    touche(n); save(); medEfface(id);
    /* Retirer d'un appareil retire de partout : sinon la pièce resterait
       au dépôt sans plus rien pour la nommer, et personne ne saurait
       qu'elle est là. */
    if(SY.actif) syOctets(pjChemin(id), {method:"DELETE"}).catch(function(){});
    delete PJ.haut[id]; delete PJ.abs[id]; pjSave();
    toast("Retiré."); render();
  },
  copieSql(){ const e=document.getElementById("sql"); if(!e) return; e.select();
    try{ navigator.clipboard.writeText(e.value).then(()=>toast("Copié"),()=>toast("Sélectionne et copie")); }
    catch(x){ toast("Sélectionne et copie"); } },
  syProjet(){
    const u=val("syUrl").trim().replace(/\/+$/,""), c=val("syCle").trim();
    if(!/^https:\/\/[^\s]+$/.test(u)) return toast("Colle l'URL du projet");
    if(c.length<20) return toast("Colle la clé anon");
    if(/service_role/.test(c)) return toast("Pas celle-là : la clé anon");
    SY.url=u; SY.cle=c; sySave(); S.syEtape=1; render();
  },
  /* Une application installée ne se recharge pas d'un geste : sur iPhone, en
     plein écran, il n'y a ni barre d'adresse ni tirer-pour-rafraîchir. Il
     faut donc un bouton, sans quoi la seule issue est de désinstaller. */
  oeil(t){
    const w=t.closest(".oeilleton"), i=w&&w.querySelector("input");
    if(!i) return;
    const cache = i.type==="password";
    const v=i.value;
    i.type = cache ? "text" : "password";
    t.innerHTML = cache ? OEIL_CLOS : OEIL;
    t.setAttribute("aria-label", cache ? "Cacher le mot de passe" : "Montrer le mot de passe");
    try{ i.focus(); i.setSelectionRange(v.length, v.length); }catch(e){}
  },
  async maj(){
    toast("Je regarde…");
    try{
      if("serviceWorker" in navigator){
        const reg=await navigator.serviceWorker.getRegistration();
        if(reg) await reg.update();
      }
    }catch(e){}
    setTimeout(function(){ location.reload(); }, 700);
  },
  syPropre(){ S.syPropre=true; S.syEtape=0; render(); },
  async syEntre(){
    const m=(val("syMail")||"").trim(), p=val("syMdp");
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return toast("Écris ton adresse");
    if(p.length<8) return toast("Au moins huit caractères");
    SY.mail=m; S.syMdp=p; sySave(); toast("…");
    try{
      try{ await syMotDePasse(m, p); }
      catch(e){
        const t=String(e&&e.message||"");
        if(!/Invalid login|invalid_grant/i.test(t)) throw e;
        /* Pas encore de compte sur ce projet : on le crée, puis on entre. */
        await sySignup(m, p);
        await syMotDePasse(m, p);
      }
      const r=await syLit(true);
      if(!r){
        /* Premier appareil : on tire la clé au sort, on tire le code, et on
           met la clé sous les deux enveloppes avant le premier envoi. */
        const dk=alea(32), code=codeNeuf();
        SY.dk=b64(dk);
        SY.envM=await ferme(dk, p);
        SY.envR=await ferme(dk, codeNu(code));
        SY.actif=true; SY.vu=await syEcrit(db); SY.base=db.maj||0; SY.fait=Date.now();
        SY.aVoir=code; sySave();
        S.syCode=code; S.syEtape=2; render();
        return;
      }
      const env=JSON.parse(r.doc);
      if(env.v!==2) throw new Error("format inconnu");
      try{
        /* Le cas ordinaire : le mot de passe ouvre l'enveloppe. */
        SY.dk=b64(await ouvre(env.mdp, p)); sySave();
        await syRejoint(r);
      }catch(x){
        /* Le mot de passe a changé ailleurs depuis. Si cet appareil tient
           déjà la clé, il se répare tout seul et referme l'enveloppe avec le
           mot de passe d'aujourd'hui — rien à demander. */
        if(SY.dk){
          try{
            await dechiffreDoc(env.doc, deb64(SY.dk));
            await syRejoint(r, await ferme(deb64(SY.dk), p));
            return;
          }catch(y){}
        }
        S.syEtape=3; render();
      }
    }catch(e){ toast(syDit(e)); }
  },
  syNote(){ SY.aVoir=""; sySave(); S.syCode=""; S.syMdp=""; S.syEtape=0; S.pile=[]; S.view="reglages";
            toast("Synchronisation en route."); render(); },
  copieCode(){ const c=S.syCode||"";
    try{ navigator.clipboard.writeText(c).then(()=>toast("Copié"),()=>toast("Recopie-le à la main")); }
    catch(x){ toast("Recopie-le à la main"); } },
  async syRecupere(){
    const c=codeNu(val("syRec")), p=S.syMdp||"";
    if(c.length!==20) return toast("Le code fait vingt caractères");
    if(!p) return toast("Reprends depuis le mot de passe");
    toast("…");
    try{
      const r=await syLit(true);
      if(!r) throw new Error("rien");
      const env=JSON.parse(r.doc);
      let dk;
      try{ dk=await ouvre(env.rec, c); }
      catch(x){ return toast("Ce code n'ouvre pas cette archive"); }
      SY.dk=b64(dk); sySave();
      await syRejoint(r, await ferme(dk, p));
      toast("Récupérée. Ce mot de passe l'ouvrira désormais.");
    }catch(e){ toast(syDit(e)); }
  },
  syManuel(){ toast("…"); syMaintenant(true).then(function(){ render(); }); },
  syDetache(){
    ouvreMenu([[{label:"L'archive reste entière sur cet appareil. Il cessera seulement de parler à l'autre."},
                {txt:"Détacher", rouge:true, attr:'data-act="syDetacheOk"'}],
               [{txt:"Annuler", attr:'data-act="fermeMenu"'}]]);
  },
  syDetacheOk(){ fermeMenu(); syOublie(); S.syEtape=0; S.syCode=""; S.syMdp=""; toast("Détaché."); render(); },
  restore(){ try{ const v=JSON.parse(document.getElementById("dump").value); if(!v||!Array.isArray(v.nodes)) throw 0; db=sane(v); save(); toast("Remplacé"); S.view="today"; render(); }catch(e){ toast("Ce texte n'est pas une sauvegarde"); } },
  askWipe(){
    ouvreMenu([[{label:"Tous tes mémoriaux seront effacés. Copie d'abord ta sauvegarde."},
                {txt:"Tout effacer", rouge:true, attr:'data-act="wipe"'}],
               [{txt:"Annuler", attr:'data-act="fermeMenu"'}]]);
  },
  /* Un effacement volontaire ne doit pas voyager : on détache d'abord, sinon
     le vide partirait écraser l'autre appareil. */
  wipe(){ fermeMenu(); syOublie(); db=sane({}); save(true); S.view="today"; toast("Effacé"); render(); }
};

/* ---------- exemple ---------- */
function seed(){
  db={nodes:[],gens:[],noms:[],seq:1};
  const g1=gensId("Frère Thomas"), g2=gensId("Sœur Estelle");
  const y=new Date().getFullYear(), md=today().slice(4);
  const a={id:nid(),act:"dieu",txt:"« Je pourvoirai pour les tiens. »",man:"parle",kind:"rhema",date:(y-5)+"-08-02",prec:"j",etat:"fait",par:[]};
  const b={id:nid(),act:"dieu",txt:"« Ne crains pas pour la maison. Je m'en occupe. »",man:"parle",kind:"rhema",date:(y-3)+md,prec:"j",etat:"fait",par:[a.id]};
  const c={id:nid(),act:"moi",dest:"dieu",txt:"Remercier pour cette parole",man:"",kind:"acte",date:(y-3)+"-11-12",prec:"j",etat:"fait",par:[b.id]};
  const d={id:nid(),act:"gens",gid:g1,txt:"Il a prêté l'argent du loyer, sans que je demande",man:"pourvu",kind:"acte",date:(y-2)+"-03-04",prec:"j",etat:"fait",par:[a.id]};
  const e={id:nid(),act:"dieu",txt:"La maison de Nkolbisson",man:"pourvu",kind:"acte",date:(y-1)+"-09-18",prec:"j",etat:"fait",par:[a.id,b.id,d.id]};
  const f={id:nid(),act:"moi",dest:"gens",dgid:g1,txt:"Le lui dire",man:"",kind:"acte",date:(y-2)+"-03-12",prec:"j",etat:"fait",par:[d.id]};
  const h={id:nid(),act:"moi",dest:"dieu",txt:"Jeûner un jour",man:"",kind:"acte",date:y+"-12-15",prec:"j",etat:"prevu",par:[b.id]};
  const i={id:nid(),act:"moi",dest:"gens",dgid:g2,txt:"Dire à Estelle ce qu'Il a fait",man:"",kind:"acte",date:y+"-11-20",prec:"j",etat:"prevu",par:[e.id]};
  db.nodes.push(a,b,c,d,e,f,h,i);
  db=sane(db);
  db.noms.push({id:"p"+(db.seq++),txt:"« Celui qui pourvoit au dernier moment »",nodes:[d.id,e.id]});
}

/* ---------- démarrage ---------- */
function theme(){
  const noir = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", !!noir);
}
theme();
if(window.matchMedia){ try{ window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", theme); }catch(e){} }
syLoad(); load(); render();
if(SY.actif) setTimeout(function(){ syMaintenant(); }, 1200);
/* On se resynchronise en revenant à l'écran, pas plus d'une fois par minute :
   c'est le moment où l'autre appareil a pu parler. */
document.addEventListener("visibilitychange", function(){
  if(document.hidden || !SY.actif) return;
  if(Date.now()-(SY.fait||0) < 60000) return;
  syMaintenant();
});
addEventListener("online", function(){ if(SY.actif) syMaintenant(); });
/* iOS peut vider le stockage d'un site qu'il juge inactif. On demande une
   fois à ce que celui-ci soit tenu pour durable — c'est tout ce qu'un site
   peut demander, et ça ne remplace pas un fichier gardé ailleurs. */
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
/* Android fige l'orientation au moment de l'installation : la petite
   application fabriquée alors porte « portrait » dans son manifeste, et
   relire la page n'y change rien. Demander à la page de lever le verrou
   suffit parfois à rendre la rotation sans réinstaller ; quand ça ne suffit
   pas, ça ne casse rien, et il reste à retirer puis remettre l'icône. */
try{ if(screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }catch(e){}

/* La mise à jour doit arriver sans qu'on ait à supprimer l'app.
   « updateViaCache: none » empêche le téléphone de servir un vieux sw.js ;
   on redemande une vérification à chaque fois que l'app revient à l'écran ;
   et quand un nouveau service worker prend la main, on recharge une fois. */
if("serviceWorker" in navigator){
  try{
    const avaitUnControleur = !!navigator.serviceWorker.controller;
    let recharge = false;
    navigator.serviceWorker.addEventListener("controllerchange", function(){
      if(!avaitUnControleur || recharge) return;
      recharge = true; location.reload();
    });
    navigator.serviceWorker.register("sw.js", {updateViaCache:"none"}).then(function(reg){
      reg.update();
      document.addEventListener("visibilitychange", function(){
        if(!document.hidden) { try{ reg.update(); }catch(e){} }
      });
    }).catch(function(){});
  }catch(e){}
}
