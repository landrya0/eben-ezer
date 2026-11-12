/* Ében-Ézer — sync
   La copie distante, et la réunion de deux appareils.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";
/* ---------- la synchronisation ---------- */
/* Rien ne part en clair. Le journal nomme des frères et des sœurs, porte ce
   qu'Il a dit, et tient le relevé minute par minute d'une vie. Le serveur n'en
   voit qu'un bloc opaque, et celui qui l'héberge ne peut rien y lire. */
/* Mais « le serveur ne lit pas » et « on peut récupérer » semblent s'exclure,
   et c'est faux. Une clé est tirée au sort pour chaque personne : c'est elle
   qui chiffre l'archive. Cette clé est ensuite mise sous enveloppe DEUX fois —
   une enveloppe que le mot de passe ouvre, une enveloppe qu'un code de
   récupération ouvre. Le serveur ne garde que les deux enveloppes closes. Qui
   oublie son mot de passe ressort son code et retrouve tout ; le serveur,
   lui, n'a jamais rien pu lire. C'est le procédé des gestionnaires de mots de
   passe, et il n'y en a pas d'autre qui tienne les deux bouts. */
/* Rempli à la publication. Personne d'autre que l'auteur n'a à connaître
   Supabase, ni à exécuter du SQL pour tenir son journal : l'adresse et la clé
   publique du projet voyagent avec l'application. Le formulaire reste là,
   derrière un lien, pour qui veut héberger le sien. */
const SUPA = {url:"https://oxuhnypkgvfaijzpgpqb.supabase.co",
              cle:"sb_publishable_x6KO1BBEhLG7kwP8dieRqw_G3RpLOuh"};
const SYK = "ebenezer.sync";
const SYVIDE = {url:"", cle:"", mail:"", uid:"", jwt:"", raf:"", exp:0,
                dk:"", envM:null, envR:null, aVoir:"",
                vu:"", base:0, fait:0, err:"", actif:false};
let SY = Object.assign({}, SYVIDE);
function syLoad(){ try{ const r=localStorage.getItem(SYK); if(r) Object.assign(SY, JSON.parse(r)); }catch(e){} }
function sySave(){ try{ localStorage.setItem(SYK, JSON.stringify(SY)); }catch(e){} }
function syOublie(){ SY=Object.assign({}, SYVIDE); try{ localStorage.removeItem(SYK); }catch(e){} }

function b64(buf){ let s=""; const a=new Uint8Array(buf);
  for(let i=0;i<a.length;i++) s+=String.fromCharCode(a[i]); return btoa(s); }
function deb64(t){ const s=atob(t), a=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) a[i]=s.charCodeAt(i); return a; }
function alea(n){ return crypto.getRandomValues(new Uint8Array(n)); }
async function deKDF(secret, sel){
  const brut=await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2", salt:sel, iterations:250000, hash:"SHA-256"},
    brut, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
}
async function ferme(dk, secret){
  const sel=alea(16), iv=alea(12), k=await deKDF(secret, sel);
  const c=await crypto.subtle.encrypt({name:"AES-GCM", iv:iv}, k, dk);
  return {s:b64(sel), i:b64(iv), c:b64(c)};
}
async function ouvre(env, secret){
  const k=await deKDF(secret, deb64(env.s));
  return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM", iv:deb64(env.i)}, k, deb64(env.c)));
}
async function cleDoc(dk){ return crypto.subtle.importKey("raw", dk, {name:"AES-GCM"}, false, ["encrypt","decrypt"]); }
async function chiffreDoc(obj, dk){
  const iv=alea(12), k=await cleDoc(dk);
  const c=await crypto.subtle.encrypt({name:"AES-GCM", iv:iv}, k, new TextEncoder().encode(JSON.stringify(obj)));
  return {i:b64(iv), c:b64(c)};
}
async function dechiffreDoc(o, dk){
  const k=await cleDoc(dk);
  const p=await crypto.subtle.decrypt({name:"AES-GCM", iv:deb64(o.i)}, k, deb64(o.c));
  return JSON.parse(new TextDecoder().decode(p));
}
/* Une pièce jointe se chiffre comme le document, avec la même clé, mais
   sans passer par du texte : le base64 ferait grossir d'un tiers une chose
   qui pèse déjà. Le vecteur est posé devant, et le serveur ne voit qu'un
   bloc d'octets dont il ignore jusqu'à la nature — le type du fichier reste
   dans l'archive, qui est elle-même chiffrée. */
