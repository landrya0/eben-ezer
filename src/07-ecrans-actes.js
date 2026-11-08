/* Ében-Ézer — ecrans-actes
   Les écrans du mémorial, et l'assistant qui note.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- Aujourd'hui ---------- */
const RAMEAU = cls => `<svg class="rameau ${cls}" viewBox="0 0 140 220" aria-hidden="true"><use href="#amandier"/></svg>`;
function phrase(c){
  const n=c.n;
  if(c.type==="prevu")  return "Tu avais prévu ceci pour le "+human(n)+" :";
  if(c.type==="dette")  return "Tu n'as jamais rien rendu pour ceci :";
  if(c.type==="hasard") return "Te souviens-tu de ceci ?";
  return n.act==="gens" ? "Il est passé par "+esc(gensNom(n.gid))+" :"
       : (n.man==="parle" ? "Il t'a dit ceci :" : "Il a fait ceci :");
}
function carte(c){
  const n=c.n;
  return `<a class="carte" data-node="${n.id}">
    <span class="quand">${esc(c.quand)}</span>
    <span class="amorce" style="margin:9px 0 10px">${phrase(c)}</span>
    <span class="grand ${estParole(n)?"voix":""}">${cite(n)}</span>
    <span class="meta">${esc(acteurTxt(n))}${human(n)?" · "+human(n):""}</span>
  </a>`;
}
/* Le rappel de sauvegarde était dans Mes données, et Mes données est passée
   derrière un rouage : un rappel qu'il faut aller chercher ne rappelle rien.
   Il revient donc là où le disciple passe tous les jours — tout en bas, après
   ce qu'il est venu lire, jamais devant.
   Il ne parle pas avant que l'archive pèse quelque chose : réclamer une
   sauvegarde au troisième acte, c'est apprendre à ignorer l'avertissement
   avant qu'il ait servi. Et il ne gronde pas : il dit où en est la copie, et
   ouvre le partage. Ranger reste le geste du disciple (P9). */
/* Le rail n'existe que pendant qu'on compte. Il faut donc, quand rien ne
   compte, une porte pour commencer — et elle disparaît d'elle-même au
   premier pointage, puisque le rail la remplace alors en haut. */
function rappelTemps(){
  if(ouvert()) return "";
  const cj=cumul(minuit(0), Date.now());
  return liste(ligne({titre:"Rien n'est compté",
    sous: cj.tot ? esc(hm(cj.tot))+" comptés aujourd'hui" : "Dire à quoi va ton temps",
    attr:'data-go="pointer"'}), "lien") + `<div style="height:6px"></div>`;
}
/* Un temps mis à part ne se compte pas en heures : il ne passe donc ni dans
   le rail ni dans le compteur, et il n'avait aucune place sur l'écran
   d'ouverture. Résultat : pour dire « ma retraite est finie », il fallait
   descendre dans Mon temps, choisir Les routines, trouver la période, et y
   décocher « c'est toujours en cours » — quatre écrans pour un seul mot.
   Or une retraite, c'est deux jours de la vie du disciple : tant qu'elle
   dure, elle est le cadre de tout le reste, et elle se dit en haut (13.dj). */
function rappelPer(){
  const ps=perOuvertes();
  if(!ps.length) return "";
  return titreBloc("Un temps mis à part")
    + ps.map(function(pr){
        return liste(ligne({titre:esc(discNom(pr.d)),
            sous:esc(dureePer(pr))+", depuis "+esc(quandPer(pr)),
            attr:'data-prd="'+pr.id+'"'})
          + ligne({titre:"C'est fini", sous:"Refermer ce temps mis à part",
            attr:'data-perfin="'+pr.id+'"'}), "lien");
      }).join("")
    + `<div style="height:6px"></div>`;
}
function rappelFichier(){
  const n=db.nodes.length + (db.temps||[]).length;
  if(n<5) return "";
  const vieux = !db.exp || (Date.now()-db.exp) > 30*86400000;
  if(!vieux) return "";
  const quoi = db.exp
    ? "Ton dernier fichier date du "+new Date(db.exp).toLocaleDateString("fr-FR")+"."
    : "Tu n'as encore jamais sorti de fichier.";
  const pourquoi = SY.actif
    ? "La copie distante te suit, mais elle ne t'appartient pas : un fichier à toi, rangé où tu veux, ne dépend de personne."
    : "Tout est sur ce téléphone, et nulle part ailleurs.";
  return titreBloc("Au cas où","ecart")
    + `<div class="block amorce">${quoi} ${pourquoi}</div>`
    + liste(ligne({titre:"Sortir un fichier", sous:"iCloud, Drive, Fichiers — où tu veux",
                   attr:'data-act="fichier"'}), "lien")
    + `<div style="height:18px"></div>`;
}
/* Une fenêtre haute, c'est une tablette debout ou un grand écran. On ne
   redessine qu'au passage d'un côté à l'autre : redessiner à chaque pixel
   d'un redimensionnement ferait sauter la lecture. */
function haute(){ return window.innerHeight >= 900; }
let etaitHaute = false;
try{ etaitHaute = haute(); }catch(e){}
window.addEventListener("resize", function(){
  const h = haute();
  if(h!==etaitHaute){ etaitHaute=h; render(); }
});
function vToday(){
  const now=new Date();
  const d = now.getDate()+" "+MOIS[now.getMonth()];
  if(!db.nodes.length){
    Z.file = true;
    Z.haut = RAMEAU("marque") + `<p class="titre-page">Rien encore.</p><p class="ssTitre">${d}</p>`;
    Z.html = `<div class="block amorce" style="margin-top:20px">Note la première chose : ce qu'Il a fait, ce que tu as fait, ou ce que quelqu'un a fait.</div>
      ${liste(ligne({titre:"Commencer à compter mon temps", attr:'data-go="pointer"'})+
              ligne({titre:"Voir un exemple", attr:'data-act="demo"'}))}`;
    return;
  }
  const cartes=remontees();
  if(!cartes.length){
    Z.file = true;
    Z.haut = RAMEAU("marque") + `<p class="titre-page">Rien ne revient aujourd'hui.</p><p class="ssTitre">${d}</p>`;
    Z.html = `<div class="block amorce" style="margin-top:20px">Tout ce qu'Il a fait a reçu quelque chose de toi. Note la suite quand elle vient.</div>`
      + rappelPer() + rappelTemps() + rappelFichier();
    return;
  }
  /* Quatre derniers gardés remplissent un téléphone et laissent une tablette
     à moitié vide : le haut de l'écran est dense, le bas ne porte rien. Ce
     qu'on montre suit donc la place qu'on a. */
  const recents=db.nodes.slice().sort(parDate).slice(0, haute() ? 9 : 4);
  Z.file = true;
  Z.haut = RAMEAU("marque") + `<p class="titre-page">Ce qui revient</p><p class="ssTitre">${d}</p>`;
  Z.html = `<div class="carr" id="carr" style="margin-top:16px">${cartes.map(carte).join("")}</div>
    ${cartes.length>1 ? `<div class="points" id="points">${cartes.map((c,i)=>`<i${i?"":' class="on"'}></i>`).join("")}</div>` : ""}
    ${rappelPer()}
    ${rappelTemps()}
    ${titreBloc("Derniers gardés")}
    ${liste(recents.map(n=>ligneActe(n,{attr:'data-node="'+n.id+'"'})).join(""))}
    ${rappelFichier()}`;
}

