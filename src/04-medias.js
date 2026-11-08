/* Ében-Ézer — medias
   Ce qu'on joint à un acte.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- les médias ---------- */
/* Une photo ne tient pas dans la mémoire du navigateur où vit l'archive :
   cinq mégaoctets pour tout, et une seule image en prendrait la moitié. Les
   fichiers vivent donc à côté, dans la réserve ; l'acte ne garde que leur
   fiche. L'archive reste légère — et elle reste lisible, ce qui est le but.
   Conséquence qu'il faut dire et non cacher : la fiche voyage d'un appareil
   à l'autre, le fichier non. Un média absent le dit lui-même. */
const MED_MAX = 25*1024*1024;
/* Trois phrases entières plutôt qu'un nom qu'on recolle : à force
   d'assembler des morceaux, on écrit « une photo, resté », et une phrase
   bancale fait douter de tout le reste. */
const MED_DIT = {
  photo:{loin:"Une photo, restée sur l'appareil où on l'a prise. Relie tes appareils, et elle suivra.",
         venir:"Une photo, pas encore arrivée ici. Elle viendra à la prochaine synchronisation."},
  son:{loin:"Un son, resté sur l'appareil où on l'a enregistré. Relie tes appareils, et il suivra.",
       venir:"Un son, pas encore arrivé ici. Il viendra à la prochaine synchronisation."},
  video:{loin:"Une vidéo, restée sur l'appareil où on l'a filmée : trop lourde pour le dépôt partagé, elle ne voyage pas.",
         venir:"Une vidéo, restée sur l'appareil où on l'a filmée : trop lourde pour le dépôt partagé, elle ne voyage pas."}
};
let medBase=null;
function medOuvre(){
  if(medBase) return medBase;
  medBase = new Promise(function(ok, non){
    let r;
    try{ r=indexedDB.open("ebenezer.med", 1); }catch(e){ return non(e); }
    r.onupgradeneeded=function(){ try{ r.result.createObjectStore("fic", {keyPath:"id"}); }catch(e){} };
    r.onsuccess=function(){ ok(r.result); };
    r.onerror=function(){ non(r.error); };
  });
  return medBase;
}
function medAttend(req){
  return new Promise(function(ok, non){
    req.onsuccess=function(){ ok(req.result); };
    req.onerror=function(){ non(req.error); };
  });
}
function medSac(mode){
  return medOuvre().then(function(d){ return d.transaction("fic", mode).objectStore("fic"); });
}
function medPose(id, blob){ return medSac("readwrite").then(function(x){ return medAttend(x.put({id:id, blob:blob})); }); }
function medPrend(id){ return medSac("readonly").then(function(x){ return medAttend(x.get(id)); })
  .then(function(r){ return r ? r.blob : null; }).catch(function(){ return null; }); }
function medEfface(id){ return medSac("readwrite").then(function(x){ return medAttend(x.delete(id)); }).catch(function(){}); }
function medGenre(mime){
  const m=String(mime||"");
  if(m.indexOf("image/")===0) return "photo";
  if(m.indexOf("audio/")===0) return "son";
  if(m.indexOf("video/")===0) return "video";
  return "";
}
function poids(o){
  if(o<1024) return o+" o";
  if(o<1024*1024) return Math.round(o/1024)+" Ko";
  const m=o/(1024*1024);
  return (m<10 ? m.toFixed(1) : Math.round(m))+" Mo";
}
function medTout(){
  const a=[];
  db.nodes.forEach(function(n){ (n.med||[]).forEach(function(m){ a.push(m); }); });
  return a;
}
function medPoids(){ let t=0; medTout().forEach(function(m){ t+=(m.taille||0); }); return t; }
/* Une photo de téléphone pèse quatre mégaoctets pour douze millions de
   points, quand un écran en montre un. On la réduit avant de la ranger :
   ce qui est gardé doit pouvoir ressortir dans un fichier, et un fichier
   trop lourd pour être déplacé n'est plus une sauvegarde. */