async function chiffreOctets(buf, dk){
  const iv=alea(12), k=await cleDoc(dk);
  const c=await crypto.subtle.encrypt({name:"AES-GCM", iv:iv}, k, buf);
  const out=new Uint8Array(12+c.byteLength);
  out.set(iv, 0); out.set(new Uint8Array(c), 12);
  return out;
}
async function dechiffreOctets(oct, dk){
  const k=await cleDoc(dk);
  const p=await crypto.subtle.decrypt({name:"AES-GCM", iv:oct.slice(0,12)}, k, oct.slice(12));
  return new Uint8Array(p);
}

/* Vingt caractères sans I, O, 0 ni 1 : on le recopie à la main, souvent au
   crayon, et il ne faut pas qu'on puisse confondre deux signes. Deux cent
   quarante-huit, c'est bien au-delà de ce qui se devine. */
const ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function codeNeuf(){
  const a=alea(20); let t="";
  for(let i=0;i<20;i++){ t+=ALPHA.charAt(a[i]%32); if(i%4===3 && i<19) t+="-"; }
  return t;
}
function codeNu(c){
  return String(c||"").toUpperCase().split("").filter(function(x){ return ALPHA.indexOf(x)!==-1; }).join("");
}

/* On parle à Supabase en HTTP nu, sans bibliothèque : l'application reste sans
   dépendance, sans étape de compilation, et entièrement hors ligne. */
function syUrl(){ return String(SY.url||"").replace(/\/+$/,""); }
async function syFetch(chemin, opt){
  opt=opt||{};
  const h=Object.assign({"apikey":SY.cle, "Content-Type":"application/json"}, opt.headers||{});
  if(opt.jeton!==false && SY.jwt) h["Authorization"]="Bearer "+SY.jwt;
  const r=await fetch(syUrl()+chemin, {method:opt.method||"GET", headers:h,
    body:opt.body?JSON.stringify(opt.body):undefined, cache:"no-store"});
  let j=null; const t=await r.text();
  if(t){ try{ j=JSON.parse(t); }catch(e){ j=null; } }
  if(!r.ok){ const e=new Error((j&&(j.msg||j.message||j.error_description||j.error))||("HTTP "+r.status)); e.code=r.status; e.corps=j; throw e; }
  return j;
}
/* Le mot de passe fait deux métiers : il ouvre la porte du serveur, et il
   ouvre l'enveloppe qui contient la clé. Un seul secret à retenir au lieu de
   deux — et donc une occasion d'oublier au lieu de deux. */
async function sySignup(mail, mdp){
  return syFetch("/auth/v1/signup", {method:"POST", jeton:false, body:{email:mail, password:mdp}});
}
async function syMotDePasse(mail, mdp){
  const j=await syFetch("/auth/v1/token?grant_type=password", {method:"POST", jeton:false, body:{email:mail, password:mdp}});
  SY.jwt=j.access_token; SY.raf=j.refresh_token; SY.exp=Date.now()+((j.expires_in||3600)*1000);
  SY.uid=(j.user&&j.user.id)||""; SY.mail=mail; sySave();
  return j;
}
async function syJeton(){
  if(SY.jwt && SY.exp>Date.now()+90000) return true;
  if(!SY.raf) return false;
  const j=await syFetch("/auth/v1/token?grant_type=refresh_token", {method:"POST", jeton:false, body:{refresh_token:SY.raf}});
  SY.jwt=j.access_token; SY.raf=j.refresh_token; SY.exp=Date.now()+((j.expires_in||3600)*1000); sySave();
  return true;
}