/* ---------- Ses œuvres ---------- */
function vOeuvres(){
  const list=dieuNodes().slice().sort(parDate);
  const fl=["tout"].concat(Object.keys(MANS()));
  /* Deux lectures de la même archive : comment Il a agi, et ce que j'en ai
     fait. La seconde est la plus dure à regarder, c'est pour ça qu'elle doit
     être à portée de pouce. */
  const fr=[["tout","Tout"],["oui","J'ai répondu"],["non","Je n'ai rien rendu"]];
  const fg=[["an","Par année"],["mois","Par mois"],["semaine","Par semaine"]];
  /* Replié, le bandeau dit lui-même ce qu'il cache : sans cela, on filtre
     sans le savoir et on croit l'archive vide. */
  /* Le bandeau ne dit que ce qui s'écarte de l'ordinaire. « Toutes Ses
     manières · par année » décrivait l'état normal de l'écran en six mots :
     un bandeau qui parle quand il n'a rien à dire, on cesse de le lire, et le
     jour où il a quelque chose à dire on ne le lit plus non plus. Rien de
     réglé : « Filtres », et c'est tout. */
  const resume=[
    S.filtre==="tout" ? "" : manCourt(S.filtre),
    S.ret==="oui" ? "j'ai répondu" : (S.ret==="non" ? "rien rendu" : ""),
    S.grain==="an" ? "" : (S.grain==="mois" ? "par mois" : "par semaine")
  ].filter(Boolean).join(" · ");
  /* Un compte qui ne bouge pas quand le filtre retranche fait croire que
     l'archive est plus vide qu'elle n'est — ou plus pleine. */
  const rendu=n=>enfants(n.id).some(e=>e.act==="moi");
  const vus=list
    .filter(n=>S.filtre==="tout" || n.man===S.filtre)
    .filter(n=>S.ret==="tout" || rendu(n)===(S.ret==="oui"));
  const compte = (S.filtre==="tout" && S.ret==="tout")
    ? `${list.length} fois, par Lui-même ou par une main.`
    : `${vus.length} sur ${list.length}, sous ce filtre.`;
  Z.haut=`<p class="titre-page">Ses œuvres</p><p class="ssTitre">${compte}</p>
    <button class="plier" data-act="plier" aria-expanded="${!S.plie}">
      <b>Filtres</b>${resume?`<span class="q">${esc(resume)}</span>`:""}${BAS}</button>`;
  if(!S.plie) Z.haut+=`<div class="ptitre">Sa manière</div>
    <div class="puces">${fl.map(f=>`<button class="puce" data-filtre="${f}" aria-pressed="${S.filtre===f}">${f==="tout"?"Tout":manTxt(f)}</button>`).join("")}</div>
    <div class="ptitre">Mon retour</div>
    <div class="puces suite">${fr.map(([k,l])=>`<button class="puce" data-fret="${k}" aria-pressed="${S.ret===k}">${l}</button>`).join("")}</div>
    <div class="ptitre">Ranger</div>
    <div class="puces suite">${fg.map(([k,l])=>`<button class="puce" data-grain="${k}" aria-pressed="${S.grain===k}">${l}</button>`).join("")}</div>`;
  let h="";
  if(!vus.length) h+=`<p class="vide">Rien sous ce filtre.</p>`;
  let an=null, buf="";
  vus.forEach(n=>{
    const y=tranche(n, S.grain);
    if(y!==an){ if(buf){ h+=liste(buf); buf=""; } h+=titreBloc(esc(y), an===null?"":"ecart"); an=y; }
    buf += ligneActe(n, {attr:'data-node="'+n.id+'"'});
  });
  if(buf) h+=liste(buf);
  Z.html=h;
}

/* ---------- Révélations ---------- */
function vRevel(){
  const o=[["noms","Noms"],["chemins","Chemins"],["gens","Personnes"],["chiffres","Chiffres"]];
  Z.haut=`<p class="titre-page">Révélations</p><p class="ssTitre">Ce que tout cela t'a fait connaître de Lui.</p>
    <div class="puces">${o.map(([k,l])=>`<button class="puce" data-rev="${k}" aria-pressed="${S.rev===k}">${l}</button>`).join("")}</div>`;
  let h="";
  if(S.rev==="noms"){
    if(!db.noms.length) h+=`<p class="vide">Aucun nom encore. Ils viennent en relisant.</p>`;
    else h+=liste(db.noms.slice().reverse().map(nm=>ligne({titre:esc(nm.txt), serif:true,
      apres:`<span class="coche">${(nm.nodes||[]).length||"—"}</span>`})).join(""));
    h+=titreBloc("Garder un nom")+champ("newNom","Comment Il t'a traité ? « Celui qui… »")+
      `<div class="block">${bouton("Garder ce nom",'data-act="addNom"')}</div>`;
  } else if(S.rev==="chemins"){
    const ch=chemins();
    if(!ch.length) h+=`<p class="vide">Aucun chemin encore. Il en naît un dès que deux actes se répondent.</p>`;
    else h+=liste(ch.map(a=>{
      const an=a.map(n=>parse(n.date)).filter(Boolean).map(p=>p.y).sort();
      const sp=an.length ? (an[0]===an[an.length-1] ? ""+an[0] : an[0]+" → "+an[an.length-1]) : "";
      const cs=circonstancesDe(a), tete=nomChemin(a);
      const sous=[a.length+" acte"+(a.length>1?"s":""), sp,
                  cs.length===1 ? "pendant "+cs[0].nom : (cs.length?cs.length+" circonstances":"")]
                 .filter(Boolean).join(" · ");
      return ligne({titre:cite(tete), sous:esc(sous), attr:'data-chemin="'+a[0].id+'"'});
    }).join(""));
  } else if(S.rev==="gens"){
    if(!db.gens.length) h+=`<p class="vide">Personne encore.</p>`;
    else h+=liste(db.gens.slice().reverse().map(g=>{
      const par=db.nodes.filter(n=>n.gid===g.id).length;
      const dit=db.nodes.filter(n=>n.act==="moi"&&n.dest==="gens"&&n.dgid===g.id).length;
      return ligne({titre:esc(g.nom),
        texte:(par?("Il est passé par lui "+par+" fois.") : "Rien de Lui par lui, encore.")+" "+
              (dit?("Tu lui as rendu "+dit+" chose"+(dit>1?"s":"")+".") : "Tu ne lui as rien rendu.")});
    }).join(""));
  } else {
    /* La garde est en tête, une fois pour toutes — pas en note de bas de page
       après qu'on a déjà lu les chiffres. */
    h+=`<div class="block amorce" style="margin:16px 0 4px">Aucune moyenne n'est un jugement.
      Ce que le chiffre veut dire reste à toi.</div>`;
    CS=constats();
    if(!CS.length) h+=`<p class="vide">Pas encore de quoi compter. Garde quelques actes, et relie-les.</p>`;
    else {
      let fam=null, buf="", prem=true;
      CS.forEach((c,i)=>{
        if(c.fam!==fam){
          if(buf){ h+=liste(buf); buf=""; }
          h+=titreBloc(c.fam, prem?"":"ecart"); fam=c.fam; prem=false;
        }
        buf+=ligne({titre:c.txt, sous:c.ids.length?(c.ids.length+" acte"+(c.ids.length>1?"s":"")):"",
          attr:c.ids.length?'data-faits="'+i+'"':""});
      });
      if(buf) h+=liste(buf);
    }
  }
  Z.html=h;
}
function jours(a,b){
  const pa=parse(a), pb=parse(b); if(!pa||!pb) return null;
  return Math.round((Date.UTC(pb.y,pb.m-1,pb.d)-Date.UTC(pa.y,pa.m-1,pa.d))/86400000);
}
function duree(j){
  j=Math.abs(Math.round(j));
  if(j<31) return j+" jour"+(j>1?"s":"");
  const m=Math.round(j/30.44); if(m<24) return m+" mois";
  return Math.round(j/365.25)+" ans";
}
function court(t,n){ t=String(t||""); n=n||44;
  return t.length>n ? esc(t.slice(0,n-1).replace(/\s+\S*$/,""))+"…" : esc(t); }