function medReduit(f){
  return new Promise(function(ok){
    let u;
    try{ u=URL.createObjectURL(f); }catch(e){ return ok(f); }
    const im=new Image();
    im.onload=function(){
      try{ URL.revokeObjectURL(u); }catch(e){}
      const max=1600, e=Math.min(1, max/Math.max(im.width||1, im.height||1));
      if(e>=1 && f.size<900000) return ok(f);
      try{
        const c=document.createElement("canvas");
        c.width=Math.max(1, Math.round((im.width||1)*e));
        c.height=Math.max(1, Math.round((im.height||1)*e));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(function(b){ ok(b && b.size<f.size ? b : f); }, "image/jpeg", 0.72);
      }catch(x){ ok(f); }
    };
    im.onerror=function(){ try{ URL.revokeObjectURL(u); }catch(e){} ok(f); };
    im.src=u;
  });
}
function medJoint(n, fichiers){
  const fics=[].slice.call(fichiers||[]);
  let pris=0, lourd=0, autre=0;
  return fics.reduce(function(suite, f){
    return suite.then(function(){
      const g=medGenre(f.type);
      if(!g){ autre++; return; }
      return (g==="photo" ? medReduit(f) : Promise.resolve(f)).then(function(b){
        if(b.size>MED_MAX){ lourd++; return; }
        const id=uid("m");
        return medPose(id, b).then(function(){
          n.med=n.med||[];
          n.med.push({id:id, genre:g, mime:b.type||f.type||"", taille:b.size, dev:DEV, maj:Date.now()});
          pris++;
        }, function(){ autre++; });
      });
    });
  }, Promise.resolve()).then(function(){
    if(pris){ touche(n); save(); }
    /* Ce qui n'est pas entré doit se dire : un fichier qu'on croit joint et
       qui ne l'est pas, on ne s'en aperçoit que le jour où on le cherche. */
    if(lourd) toast("Trop lourd : "+poids(MED_MAX)+" au plus.");
    else if(autre && !pris) toast("Ni photo, ni son, ni vidéo : rien n'a été joint.");
    else if(autre) toast(pris+" joint"+(pris>1?"s":"")+", "+autre+" laissé"+(autre>1?"s":"")+" de côté.");
    else if(pris) toast(pris===1 ? "Joint." : pris+" fichiers joints.");
    render();
  });
}
/* Les adresses d'affichage sont rendues au navigateur à chaque redessin :
   sans ça, feuilleter dix actes garderait dix vidéos ouvertes en mémoire. */
let medUrls=[];
function medRend(){
  medUrls.forEach(function(u){ try{ URL.revokeObjectURL(u); }catch(e){} });
  medUrls=[];
  [].forEach.call(document.querySelectorAll("[data-med]"), function(el){
    const id=el.getAttribute("data-med"), g=el.getAttribute("data-genre");
    const zone=el.querySelector(".medZone"); if(!zone) return;
    medPrend(id).then(function(b){
      if(!zone.isConnected) return;
      if(!b){
        const t=MED_DIT[g];
        const dit = !t ? "Un fichier, resté sur l'appareil où on l'a pris."
                  : ((SY.actif && MED_VOYAGE[g]) ? t.venir : t.loin);
        zone.innerHTML = `<p class="medAbs">${dit}</p>`; return;
      }
      let u; try{ u=URL.createObjectURL(b); }catch(e){ return; }
      medUrls.push(u);
      if(g==="photo") zone.innerHTML = `<img src="${u}" alt="">`;
      else if(g==="son") zone.innerHTML = `<audio controls preload="none" src="${u}"></audio>`;
      else zone.innerHTML = `<video controls playsinline preload="metadata" src="${u}"></video>`;
    });
  });
}
/* Joindre se propose partout où l'acte se regarde : on ne photographie pas
   au moment de noter — la capture doit rester brève (P2) — mais le soir,
   quand on revient dessus. */