/* Le dépôt des pièces ne parle pas JSON : on lui tend des octets, il en
   rend. Même porte, mêmes jetons, autre langue. */
async function syOctets(chemin, opt){
  opt=opt||{};
  const h=Object.assign({"apikey":SY.cle}, opt.headers||{});
  if(SY.jwt) h["Authorization"]="Bearer "+SY.jwt;
  const r=await fetch(syUrl()+chemin, {method:opt.method||"GET", headers:h,
    body:opt.body||undefined, cache:"no-store"});
  if(!r.ok){ const e=new Error("HTTP "+r.status); e.code=r.status; throw e; }
  return opt.lire ? new Uint8Array(await r.arrayBuffer()) : null;
}
function pjChemin(id){ return "/storage/v1/object/pieces/"+encodeURIComponent(SY.uid)+"/"+encodeURIComponent(id); }

/* Ce qui voyage, et ce qui ne voyage pas. Le dépôt est partagé par tous ceux
   qui installent l'application : un gigaoctet pour tout le monde ensemble.
   Une photo réduite y tient par milliers, une voix par centaines d'heures —
   une seule vidéo de téléphone en mangerait le tiers, et quand le dépôt
   déborde, c'est la synchronisation du texte qui s'arrête aussi. Les vidéos
   restent donc sur leur appareil, et elles le disent. */
const MED_VOYAGE = {photo:1, son:1};
/* Deux registres, et ils sont LOCAUX : ce qui est déjà monté d'ici, et ce
   qu'on a cherché en vain. Les mettre dans l'archive les exposerait à la
   fusion — un appareil effacerait le compte de l'autre — alors qu'ils ne
   disent rien d'autre que « ce que cet appareil-ci a déjà fait ». */
const PJK="ebenezer.pieces";
let PJ={haut:{}, abs:{}};
try{ const r=localStorage.getItem(PJK); if(r) PJ=Object.assign({haut:{},abs:{}}, JSON.parse(r)); }catch(e){}
function pjSave(){ try{ localStorage.setItem(PJK, JSON.stringify(PJ)); }catch(e){} }
let pjEnCours=false;
/* Une pièce à la fois, et on s'arrête au premier refus du réseau : le tour
   suivant reprendra là où celui-ci s'est arrêté. Rien n'est perdu à être
   interrompu, et rien n'est refait pour rien. */
async function syPieces(){
  if(!SY.actif || pjEnCours || !SY.dk || !navigator.onLine) return;
  pjEnCours=true;
  let venu=false;
  try{
    const pieces=medTout();
    for(let i=0;i<pieces.length;i++){
      const m=pieces[i];
      if(!MED_VOYAGE[m.genre]) continue;
      const ici=await medPrend(m.id);
      if(ici){
        if(PJ.haut[m.id]) continue;
        await syJeton();
        const oct=await chiffreOctets(await ici.arrayBuffer(), deb64(SY.dk));
        await syOctets(pjChemin(m.id), {method:"POST", body:oct,
          headers:{"Content-Type":"application/octet-stream", "x-upsert":"true"}});
        PJ.haut[m.id]=1; pjSave();
      } else {
        /* Une pièce qu'on ne trouve pas là-haut n'y est peut-être pas encore :
           l'autre appareil a posé sa fiche avant son fichier. On réessaie,
           mais pas toutes les quinze secondes. */
        if(PJ.abs[m.id] && Date.now()-PJ.abs[m.id] < 1800000) continue;
        await syJeton();
        let oct;
        try{ oct=await syOctets(pjChemin(m.id), {lire:true}); }
        catch(e){ if(e.code===400 || e.code===404){ PJ.abs[m.id]=Date.now(); pjSave(); continue; } throw e; }
        const clair=await dechiffreOctets(oct, deb64(SY.dk));
        await medPose(m.id, new Blob([clair], {type:m.mime||""}));
        delete PJ.abs[m.id]; PJ.haut[m.id]=1; pjSave();
        venu=true;
      }
    }
  }catch(e){}
  pjEnCours=false;
  /* Ce qui vient d'arriver doit se voir sans qu'on ait à revenir sur l'écran. */
  if(venu) medRend();
}