/* Une citation déjà entre guillemets, remise entre guillemets, en porte deux
   paires : « « Je pourvoirai » ». On dénude avant de citer. */
function nue(t){ return String(t||"").trim().replace(/^[«“"]\s*/,"").replace(/\s*[»”"]$/,"").replace(/\s*\.$/,""); }

/* Mes chiffres : pas une jauge, des phrases. Chacune s'ouvre sur les faits
   qui la composent — un constat qu'on ne peut pas vérifier n'est pas un
   constat, c'est un verdict (14.5-bis.f, P4). Une famille dont la mémoire
   n'a pas encore de quoi parler se tait : mieux vaut six phrases vraies que
   douze dont la moitié dit « 0 sur 0 ». */
let CS=[];
function constats(){
  const out=[], dn=dieuNodes(), mien=db.nodes.filter(n=>n.act==="moi");
  const uniq=a=>a.filter((x,i)=>x&&a.indexOf(x)===i);
  const dit=(fam,txt,ids)=>out.push({fam:fam, txt:txt, ids:uniq(ids||[])});
  const pl=(n,m,p)=>n>1?(p||(m+"s")):m;

  /* --- Ses délais --- */
  const paroles=db.nodes.filter(n=>n.kind==="rhema"||n.kind==="ecriture");
  const paires=[];
  paroles.forEach(p=>enfants(p.id).filter(e=>e.act!=="moi"&&e.etat!=="prevu").forEach(e=>{
    const j=jours(p.date,e.date); if(j!=null&&j>=0) paires.push({p:p,e:e,j:j});
  }));
  if(paires.length){
    const moy=paires.reduce((s,x)=>s+x.j,0)/paires.length;
    dit("Ses délais", `Entre une parole et ce qui l'accomplit, Il a mis <b>${duree(moy)}</b> en moyenne, sur ${paires.length} ${pl(paires.length,"fois","fois")}.`, paires.map(x=>x.e.id));
    const max=paires.slice().sort((a,b)=>b.j-a.j)[0];
    if(max.j>0) dit("Ses délais", `Le plus long : <b>${duree(max.j)}</b>, après « ${court(nue(max.p.txt))} ».`, [max.p.id,max.e.id]);
  }
  const attente=paroles.filter(n=>!enfants(n.id).some(e=>e.act!=="moi"));
  if(attente.length) dit("Ses délais", `<b>${attente.length}</b> ${pl(attente.length,"parole")} ${attente.length>1?"attendent":"attend"} encore.`, attente.map(n=>n.id));

  /* --- Ce qui marche --- */
  const faits=mien.filter(n=>n.etat==="fait");
  const suivis=faits.filter(n=>enfants(n.id).some(e=>e.act!=="moi"));
  if(faits.length>=3) dit("Ce qui marche", `Sur tes ${faits.length} actes, <b>${suivis.length}</b> ont été suivis d'un acte de Lui.`, suivis.map(n=>n.id));
  [["dieu","pour Lui"],["gens","pour d'autres"],["moi","pour toi"]].forEach(([k,l])=>{
    const a=faits.filter(n=>n.dest===k); if(a.length<3) return;
    const b=a.filter(n=>enfants(n.id).some(e=>e.act!=="moi"));
    dit("Ce qui marche", `Tes actes ${l} : <b>${b.length}</b> sur ${a.length} ${b.length>1?"ont été suivis":"a été suivi"} d'un acte de Lui.`, b.map(n=>n.id));
  });

  /* --- Ta réponse --- */
  if(dn.length){
    const sans=dn.filter(n=>!enfants(n.id).some(e=>e.act==="moi"));
    dit("Ta réponse", sans.length
      ? `<b>${sans.length}</b> de Ses actes ${sans.length>1?"n'ont":"n'a"} jamais rien reçu de toi.`
      : `Chacun de Ses actes a reçu quelque chose de toi.`, sans.map(n=>n.id));
    const vieux=sans.filter(n=>n.date).sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0];
    if(vieux){ const j=jours(vieux.date,today());
      if(j!=null&&j>60) dit("Ta réponse", `Le plus ancien attend depuis <b>${duree(j)}</b>.`, [vieux.id]); }
    const rep=[];
    dn.forEach(n=>{
      const e=enfants(n.id).filter(x=>x.act==="moi"&&x.etat==="fait")
                           .sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0];
      if(e){ const j=jours(n.date,e.date); if(j!=null&&j>=0) rep.push({e:e,j:j}); }
    });
    if(rep.length>=2){ const moy=rep.reduce((s,x)=>s+x.j,0)/rep.length;
      dit("Ta réponse", `Quand tu réponds, tu mets <b>${duree(moy)}</b> en moyenne.`, rep.map(x=>x.e.id)); }
  }

  /* --- Les hommes --- */
  const par={};
  db.nodes.forEach(n=>{ if(n.act==="gens"&&n.gid) (par[n.gid]=par[n.gid]||[]).push(n.id); });
  const gids=Object.keys(par);
  if(gids.length){
    const top=gids.slice().sort((a,b)=>par[b].length-par[a].length)[0];
    dit("Les hommes", `Dieu est passé <b>${par[top].length}</b> fois par ${esc(gensNom(top))}.`, par[top]);
    const muets=gids.filter(g=>!db.nodes.some(n=>n.act==="moi"&&n.dest==="gens"&&n.dgid===g));
    if(muets.length) dit("Les hommes", `Tu n'as jamais rien rendu à <b>${muets.length}</b> ${pl(muets.length,"personne")} par qui Il est passé.`,
      [].concat.apply([], muets.map(g=>par[g])));
  }

  /* --- Tes chemins --- */
  const ch=chemins();
  if(ch.length){
    const plus=ch.slice().sort((a,b)=>b.length-a.length)[0];
    dit("Tes chemins", `Ta plus longue histoire compte <b>${plus.length}</b> actes.`, plus.map(n=>n.id));
    if(ch.length>1){
      const moy=ch.reduce((s,a)=>s+a.length,0)/ch.length;
      dit("Tes chemins", `<b>${ch.length}</b> chemins, ${String(Math.round(moy*10)/10).replace(".",",")} actes en moyenne.`, []);
    }
    const dort=ch.filter(a=>{ const j=jours(a[a.length-1].date, today()); return j!=null && j>365; });
    if(dort.length) dit("Tes chemins", `<b>${dort.length}</b> ${pl(dort.length,"chemin")} ${dort.length>1?"n'ont":"n'a"} rien reçu depuis plus d'un an.`,
      dort.map(a=>a[a.length-1].id));
  }

  /* --- Tes saisons --- */
  const ans={};
  db.nodes.forEach(n=>{ const p=parse(n.date); if(p) (ans[p.y]=ans[p.y]||[]).push(n.id); });
  const ks=Object.keys(ans).sort();
  if(ks.length>=2){
    const dense=ks.slice().sort((a,b)=>ans[b].length-ans[a].length)[0];
    dit("Tes saisons", `Ton année la plus dense : <b>${dense}</b>, ${ans[dense].length} actes.`, ans[dense]);
    const trous=[]; for(let y=+ks[0]+1; y<+ks[ks.length-1]; y++){ if(!ans[y]) trous.push(y); }
    if(trous.length) dit("Tes saisons", `Rien n'est gardé pour <b>${trous.join(", ")}</b>.`, []);
  }
  return out;
}