function medBloc(n, corr){
  const m=n.med||[];
  let h = titreBloc(m.length ? "Ce qui est joint" : "", "ecart");
  if(m.length) h += `<div class="meds">`+m.map(function(x){
      return `<figure class="med" data-med="${x.id}" data-genre="${x.genre}">
        <div class="medZone"></div>
        ${corr?`<button class="medSup" data-medsup="${x.id}" aria-label="Retirer">${CROIX}</button>`:""}
      </figure>`;
    }).join("")+`</div>`;
  h += liste(ligne({titre:`<span class="coche">+ Joindre une photo, un son, une vidéo</span>`,
      sous: m.length ? "" : "à prendre maintenant, ou déjà sur l'appareil", attr:'data-act="medPioche"'}));
  /* L'appareil photo et la caméra passent par le système : c'est lui qui
     sait cadrer, et le disciple connaît déjà son propre appareil. Le son,
     lui, s'enregistre ici — sur iPhone, le système ne propose pas de
     dictaphone à une page web, et il n'y aurait sinon aucun moyen de
     garder une voix. */
  h += `<input type="file" id="medIn" accept="image/*,audio/*,video/*" multiple hidden>
    <input type="file" id="medCam" accept="image/*" capture="environment" hidden>
    <input type="file" id="medVid" accept="video/*" capture="environment" hidden>`;
  return h;
}
/* Enregistrer une voix, ici même. Le son ne sort jamais de l'appareil : pas
   de reconnaissance, pas de serveur — c'est la voix elle-même qu'on garde,
   et c'est bien pour ça qu'on la garde. */
function peutEnr(){
  try{ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
  catch(e){ return false; }
}
let ENR=null;
function enrOuvre(){
  if(ENR || !peutEnr()) return;
  const n=node(S.nodeId); if(!n) return;
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(flux){
    let mr;
    try{ mr=new MediaRecorder(flux); }
    catch(e){ flux.getTracks().forEach(t=>t.stop()); return toast("Cet appareil ne sait pas enregistrer ici."); }
    const bouts=[];
    mr.ondataavailable=function(e){ if(e.data && e.data.size) bouts.push(e.data); };
    mr.onstop=function(){
      flux.getTracks().forEach(function(t){ try{ t.stop(); }catch(x){} });
      const garde=ENR && ENR.garde, cible=ENR && ENR.n;
      enrEteint();
      if(!garde || !bouts.length) return;
      const b=new Blob(bouts, {type:(mr.mimeType||"audio/webm").split(";")[0]});
      if(b.size<800) return toast("Trop court : rien n'a été gardé.");
      medJoint(cible, [b]);
    };
    /* Un micro qu'on ouvre sans pouvoir enregistrer doit se refermer : sinon
       la pastille rouge du système reste allumée pour rien. */
    try{ mr.start(); }
    catch(e){ flux.getTracks().forEach(function(t){ try{ t.stop(); }catch(x){} });
              return toast("L'enregistrement n'a pas pu démarrer."); }
    ENR={mr:mr, n:n, deb:Date.now(), garde:false, tic:0};
    const f=document.getElementById("enr");
    if(f){ f.hidden=false; fond.classList.add("backdrop-in"); }
    enrTic();
    ENR.tic=setInterval(enrTic, 250);
    /* Au-delà de dix minutes on arrête de soi-même : un enregistrement
       oublié en marche mangerait la réserve sans qu'on le sache. */
    ENR.butoir=setTimeout(function(){ toast("Dix minutes : arrêté."); enrFerme(true); }, 600000);
  }, function(){ toast("Le micro n'a pas été autorisé."); });
}
function enrTic(){
  if(!ENR) return;
  const e=document.querySelector("#enr .enrDur"); if(!e) return;
  const s=Math.floor((Date.now()-ENR.deb)/1000);
  e.textContent = Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
}
function enrEteint(){
  if(ENR){ clearInterval(ENR.tic); clearTimeout(ENR.butoir); }
  ENR=null;
  const f=document.getElementById("enr");
  if(f) f.hidden=true;
  if(!menu.classList.contains("modal-in")) fond.classList.remove("backdrop-in");
}
function enrFerme(garde){
  if(!ENR) return;
  ENR.garde=!!garde;
  try{ ENR.mr.stop(); }catch(e){ enrEteint(); }
}

function b64Blob(s64, mime){
  const bin=atob(s64), a=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i);
  return new Blob([a], {type:mime||"application/octet-stream"});
}
function blobB64(b){
  return new Promise(function(ok, non){
    const r=new FileReader();
    r.onload=function(){ ok(String(r.result).split(",")[1]||""); };
    r.onerror=function(){ non(r.error); };
    r.readAsDataURL(b);
  });
}