/* Un jalon est une chaîne, jamais une heure : comparer les horloges de deux
   appareils, c'est se tromper le jour où l'une retarde. On ne teste que
   l'égalité — « est-ce bien la version que j'ai vue la dernière fois ? ». */
function jalonNeuf(){ return Date.now().toString(36)+"-"+DEV+"-"+Math.random().toString(36).slice(2,7); }

async function syLit(entier){
  const champs = entier ? "jalon,doc" : "jalon";
  const a=await syFetch("/rest/v1/etat?uid=eq."+encodeURIComponent(SY.uid)+"&select="+champs);
  return (a && a.length) ? a[0] : null;
}
/* Les deux enveloppes sont réémises à chaque envoi. Elles ne changent qu'à
   une récupération — qui pousse aussitôt et change le jalon, donc l'autre
   appareil relira l'archive entière avant de poser la sienne. */
async function syEcrit(doc){
  const j=jalonNeuf();
  const corps=JSON.stringify({v:2, mdp:SY.envM, rec:SY.envR,
    doc:await chiffreDoc(doc, deb64(SY.dk))});
  await syFetch("/rest/v1/etat", {method:"POST",
    headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},
    body:{uid:SY.uid, doc:corps, jalon:j, maj:new Date().toISOString()}});
  return j;
}

/* Reprendre une archive déjà déposée : on l'ouvre, on la réunit avec ce que
   cet appareil tient déjà, et on repose le tout. */
async function syRejoint(r, envM){
  const env=JSON.parse(r.doc);
  const autre=sane(await dechiffreDoc(env.doc, deb64(SY.dk)));
  SY.envM = envM || env.mdp; SY.envR = env.rec;
  db = (db.nodes.length || (db.temps||[]).length) ? fusionne(db, autre) : autre;
  save(true);
  SY.actif=true; SY.vu=await syEcrit(db); SY.base=db.maj||0; SY.fait=Date.now(); sySave();
  S.syEtape=0; S.syMdp=""; S.pile=[]; S.view="reglages";
  toast("Synchronisation en route."); render();
}

/* Les pièces passent après le document, jamais avant : c'est la fiche qui
   dit quelles pièces chercher, et une pièce sans sa fiche ne sert à rien. */
let sySuite=null, syEnCours=false;
function syPlusTard(){
  if(!SY.actif) return;
  clearTimeout(sySuite);
  sySuite=setTimeout(function(){ syMaintenant(); }, 15000);
}
/* Le cœur. Quatre cas, et un seul qui demande du travail : les deux côtés ont
   bougé — alors on réunit, on garde le résultat ici, et on le repose là-bas.
   Jamais d'écrasement : un appareil vidé par le téléphone n'a plus de pierres
   tombales, donc la fusion lui rend tout. */