/* Les faits derrière un constat. */
function vFaits(){
  const c=CS[S.faits];
  if(!c){ S.view="revel"; return render(); }
  Z.titre="Les faits"; Z.retour=true;
  const ns=c.ids.map(node).filter(Boolean).sort(parDate);
  Z.html=`<div class="block amorce" style="margin-top:18px">${c.txt}</div>`
    + (ns.length ? liste(ns.map(n=>ligneActe(n,{attr:'data-node="'+n.id+'"'})).join(""))
                 : `<p class="vide">Rien à montrer ici.</p>`);
}

/* ---------- Mes actes ---------- */
function vActes(){
  const mien=db.nodes.filter(n=>n.act==="moi");
  /* « Rien. » sous « En cours » ne disait pas si l'écran était vide ou si le
     disciple n'avait pas trouvé le geste. Un bloc vide dit comment il se
     remplit. */
  const bloc=(t,arr,reste,vide)=>{
    let h=titreBloc(t);
    if(!arr.length) return h+`<p class="vide">${vide||"Rien."}</p>`;
    h+=liste(arr.map(n=>ligneActe(n,{attr:'data-node="'+n.id+'"'})).join(""));
    if(reste>0) h+=`<div class="block amorce">…et ${reste} autre${reste>1?"s":""}.</div>`;
    return h;
  };
  const faits=mien.filter(n=>n.etat==="fait").sort(parDate);
  /* « Planifié » rangeait tout par date croissante : le plus ancien d'abord,
     parce que ce qui est prévu se lit vers l'avant. C'était juste pour la
     moitié de la liste et faux pour l'autre — un acte noté ce matin passait
     sous tous ceux dont le jour était déjà passé, et le disciple l'a cherché
     en vain : « cet acte n'apparaît pas […] ça aurait dû être le dernier en
     haut ».
     Deux choses se tenaient dans une seule liste. Ce dont le jour est venu
     ou vient, et ce dont le jour est passé : ce n'est pas le même ordre de
     chose, donc pas la même forme (13.cu). Et l'app ne tient aucune série à
     ne pas casser : ce qui regarde en avant passe devant, ce qui attend se
     dit plus bas, sans reproche et avec sa porte (13.cb, 13.dh). */
  const t0=minuit(0);
  const passe=function(n){ const sp=spanActe(n); return !!sp && sp[1]<=t0; };
  const prevus=mien.filter(n=>n.etat==="prevu");
  const avenir=prevus.filter(n=>!passe(n)).sort(parDateAsc);
  const attend=prevus.filter(passe).sort(parDateAsc);
  Z.file = true;
  Z.haut = `<p class="titre-page">Mes actes</p>`;
  const cj=cumul(minuit(0), Date.now());
  /* Trois registres se tiennent à côté du mémorial sans en être : les heures
     données, les sujets portés, et l'argent qui entre et qui sort. Ils
     partagent donc la même porte, en haut de l'écran qui dit ce qui est à moi
     (13.di, 13.dk). */
  const nsj=(db.sujets||[]).length;
  const nex=(db.sujets||[]).filter(function(s){ return exaucesDe(s.id).length; }).length;
  Z.html = liste(ligne({titre:"Mon temps",
      sous: cj.tot ? esc(hm(cj.tot))+" compté aujourd'hui" : "Rien de compté aujourd'hui",
      attr:'data-go="temps"'})
    + ligne({titre:"Mes sujets",
      sous: nsj ? esc(sujetsTxt(nsj))+(nex?" · "+nex+" exaucé"+(nex>1?"s":""):"")
                : "Ce que tu portes devant Lui",
      attr:'data-go="cahier"'})
    + ligne({titre:"Mon argent",
      sous: (function(){
        /* Le mois, pas le jour : un loyer et une dîme ne se paient pas tous
           les matins, et « rien aujourd'hui » ne dirait rien de vrai. */
        const ca=cumulSous(bornes("mois",Date.now())[0], Date.now()+1);
        if(!ca.n) return "Ce qui entre, ce qui sort";
        if(ca.sorti) return pc(ca.par["dieu"]||0, ca.sorti)+" à Dieu ce mois-ci";
        return esc(sousTxt(ca.entre))+" entrés ce mois-ci";
      })(),
      attr:'data-go="argent"'}), "lien")
    + bloc("En cours", mien.filter(n=>n.etat==="encours").sort(parDate), 0,
      "Rien ne dure en ce moment. Ouvre un de tes actes et dis où il en est : il passera ici.")
    + (prevus.length
        ? bloc("À venir", avenir, 0, "Rien pour les jours qui viennent.")
          + (attend.length
              ? bloc("Ce qui attend", attend, 0)
                + `<div class="block amorce">Tu avais dit ce jour-là. Ouvre-les pour dire où ça en est — ou pour y renoncer.</div>`
              : "")
        : bloc("Planifié", [], 0,
            "Rien de prévu. « Je vais faire… », au moment de noter."))
    + bloc("Fait", faits.slice(0,12), faits.length-12);
}

/* ---------- un chemin ---------- */
/* Le fil est la lecture, les liens sont la vérité : les actes descendent du
   plus récent au plus ancien, et chacun dit « après : … » quand sa cause
   n'est pas simplement celle du dessous. Aucun trait n'est tracé
   (14.5-bis.b). */
function vChemin(){
  const suite=cheminDe(S.cheminId);
  if(!suite){ S.view="revel"; return render(); }
  Z.titre="Un chemin"; Z.retour=true;
  const dans={}; suite.forEach(function(n){ dans[n.id]=n; });
  /* Les pointes : ce qui ne mène à rien d'autre dans ce chemin. C'est d'elles
     qu'on part, puisque le fil descend vers ce qui a précédé. Un acte prévu
     en est une — il garde son point creux et son étiquette, et c'est tout ce
     qu'il faut : une coupure mentirait sur l'arbre. Mais il passe en dernier :
     en tête, il mettrait ce qui n'a pas eu lieu au-dessus de ce qui a eu lieu,
     et réduirait le vrai fil à un renvoi. */
  const pointes=suite.filter(function(n){
    return !enfants(n.id).some(function(e){ return dans[e.id]; });
  }).sort(function(a,b){
    return (a.etat==="prevu"?1:0)-(b.etat==="prevu"?1:0) || parDate(a,b);
  });
  const vu={}, vuc={}, vus={};
  const court=function(t){ t=String(t||"");
    return t.length>46 ? esc(t.slice(0,45).replace(/\s+\S*$/,""))+"…" : esc(t); };

  function pasActe(n){
    const cls=(n.act==="dieu" ? "dieu" : (n.act==="gens" ? "gens" : "moi"))
            + (n.etat==="prevu" ? " prevu" : "");
    return `<a class="pas ${cls}" data-node="${n.id}">
        <span class="dit">${cite(n)}</span>
        <span class="sous">${n.etat&&n.etat!=="fait"?`<span class="etiq">${ETAT[n.etat]}</span>`:""}${esc(acteurTxt(n))}${human(n)?" · "+human(n):""}</span>
      </a>`;
  }
  function pasCadre(x){
    return `<a class="pas cadre" ${x.kind==="periode"?'data-prd="':'data-vbloc="'}${x.id}">
        <span class="dit">${esc(x.nom)}</span>
        <span class="sous">${x.kind==="periode"?"un temps mis à part":"ce que tu donnais"} · ${esc(x.quand)}</span>
      </a>`;
  }
  function pasSujet(sid){
    return `<a class="pas sujet">
        <span class="dit">${court(sujetTxt(sid))}</span>
        <span class="sous">un sujet que tu as nommé${sujetHist(sid)?" · "+esc(sujetHist(sid)):""}</span>
      </a>`;
  }
  function pasRappel(n){
    return `<a class="pas rappel" data-node="${n.id}">
        <span class="dit">${court(n.txt)}</span>
        <span class="sous">déjà plus haut — deux fils s'y rejoignent</span>
      </a>`;
  }
  /* Descendre un acte, puis ce qui l'a précédé : ses causes, et la
     circonstance pendant laquelle il est arrivé (13.cy). */
  function descends(n){
    if(vu[n.id]) return pasRappel(n);
    vu[n.id]=1;
    const x = (n.pdt && !vuc[n.pdt]) ? pdtDe(n.pdt) : null;
    if(x) vuc[n.pdt]=1;
    const causes=(n.par||[]).map(node).filter(Boolean)
      .filter(function(p){ return dans[p.id]; }).sort(parDate);
    const sous=causes.map(descends);
    (n.suj||[]).forEach(function(s){ if(sujet(s) && !vus[s]){ vus[s]=1; sous.push(pasSujet(s)); } });
    if(x) sous.push(pasCadre(x));
    if(!sous.length) return pasActe(n);
    /* Une seule chose a précédé : c'est la même ligne qui continue, et la
       décaler inventerait une fourche. Plusieurs : la fourche est réelle. */
    if(sous.length===1) return pasActe(n)+sous[0];
    return pasActe(n)+sous.map(function(b){ return '<div class="ramif">'+b+'</div>'; }).join("");
  }

  /* L'en-tête porte déjà le nom de l'écran : le dire deux fois ne dit rien. */
  let intro="On descend vers ce qui a précédé. Là où le fil se divise, "
          + "plusieurs choses ont mené au même acte.";
  if(suite.some(function(n){ return n.etat==="prevu"; }))
    intro+=" Ce qui n'a pas encore eu lieu garde un point creux.";
  let h=`<div class="block amorce" style="margin-top:20px">${intro}</div>
    <div class="fil">`;
  /* Plusieurs pointes : autant de fils, posés l'un après l'autre sur le même
     filet. Les décaler en ferait des branches d'un acte qui n'existe pas —
     c'est plus bas qu'ils se rejoignent, et le renvoi le dit. */
  h += pointes.map(descends).join("");
  h+=`</div>`;
  /* Une chaîne qui s'arrête sur un acte de Lui pose une question, et laisse
     le droit de ne pas répondre (14.5-bis.e). */
  const fin=pointes.filter(function(n){ return n.etat!=="prevu"; })[0];
  if(fin && fin.act!=="moi"){
    h+=`<div class="block amorce" style="margin-top:18px">Qu'est-ce qui est sorti de ceci ?
      <span class="rien">Tu as le droit de ne pas répondre.</span></div>`;
    Z.action=bouton("Dire ce qui a suivi", 'data-attach="'+fin.id+'"');
  }
  Z.html=h;
}

/* ---------- un acte ---------- */
function vNode(){
  const n=node(S.nodeId); if(!n){ S.view="today"; return render(); }
  Z.titre="Un acte"; Z.retour=true; Z.plus=true;
  const par=(n.par||[]).map(node).filter(Boolean), enf=enfants(n.id);
  const dte=human(n);
  let h=`<div class="block" style="margin-top:20px;position:relative">
      ${RAMEAU("filigrane")}
      <p class="grand ${estParole(n)?"voix":""}" style="position:relative;max-width:76%">${cite(n)}</p>
      <p class="meta">${esc(acteurTxt(n))}${(n.man&&n.kind!=="rhema")?" · "+esc(manCourt(n.man)):""}${dte?" · "+dte:""}${n.etat&&n.etat!=="fait"?" · "+ETAT[n.etat]:""}</p>
      ${n.desc?`<p class="desc">${esc(n.desc)}</p>`:""}
    </div>`;
  /* Un acte à moi change d'état tout seul avec le temps : ce qui était prévu
     commence, ce qui a commencé s'achève. Si ça ne se dit qu'au moment de la
     capture, l'écran « Mes actes » ment au bout d'une semaine. Ici, un doigt
     suffit, et c'est le disciple qui le pose (P9). */
  h+=medBloc(n, false);
  if(n.act==="moi"){
    h+=titreBloc("Où ça en est");
    h+=liste(ETATS.map(([k,l])=>ligne({titre:l,
      apres:(n.etat||"fait")===k?`<span class="coche">✓</span>`:"",
      attr:'data-netat="'+k+'"'})).join(""));
  }
  /* « Pendant » n'est pas « en réponse à » : l'un dit la circonstance,
     l'autre affirme une cause (13.cx). Ils vivent donc l'un sous l'autre,
     jamais mélangés. */
  const px=n.pdt ? pdtDe(n.pdt) : null;
  if(px){
    h+=titreBloc("Pendant", n.act==="moi"?"ecart":"");
    h+=liste(ligne({titre:esc(px.nom), sous:esc(px.quand),
      attr:(px.kind==="periode" ? 'data-prd="' : 'data-vbloc="')+px.id+'"'}));
  }
  const sj=(n.suj||[]).filter(function(s){ return !!sujet(s); });
  h+=titreBloc("En réponse à", (n.act==="moi"||px)?"ecart":"");
  h+=liste(
    (par.length ? par.map(p=>ligneActe(p,{attr:'data-node="'+p.id+'"'})).join("") : "")
    + sj.map(function(s){ return ligne({titre:esc(sujetTxt(s)), sous:esc(sujetHist(s))}); }).join("")
    + ((par.length||sj.length) ? "" : ligne({titre:`<span class="rien">Rien, pour l'instant</span>`}))
    + ligne({titre:`<span class="coche">Dire ce qui a précédé</span>`, attr:'data-lierview="'+n.id+'"'}));
  /* « Mes retours » était faux une fois sur deux : ce qui suit peut être Sa
     réponse autant que la mienne. Le titre ne présume plus de l'acteur. */
  h+=titreBloc("Ce qui a suivi");
  h+= enf.length
    ? liste(enf.map(e=>ligneActe(e,{attr:'data-node="'+e.id+'"'})).join(""))
    : `<p class="vide">Rien n'a suivi, pour l'instant.</p>`;
  Z.html=h;
  Z.action = (n.etat==="prevu" || n.etat==="encours")
    ? bouton("C'est fait", 'data-fait="'+n.id+'"')
    : bouton("Dire ce qui a suivi", 'data-attach="'+n.id+'"');
}
function menuNode(){
  const n=node(S.nodeId); if(!n) return;
  const g=[{label:"Cet acte"},{txt:"Corriger", attr:'data-act="edit"'}];
  if(n.etat==="prevu"){ g.push({txt:"J'y renonce", attr:'data-abandon="'+n.id+'"'}); }
  else { g.push({txt:"Dire ce qui a suivi", attr:'data-attach="'+n.id+'"'}); }
  g.push({txt:"Supprimer", rouge:true, attr:'data-act="askDel"'});
  ouvreMenu([g, [{txt:"Annuler", attr:'data-act="fermeMenu"'}]]);
}

/* ---------- corriger un acte ---------- */
function vEdit(){
  const n=node(S.nodeId); if(!n){ S.view="today"; return render(); }
  Z.titre="Corriger"; Z.retour=true;
  let h=titreBloc("Le texte")+
    `<div class="block"><textarea class="dicte" id="eTxt" style="min-height:90px">${esc(n.txt)}</textarea>${micBloc("eTxt")}</div>`
    + blocDesc("eDesc", n.desc, S.descOuvert)
    + medBloc(n, true);
  if(n.act!=="moi"){
    h+=titreBloc("Sa manière")+liste(Object.keys(MANS()).map(k=>ligne({titre:manTxt(k),
      apres:S.eMan===k?`<span class="coche">✓</span>`:"", attr:'data-eman="'+k+'"'})).join(""));
  }
  h+=blocQuand("eDate", n.date, S.ePrec, n.act==="moi", S.eEtat);
  Z.html=h;
  Z.action = bouton("Garder", 'data-act="saveEdit"');
}