async function syMaintenant(manuel){
  if(!SY.actif || syEnCours) return false;
  if(!navigator.onLine){ if(manuel) toast("Pas de réseau"); return false; }
  syEnCours=true; SY.err="";
  try{
    await syJeton();
    const r=await syLit(false);
    const distantBouge = !r || r.jalon!==SY.vu;
    const localBouge   = (db.maj||0) > (SY.base||0);
    if(!r){
      SY.vu=await syEcrit(db); SY.base=db.maj||0;
    } else if(!distantBouge && !localBouge){
      /* rien à faire */
    } else if(!distantBouge){
      SY.vu=await syEcrit(db); SY.base=db.maj||0;
    } else {
      const plein=await syLit(true);
      const env=JSON.parse(plein.doc);
      SY.envM=env.mdp; SY.envR=env.rec;
      const autre=sane(await dechiffreDoc(env.doc, deb64(SY.dk)));
      if(!localBouge){
        db=autre; save(true); SY.vu=plein.jalon; SY.base=db.maj||0;
      } else {
        db=fusionne(db, autre);
        save(true);
        SY.vu=await syEcrit(db); SY.base=db.maj||0;
      }
      render();
    }
    SY.fait=Date.now(); sySave();
    if(manuel) toast("À jour.");
    /* Le texte d'abord, les pièces ensuite, et sans faire attendre : une
       photo qui monte ne doit pas retarder le mot qu'on vient d'écrire. */
    syPieces();
    return true;
  }catch(e){
    SY.err=String(e&&e.message||e); sySave();
    if(manuel) toast(syDit(e));
    return false;
  }finally{ syEnCours=false; }
}
function syDit(e){
  const m=String(e&&e.message||e);
  if(/OperationError|operation-specific/i.test(m)) return "Ce secret n'ouvre pas cette archive";
  if(/format inconnu/i.test(m)) return "Archive d'une version plus récente";
  if(/relation .* does not exist|42P01/i.test(m)) return "La table « etat » manque encore";
  if(/not confirmed/i.test(m)) return "Décoche « Confirm email » dans Supabase";
  if(/already registered/i.test(m)) return "Ce compte existe : mot de passe incorrect";
  if(/Invalid login|invalid_grant/i.test(m)) return "Adresse ou mot de passe incorrect";
  if(/Password should be|at least/i.test(m)) return "Mot de passe trop court";
  if(/JWT|token|401/i.test(m)) return "Connexion expirée — reconnecte-toi";
  if(/Failed to fetch|NetworkError/i.test(m)) return "Serveur injoignable";
  return m.slice(0,70);
}

/* ---------- fusionner deux appareils ---------- */
/* Le téléphone et la tablette tiennent chacun l'archive entière. À la
   rencontre, on ne choisit pas un gagnant — on réunit. Chaque fiche porte son
   identifiant et l'heure de sa dernière écriture : présente d'un seul côté
   elle est reprise, présente des deux c'est la plus récemment écrite qui
   reste, et ce qui a été supprimé le demeure grâce aux pierres tombales.
   L'opération donne le même résultat des deux côtés : les deux appareils
   convergent sans se parler davantage. */
function recent(a,b){ return ((a&&a.maj)||0) >= ((b&&b.maj)||0) ? a : b; }
function fusionListe(A, B, morts){
  const m={};
  (A||[]).forEach(function(x){ if(x&&x.id) m[x.id]=x; });
  (B||[]).forEach(function(x){ if(!x||!x.id) return; m[x.id] = m[x.id] ? recent(m[x.id],x) : x; });
  return Object.keys(m).filter(function(id){
    const t=morts[id];
    return !(t && t >= (m[id].maj||0));
  }).map(function(id){ return m[id]; });
}

const SANSFIN = 8640000000000;
function finDe(b){ return (typeof b.fin==="number") ? b.fin : SANSFIN; }
/* Deux appareils qui comptaient chacun de leur côté se chevauchent forcément :
   le téléphone croit que je travaille encore pendant que la tablette compte
   la même lecture. Compter les deux doublerait l'heure et fausserait toutes
   les parts. On rejoue donc les blocs dans l'ordre où ils ont été déclarés, et
   le plus récemment dit découpe ce qui était là avant — la dernière parole sur
   un instant est celle qui vaut. Le même découpage sert quand on corrige les
   heures à la main.
   Mais il ne vaut que pour une même activité. Tant qu'une seule chose pouvait
   tourner, tout chevauchement était une contradiction à trancher ; depuis
   qu'on peut en mener plusieurs de front (13.by), deux activités différentes
   qui se recouvrent ne se contredisent pas — elles disent qu'on faisait les
   deux. Les découper ici effacerait en silence ce qu'on vient de déclarer :
   on prie en se lavant, on corrige une heure, et la prière est rognée. Seule
   une activité se découpe donc elle-même (13.bz). */
/* Le temps couvert par une liste de blocs — l'union, jamais la somme. Il
   sert de garde-fou : aucune fusion n'a le droit de le faire diminuer. */