/* ---------- choisir une cause ----------
   Un seul écran, pour l'assistant comme pour un acte déjà gardé (13.o).
   On cherche au texte ; si la cause n'est pas encore dans la mémoire,
   on l'écrit ici même, sans quitter l'écran. */
const NEUFS = [
  ["ecriture", "Une promesse de l'Écriture",   "elle ne compte pas parmi Ses œuvres", true],
  ["rhema",    "Une parole qu'Il m'a dite",    "", true],
  ["moi",      "Quelque chose que j'ai fait",  "une prière, un jeûne, une démarche", false],
  ["dieu",     "Quelque chose qu'Il a fait",   "", false]
];
/* « En réponse à quoi ? » est la colonne MANIÈRE D'EXAUCEMENT du cahier de
   prière : on la remplit quand la réponse vient, pas avant. Le sujet est
   donc candidat au même titre qu'un acte gardé — c'est bien quelque chose
   qui a précédé. Mais il n'en porte pas la forme : un sujet n'est pas un
   acte, il n'a ni acteur ni manière, et le confondre avec un acte ferait
   entrer dans le mémorial trente-cinq lignes par matinée (13.dg). */
function choixSujets(sujSel){
  const suj=(db.sujets||[]).slice().sort(function(a,b){ return (b.maj||0)-(a.maj||0); });
  if(!suj.length) return "";
  return `<div class="cands">`+titreBloc("Ou un sujet que tu as nommé")
    + liste(suj.map(function(s){
        const pris=(sujSel||[]).indexOf(s.id)!==-1;
        return ligne({titre:esc(s.txt), sous:esc(sujetHist(s.id)),
          apres:pris?`<span class="coche">✓</span>`:"",
          attr:'data-sujp="'+s.id+'"'+(pris?' data-sel="1"':"")});
      }).join(""))+`</div>`;
}
function choixCause(sel, exclus, sujSel){
  /* Deuxième mode : on écrit la cause qui manque. La liste disparaît. */
  if(S.cNeuf){
    return `<div class="block" style="margin-top:18px">
        <textarea class="dicte" id="cNeuf" placeholder="La parole, la prière, l'acte qui a précédé…"
          style="min-height:84px">${esc(S.cTxt)}</textarea>${micBloc("cNeuf")}</div>`
      + titreBloc("Qu'est-ce que c'est ?")
      + liste(NEUFS.map(n=>ligne({titre:n[1], sous:n[2], serif:n[3],
          apres:S.cType===n[0]?`<span class="coche">✓</span>`:"",
          attr:'data-ctype="'+n[0]+'"'})).join(""));
  }
  /* Premier mode : on cherche dans ce qui est déjà gardé. */
  const cands = db.nodes
    .filter(x => exclus.indexOf(x.id)===-1 && x.etat!=="prevu" && x.etat!=="abandon")
    .sort(parDate);
  /* Tout dérouler d'un coup, c'est un mur : on ne cherche pas dans un mur.
     L'écran reste donc vide tant qu'aucun mot n'est écrit — sauf ce qui est
     déjà lié, qui ne doit jamais disparaître sous le pouce. */
  return champ("cFiltre","Cherche : une parole, une prière, un acte…")
    + liste(ligne({titre:`<span class="coche">+ Ajouter quelque chose de nouveau</span>`,
        attr:'data-act="causeNeuf"'}))
    + (cands.length
        ? liste(cands.map(x=>ligneActe(x,{coche:sel.indexOf(x.id)!==-1,
            attr:'data-par="'+x.id+'"'+(sel.indexOf(x.id)!==-1?' data-sel="1"':"")})).join(""), "cands")
        : "")
    + choixSujets(sujSel)
    + ((cands.length || (db.sujets||[]).length) ? ""
        : `<p class="vide">Rien d'autre dans ta mémoire pour l'instant.</p>`)
    + `<p class="vide" id="attente" hidden>Écris un mot : ce que tu as déjà gardé apparaîtra.</p>`
    + `<p class="vide" id="rien" hidden>Rien ne correspond. Touche « Ajouter quelque chose de nouveau ».</p>`;
}

/* ---------- rattacher une cause ---------- */
function vLier(){
  const n=node(S.nodeId); if(!n){ S.view="today"; return render(); }
  Z.titre = S.cNeuf ? "Ajouter ce qui a précédé" : "Ce qui a précédé"; Z.retour=true;
  Z.html = `<div class="block" style="margin-top:18px">
      <p class="grand ${estParole(n)?"voix":""}" style="font-size:21px">${esc(n.txt)}</p>
      <p class="meta">${S.cNeuf ? "Ce qui a précédé n'était pas encore gardé. Écris-le ici."
        : "Une parole, une prière, un bienfait d'avant."}</p></div>`
    + choixCause(n.par||[], dessous(n.id), n.suj||[]);
  Z.action = S.cNeuf ? bouton("Ajouter et lier", 'data-act="ajoute"')
                     : bouton("Terminer", 'data-back="1"');
}

/* ---------- l'assistant : noter, et attacher une réponse ---------- */
function neuf(act){ return {act:act,gid:null,dest:"dieu",dgid:null,txt:"",desc:"",man:"",par:[],suj:[],pdt:null,etat:"fait",date:today(),prec:"j",fige:false}; }
/* La phrase courte est ce qui se relit ; la description est ce qu'on y ajoute
   quand on a le temps. Elle reste pliée tant qu'elle est vide, pour ne pas
   peser sur la capture — c'est la capture qui doit être rapide (P2). */
function blocDesc(id, val, ouvert){
  if(!ouvert && !val) return liste(ligne({titre:`<span class="coche">+ Ajouter une description</span>`,
    sous:"facultatif", attr:'data-act="ouvreDesc"'}));
  return titreBloc("Description")
    + `<div class="block"><textarea class="dicte petit" id="${id}" placeholder="Les détails, le contexte, ce que tu ne veux pas perdre…" style="min-height:76px">${esc(val||"")}</textarea>${micBloc(id)}</div>`;
}
/* L'ordre des questions se déduit du brouillon : une question par écran. */
function etapes(d){
  const e=[];
  e.push("qui");
  if(d.act==="gens") e.push("gens");
  if(d.act==="moi") e.push("dest");
  if(d.act==="moi" && d.dest==="gens") e.push("destGens");
  e.push("txt");
  if(d.act!=="moi") e.push("man");
  e.push("quand");
  if(!d.fige) e.push("par");
  return e;
}
/* Tant que le compteur occupait le bas de l'écran, le pointage avait une
   porte permanente : « Rien n'est compté · Compter », sur tous les onglets.
   En montant dans le rail (13.bt), il l'a emportée avec lui — car le rail
   n'existe que pendant qu'on compte, et quand rien ne compte il ne restait
   qu'une ligne au milieu d'Aujourd'hui. Il fallait donc la chercher.
   Or compter son temps n'est pas l'affaire d'un onglet, c'est un geste ; et
   les gestes sont derrière le bouton du milieu, qui est là sur les quatre
   onglets. La porte revient donc là, mais à part : les quatre lignes au-
   dessus répondent toutes à « qu'est-ce que tu gardes ? », et pointer n'est
   pas garder. Un titre l'en sépare, pour qu'on ne la lise pas comme une
   cinquième réponse à une question qu'elle ne répond pas. */
/* Le bouton du milieu est là sur les quatre onglets : c'est le seul endroit
   que le pouce trouve sans réfléchir. Ce qu'on fait tous les jours doit donc
   y être, en clair, à une place qui ne bouge jamais.

   Il y avait là deux lignes écrites en dur — la Parole, et le livre en cours.
   Deux fois le même geste, et deux fois le disciple n'avait pas son mot à
   dire : ni sur ce qui figure là, ni sur ce qu'on y reprend. Or « continuer
   la littérature chrétienne » n'est pas forcément continuer CE livre-là, et
   prier ou méditer méritent autant leur ligne.

   Un raccourci, c'est donc une activité épinglée, et rien d'autre. Le titre
   nomme l'activité — pas le livre, qui n'est qu'un détail de l'endroit où
   l'on reprend. Et les champs demandés à l'arrêt ne sont pas un second
   réglage : ils découlent de la routine de l'activité, comme partout
   ailleurs (13.cn, 13.cq). Épingler ne demande donc qu'une chose. */
function epingles(){
  const ts=(db.taches||[]).filter(function(t){ return t.ep; })
    .sort(function(a,b){ return a.ep-b.ep; });
  if(ts.length) return ts;
  /* Tant que rien n'est épinglé, on garde ce qui était là : la Parole et le
     livre en cours. Une liste vide ne doit pas faire disparaître sans
     prévenir ce que le disciple avait sous le pouce. */
  return [tacheBible(), tacheLivre()].filter(Boolean).map(tache).filter(Boolean);
}
/* Où l'on reprendra — une information qui se lit sans ouvrir est une
   information gratuite (13.cg). C'est la routine qui sait quoi dire. */
function raccourciSous(t){
  const sp=spTache(t.id);
  if(sp==="bible") return "Le compteur part, à "+nomPlat(debutPlat());
  if(sp==="livre"){
    const l=livre(dernierLivre()), pg=l ? pageLue(l.id) : 0;
    if(l) return "Le compteur part, « "+l.nom+" » à la page "+(pg+1);
  }
  return "Le compteur part";
}
function raccourciArret(t){
  const sp=spTache(t.id);
  if(sp==="bible") return " — tu diras jusqu'où tu es allé";
  if(sp==="livre") return " — tu diras jusqu'à quelle page";
  if(sp==="sujets") return " — tu diras ce que tu as nommé";
  if(sp==="gens") return " — tu diras à qui tu as annoncé";
  return "";
}
function porteRaccourci(t){
  const o=ouverts().filter(function(b){ return b.t===t.id; })[0];
  if(o) return ligne({titre:"Arrêter « "+esc(tacheNom(t.id))+" »",
    sous:esc(hm(Date.now()-o.deb))+esc(raccourciArret(t)),
    attr:'data-ep="'+t.id+'"'});
  return ligne({titre:esc(tacheNom(t.id)), sous:esc(raccourciSous(t)),
    attr:'data-ep="'+t.id+'"'});
}
/* Les quatre lignes du dessus répondent toutes à « qu'est-ce que tu
   gardes ? », et pointer n'est pas garder : un titre l'en sépare, pour qu'on
   ne le lise pas comme une cinquième réponse à une question qu'il ne répond
   pas. */
function portePointage(){
  const o=ouvert();
  let h = titreBloc("Ou bien","ecart") + liste(ligne(o
    ? {titre:"« "+esc(tacheNom(o.t))+" » tourne",
       sous:esc(hm(Date.now()-o.deb))+" pour l'instant — changer ou arrêter",
       attr:'data-go="pointer"'}
    : {titre:"Compter mon temps", sous:"Dire à quoi va ton temps",
       attr:'data-go="pointer"'}), "lien");
  /* Un raccourci arrêtait toujours ce qui tournait. Mais on prie en marchant,
     on écoute un enseignement en cuisinant : deux choses de front ne se
     disputent pas la journée, elles la couvrent toutes les deux (13.by). Le
     choix revient donc ici, sous la forme qu'il a déjà ailleurs — et seulement
     quand quelque chose tourne, puisque « en plus » de rien ne veut rien dire
     (13.dd). */
  if(o)
    h += `<div class="puces" style="padding-top:2px">`
      + `<button class="puce" data-plus="0" aria-pressed="${!S.enPlus}">À la place</button>`
      + `<button class="puce" data-plus="1" aria-pressed="${!!S.enPlus}">En plus</button></div>`
      + `<div class="block amorce">${S.enPlus
          ? "Ce que tu lances ici tournera <b>à côté</b> de « "+esc(tacheNom(o.t))+" »."
          : "Ce que tu lances ici <b>arrêtera</b> « "+esc(tacheNom(o.t))+" »."}</div>`;
  h += liste(epingles().map(porteRaccourci).join("")
    + ligne({titre:"Choisir ce qui est ici",
             sous:"Les activités que tu veux sous le pouce",
             attr:'data-go="epingles"'}), "lien");
  return h;
}
/* Piloter la liste, c'est répondre à une seule question : qu'est-ce que je
   veux sous le pouce ? Donc une liste de toutes les activités, une coche, et
   rien d'autre — pas de second réglage sur ce qu'elles demanderont, puisque
   cela découle déjà de leur routine (13.cn). Les activités sans routine sont
   acceptées : elles ne compteront que le temps, et la ligne le dit. */
function vEpingles(){
  Z.titre="Ce qui est ici"; Z.retour=true;
  const ts=(db.taches||[]).slice().sort(function(a,b){
    return (b.ep?1:0)-(a.ep?1:0) || String(a.nom||"").localeCompare(String(b.nom||""));
  });
  let h=`<div class="block amorce" style="margin-top:20px">Ce que tu coches apparaît sous le bouton du milieu, prêt à partir d'une tape. Ce qu'on te demandera à l'arrêt vient de la routine de l'activité — tu n'as rien d'autre à régler.</div>`;
  if(!ts.length){
    h+=`<p class="vide">Aucune activité pour l'instant. Compte un premier temps, et reviens choisir.</p>`;
    Z.html=h; return;
  }
  h+=liste(ts.map(function(t){
    const d=discTache(t.id), sp=spTache(t.id);
    const quoi = sp==="bible" ? "demandera les chapitres"
               : sp==="livre" ? "demandera les pages" : "comptera le temps seulement";
    return ligne({titre:esc(tacheNom(t.id)),
      sous:esc((d ? discNom(d)+" · " : "")+quoi),
      apres: t.ep ? `<span class="coche">✓</span>` : "",
      attr:'data-eptog="'+t.id+'"'});
  }).join(""));
  /* Tant que rien n'est coché, deux lignes se montrent d'elles-mêmes : il
     faut le dire, sinon on croit que la liste ne marche pas. */
  if(!ts.some(function(t){ return t.ep; }))
    h+=`<div class="block amorce">Rien n'est coché : la Parole et le livre en cours se montrent alors d'eux-mêmes, comme avant. Dès que tu coches quelque chose, c'est ta liste qui vaut.</div>`;
  Z.html=h;
}