function couvert(liste){
  const sp=(liste||[]).map(function(b){ return [b.deb, finDe(b)]; })
    .filter(function(s){ return s[1]>s[0]; })
    .sort(function(a,b){ return a[0]-b[0]; });
  let t=0, d=null, f=0;
  sp.forEach(function(s){
    if(d===null){ d=s[0]; f=s[1]; return; }
    if(s[0]<=f){ if(s[1]>f) f=s[1]; return; }
    t+=f-d; d=s[0]; f=s[1];
  });
  return d===null ? 0 : t+(f-d);
}
/* Deux blocs de la même activité qui se recouvrent, c'est une seule présence
   dite deux fois : on les RÉUNIT.
   On faisait l'inverse, et c'était une machine à effacer. Le dernier bloc
   touché mordait sur les anciens de la même activité, et ce qui se trouvait
   entièrement sous sa dent disparaissait. Tant qu'il n'y avait qu'une file,
   mordre se défendait : dire « je priais à 9 h » revenait à dire « je ne
   faisais rien d'autre ». Mais un bloc EN COURS n'a pas de fin — pour le
   calcul, il va jusqu'à la fin des temps. Il mordait donc sur TOUT ce qui le
   suivait dans la même activité. Rouvrir la prière de 7 h effaçait celle de
   9 h ; reculer le début de ce qui tourne effaçait la séance du matin. Et
   « Garder » appelait cette fusion puis posait une pierre tombale sur ce
   qu'elle avait fait tomber : même la synchronisation ne pouvait plus le
   ramener.
   Une réunion ne perd jamais une minute ; une morsure en perd toujours. Un
   bloc ne se raccourcit donc plus que par la main du disciple, sur ses
   propres bornes, à lui seul (13.cf). */
function fusionTemps(liste){
  const ligne=(liste||[]).filter(function(b){ return finDe(b)>b.deb; })
    .map(function(b){ return Object.assign({}, b); })
    .sort(function(a,b){ return (a.deb-b.deb) || (finDe(a)-finDe(b)); });
  const out=[], der={};
  ligne.forEach(function(b){
    const p=der[b.t];
    /* Collés ou recouverts, deux morceaux de la même activité n'en font
       qu'un : la journée ne se lit pas en confettis, et rien ne tombe. */
    if(p && finDe(p)>=b.deb){
      if(finDe(b)>finDe(p)){
        if(typeof b.fin==="number") p.fin=b.fin; else delete p.fin;
      }
      p.maj=Math.max(p.maj||0, b.maj||0);
      if(b.porte) p.porte=1;
      /* Réunir deux morceaux ne doit rien effacer de ce qu'on y a écrit :
         une note et des chapitres tiennent à ce qui a été vécu, pas à
         l'heure qui le porte. */
      const a=(p.note||"").trim(), c=(b.note||"").trim();
      if(c && c!==a) p.note = a ? (a+"\n"+c) : c;
      if(b.lu && b.lu.length) p.lu=(p.lu||[]).concat(b.lu);
      return;
    }
    out.push(b); der[b.t]=b;
  });
  /* Si jamais une règle future se remettait à rogner, on rend la liste telle
     quelle : garder deux fois la même minute se corrige d'une tape, une
     minute perdue ne revient pas. */
  if(couvert(out) < couvert(liste)) return (liste||[]).slice();
  return out;
}