function vNote(){
  const d=S.draft||(S.draft=neuf(null));
  const et=etapes(d);
  if(S.step>=et.length) S.step=et.length-1;
  if(S.step<0) S.step=0;
  const cle=et[S.step];
  Z.avance=(S.step+1)/et.length;
  Z.retour = S.step>0;
  Z.fermer = S.step===0;
  const parent = d.fige && d.par.length ? node(d.par[0]) : null;

  if(cle==="qui"){
    Z.titre = parent ? "Qui a répondu ?" : "Qu'est-ce que tu gardes ?";
    Z.html = liste(parent
      ? ligne({titre:"Dieu a répondu…", sous:"sans passer par personne", serif:true, attr:'data-qui="dieu"'})+
        ligne({titre:"J'ai répondu…", serif:true, attr:'data-qui="moi"'})+
        ligne({titre:"Je vais répondre…", sous:"ce que tu t'engages à faire", serif:true, attr:'data-qui="moiPrevu"'})+
        ligne({titre:"Quelqu'un a répondu…", sous:"même si c'est Lui derrière", serif:true, attr:'data-qui="gens"'})
      : ligne({titre:"Dieu a fait…", sous:"sans passer par personne", serif:true, attr:'data-qui="dieu"'})+
        ligne({titre:"J'ai fait…", serif:true, attr:'data-qui="moi"'})+
        ligne({titre:"Je vais faire…", sous:"une résolution, un engagement, un vœu", serif:true, attr:'data-qui="moiPrevu"'})+
        ligne({titre:"Quelqu'un a fait…", sous:"même si c'est Lui derrière", serif:true, attr:'data-qui="gens"'}));
    if(!parent) Z.html += portePointage();
  }
  else if(cle==="dest"){
    Z.titre="Pour qui ?";
    Z.html = (parent?rappel(parent):"") + liste(
      ligne({titre:"Pour Dieu", serif:true, attr:'data-dest="dieu"'})+
      ligne({titre:"Pour quelqu'un", serif:true, attr:'data-dest="gens"'})+
      ligne({titre:"Pour moi", serif:true, attr:'data-dest="moi"'}));
  }
  else if(cle==="gens" || cle==="destGens"){
    const ch = cle==="gens" ? "gid" : "dgid";
    Z.titre = cle==="gens" ? "Qui a fait ?" : "Pour qui ?";
    Z.html = (db.gens.length
        ? liste(db.gens.map(g=>ligne({titre:esc(g.nom),
            apres:d[ch]===g.id?`<span class="coche">✓</span>`:"",
            attr:'data-gens="'+g.id+'" data-champ="'+ch+'"'})).join(""))
        : `<p class="vide">Personne encore.</p>`)
      + titreBloc("Un autre nom") + champ("newGens","Frère…, Sœur…")
      + `<div class="block">${bouton("Ajouter", 'data-act="addGens" data-champ="'+ch+'"')}</div>`;
  }
  else if(cle==="txt"){
    const futur = d.act==="moi" && d.etat==="prevu";
    const ph = d.act==="dieu" ? "Il a guéri maman en une nuit"
             : (d.act==="moi" ? "Remercier à voix haute pour…" : "Il a payé le loyer, sans que je demande");
    Z.titre = d.act==="dieu" ? "Qu'est-ce qu'Il a fait ?"
            : (d.act==="moi" ? (futur ? "Qu'est-ce que tu vas faire ?" : "Qu'est-ce que tu as fait ?")
                             : "Qu'a fait "+(gensNom(d.gid)||"cette personne")+" ?");
    let h = parent?rappel(parent):"";
    h+=`<div class="block"><textarea class="dicte" id="nTxt" placeholder="${ph}">${esc(d.txt)}</textarea>${micBloc("nTxt")}</div>`;
    const ref=reference(d.txt);
    h+=`<div id="ref"${ref?"":" hidden"}>`+liste(ligne({
        titre:`<span class="coche">Mettre la référence dans la description</span>`,
        sous:`<span class="q">${esc(ref)}</span>`, attr:'data-act="refDesc"'}))+`</div>`;
    h+=blocDesc("nDesc", d.desc, S.descOuvert);
    if(d.act==="moi"){
      const sug = (parent && parent.act==="gens")
        ? ["Le lui dire","Lui rendre un service","Prier pour lui","Remercier Dieu pour lui"]
        : ["Remercier à voix haute","Donner","Jeûner un jour","Le proclamer","Méditer sur ce bienfait"];
      h+=titreBloc("Ou choisis")+liste(sug.map(s=>ligne({titre:esc(s), attr:'data-sug="'+esc(s)+'"'})).join(""));
    }
    Z.html=h;
    Z.action = bouton("Continuer", 'data-act="suite"');
  }
  else if(cle==="man"){
    Z.titre = d.act==="dieu" ? "Sa manière ?" : "Reconnais-tu Sa main ?";
    let h="";
    if(d.act==="gens") h+=`<div class="block amorce" style="margin-top:16px">Si tu choisis une manière, cet acte entrera dans Ses œuvres.</div>`;
    h+=liste(Object.keys(MANS()).map(k=>ligne({titre:manTxt(k), serif:true,
      apres:d.man===k?`<span class="coche">✓</span>`:"", attr:'data-man="'+k+'"'})).join(""));
    h+=titreBloc("Une autre manière")+champ("newMan","Il a guéri, Il a consolé, Il a retenu…")
      +`<div class="block">${bouton("Ajouter", 'data-act="addMan"')}</div>`;
    Z.html=h;
    Z.action = bouton(d.man?"Continuer":"Passer", 'data-act="suite"');
  }
  else if(cle==="par"){
    Z.titre = S.cNeuf ? "Ajouter ce qui a précédé" : "En réponse à quoi ?";
    Z.html = `<div class="block amorce" style="margin-top:16px">${S.cNeuf
        ? "Ce qui a précédé n'était pas encore gardé. Écris-le ici."
        : "Une parole, une prière, un bienfait d'avant. Autant de liens que nécessaire."}</div>`
      + (S.cNeuf ? "" : choixPendant(d))
      + choixCause(d.par, [], d.suj||[]);
    if(S.cNeuf){ Z.action = bouton("Ajouter et lier", 'data-act="ajoute"'); }
    else {
      const der = S.step===etapes(d).length-1;
      /* « En réponse à rien » dit une absence, et c'est voulu — mais une
         circonstance posée n'est pas rien : l'annoncer vide, juste sous une
         ligne cochée, se contredirait. */
      const acte=der?"saveNote":"suite";
      Z.action = d.par.length
        ? bouton((der?"Garder — ":"Continuer — ")+d.par.length+" lien"+(d.par.length>1?"s":""), 'data-act="'+acte+'"')
        : (d.pdt
            ? bouton(der?"Garder":"Continuer", 'data-act="'+acte+'"')
            : bouton((der?"Garder":"Continuer")+" — en réponse à rien", 'data-act="'+acte+'"'));
    }
  }
  else {
    Z.titre = (d.act==="moi" && d.etat==="prevu") ? "Pour quand ?" : "Quand ?";
    Z.html = blocQuand("nDate", d.date, d.prec, d.act==="moi", d.etat);
    Z.action = bouton(S.step===etapes(d).length-1?"Garder":"Continuer",
      'data-act="'+(S.step===etapes(d).length-1?"saveNote":"suiteDate")+'"');
  }
}
function rappel(p){
  return `<div class="block amorce" style="margin-top:16px">En réponse à :
    <span class="${estParole(p)?"voix":""}">${esc(p.txt)}</span></div>`;
}
/* La date est toujours visible. L'état est une question séparée. */
function blocQuand(id, val, prec, avecEtat, etat){
  /* L'état passe avant la date : c'est lui qui décide si la question est
     « quand ? » ou « pour quand ? ». Dessous, sous un calendrier et déjà
     coché sur « c'est fait », personne ne le voyait — et « en cours » n'était
     atteignable nulle part dans l'application. */
  let h="";
  if(avecEtat){
    h+=titreBloc("Où ça en est ?")+liste(ETATS.map(([k,l])=>ligne({titre:l,
      apres:etat===k?`<span class="coche">✓</span>`:"", attr:'data-etat="'+k+'"'})).join(""));
  }
  h+=titreBloc(etat==="prevu" ? "Pour quand ?" : "Quand ?", avecEtat?"ecart":"")+
    liste(`<li class="item-content item-input"><div class="item-inner"><div class="item-input-wrap">
      <input type="date" id="${id}" value="${val||today()}"></div></div></li>`+
      ligne({titre:(prec==="m"?`<span class="coche">Je ne me souviens que du mois</span>`:"Je ne me souviens que du mois"),
             apres:prec==="m"?`<span class="coche">✓</span>`:"", attr:'data-prec="'+id+'"'}));
  return h;
}