function fusionne(A, B){
  const morts={};
  [A.morts||{}, B.morts||{}].forEach(function(m){
    Object.keys(m).forEach(function(k){ morts[k]=Math.max(morts[k]||0, m[k]||0); });
  });
  const d={
    nodes: fusionListe(A.nodes,  B.nodes,  morts),
    gens:  fusionListe(A.gens,   B.gens,   morts),
    noms:  fusionListe(A.noms,   B.noms,   morts),
    mans:  fusionListe(A.mans,   B.mans,   morts),
    cats:  fusionListe(A.cats,   B.cats,   morts),
    livres:fusionListe(A.livres, B.livres, morts),
    auteurs:fusionListe(A.auteurs, B.auteurs, morts),
    sujets:fusionListe(A.sujets, B.sujets, morts),
    sous:  fusionListe(A.sous,   B.sous,   morts),
    portes:fusionListe(A.portes, B.portes, morts),
    rythmes:fusionListe(A.rythmes, B.rythmes, morts),
    taches:fusionListe(A.taches, B.taches, morts),
    temps: fusionTemps(fusionListe(A.temps, B.temps, morts)),
    periodes: fusionListe(A.periodes, B.periodes, morts),
    morts: morts,
    /* La monnaie est un réglage, pas un fait du mémorial : elle n'a pas de
       date de modification et ne se réunit donc pas comme une fiche. Celui
       des deux qui en a une l'emporte, l'archive locale d'abord ; si les
       deux appareils divergent, un passage par Réglages tranche (13.dk). */
    dev: A.dev || B.dev || "EUR",
    exp: Math.max(A.exp||0, B.exp||0),
    seq: Math.max(A.seq||1, B.seq||1),
    maj: Math.max(A.maj||0, B.maj||0)
  };
  /* Un lien vers un acte supprimé ailleurs ne mène nulle part ; un bloc dont
     l'activité a disparu n'a plus de part où se ranger. */
  const vivants={}; d.nodes.forEach(function(n){ vivants[n.id]=1; });
  d.nodes.forEach(function(n){ if(n.par) n.par=n.par.filter(function(p){ return vivants[p]; }); });
  /* Un sujet effacé ailleurs : l'acte reste, il perd ce qu'il exauçait —
     jamais l'inverse, comme pour la circonstance (13.cx). */
  const sv={}; d.sujets.forEach(function(s){ sv[s.id]=1; });
  d.nodes.forEach(function(n){ if(n.suj) n.suj=n.suj.filter(function(s){ return sv[s]; }); });
  d.noms.forEach(function(nm){ if(nm.nodes) nm.nodes=nm.nodes.filter(function(p){ return vivants[p]; }); });
  const ta={}; d.taches.forEach(function(t){ ta[t.id]=1; });
  d.temps=d.temps.filter(function(b){ return ta[b.t]; });
  /* Un sujet effacé sur l'autre appareil laisserait, ici, une ligne qui ne
     dit plus rien — et le nombre compterait du vide. */
  const sj={}; d.sujets.forEach(function(s){ sj[s.id]=1; });
  d.temps.forEach(function(b){ if(b.sj) b.sj=b.sj.filter(function(x){ return sj[x]; }); });
  /* Une personne effacée ailleurs ne retire pas la personne du compte : on
     a bien annoncé l'Évangile à quelqu'un, et c'est ce quelqu'un qu'on perd,
     pas le fait. La ligne reste, sans nom — comme toutes celles qu'on n'a
     jamais nommées (13.df). */
  const gn={}; d.gens.forEach(function(g){ gn[g.id]=1; });
  d.temps.forEach(function(b){
    if(b.qui) b.qui=b.qui.map(function(x){ return gn[x] ? x : ""; });
  });
  /* Et un « pendant » qui ne mène plus à rien : le bloc ou la période a pu
     être effacé sur l'autre appareil. L'acte reste, il perd sa circonstance
     — jamais l'inverse (13.cx). */
  const ici={}; d.temps.forEach(function(b){ ici[b.id]=1; });
  d.periodes.forEach(function(x){ ici[x.id]=1; });
  d.nodes.forEach(function(n){ if(n.pdt && !ici[n.pdt]) delete n.pdt; });
  /* Une pierre tombale ne sert que le temps que les deux appareils se
     rencontrent. Passé six mois, ils se sont parlé — ou l'autre n'existe plus. */
  const vieux=Date.now()-180*86400000;
  Object.keys(d.morts).forEach(function(k){ if(d.morts[k]<vieux) delete d.morts[k]; });
  return sane(d);
}

