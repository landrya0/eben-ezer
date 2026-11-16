/* v133 — le réveil (13.ey). Démo pour le volet, injectée à la main.
   Tout ce qu'elle pose se calcule depuis l'instant : elle doit tourner à
   n'importe quelle heure, et le lendemain aussi (AGENTS §6).
   Elle fait DEUX semblants, et elle le dit : ce navigateur a refusé les
   notifications pour ce site, et aucun appareil n'est relié. Le reste est
   la vraie application. */
(function(){
  if(typeof SY !== "undefined" && SY && SY.actif) throw new Error("STOP : la synchro est active");
  const H = 3600000, M = 60000, J = 86400000;
  const D = window.DEMO;
  let permissionVraie = null;

  function b(id, t, deb, fin){
    const o = {id:id, t:t, deb:deb, maj:deb};
    if(typeof fin === "number") o.fin = fin;
    return o;
  }
  function pose(){
    const n = Date.now();
    db = sane({});
    db.taches = [{id:"d1", nom:"Prière", cat:"dieu", d:"priere", maj:n},
                 {id:"d2", nom:"Sommeil", cat:"moi", maj:n}];
    db.temps = [
      b("dp1","d1", n-4*J, n-4*J+10*M),
      b("dp2","d1", n-3*J, n-3*J+12*M),
      b("dp3","d1", n-2*J, n-2*J+15*M),
      b("dp4","d1", n-1*J, n-1*J+34*M),
      b("do1","d1", n-9*H)                    /* le compteur oublié ce matin */
    ];
    save(); render(); majChrono();
  }
  /* Le volet a refusé les notifications, et rien n'est relié : sans ces deux
     semblants l'offre montrerait ses branches d'excuse, pas sa branche
     principale. Tous deux sont annulés à la fin. */
  function semblant(){
    try{
      permissionVraie = Object.getOwnPropertyDescriptor(Notification, "permission");
      Object.defineProperty(Notification, "permission", {get:function(){ return "default"; }, configurable:true});
    }catch(e){}
    SY.actif = true; SY.uid = "u-demo"; SY.mail = "toi@exemple.com";
  }
  function rendLeVrai(){
    try{ if(permissionVraie) Object.defineProperty(Notification, "permission", permissionVraie); }catch(e){}
    SY.actif = false; SY.uid = ""; SY.mail = ""; SY.abo = ""; SY.rev = 0;
    try{ sySave(); }catch(e){}
  }

  async function jouer(){
    /* 1 — ce que la veille sait déjà faire, et où elle s'arrête */
    pose(); semblant();
    await D.tape('[data-go="today"]');
    await D.dit("Depuis v131, la veille voit",
      "Un compteur de prière tourne depuis neuf heures, alors que les quatre dernières n'ont jamais "
      + "passé 34 minutes. Le rail le signale, sur tous les écrans.", true);
    await D.montre("#rail", 2600);
    D.cache();

    /* 2 — la carte, et la limite */
    await D.tape("#rail .tic");
    await D.dit("Et la carte dit tout ce qu'il faut",
      "La durée, l'habitude, et trois portes. Sauf que <b>personne n'a ouvert cet écran de la "
      + "matinée</b> — c'est justement pour ça que le compteur est oublié.");
    await D.pause(1600);

    /* 3 — l'aveu, puis la porte */
    await D.dit("L'écran l'avoue, et propose",
      "Une page web ne tourne pas quand on la quitte : la veille ne parlait qu'à celui qui ouvrait "
      + "l'app. L'offre est posée <b>là</b>, sur la carte qui dérape, et nulle part ailleurs — c'est "
      + "le seul moment où elle répond à quelque chose.", true);
    await D.montre(D.ligne("Me prévenir même quand l'app est fermée"), 3200);
    D.cache();

    /* 4 — le cœur : ce qui part, et ce qui ne part pas */
    const q = (db.temps.find(function(x){ return x.id==="do1"; })||{}).deb + seuilDe("d1");
    await D.dit("Ce qui part au serveur",
      "<b>Une heure</b> — " + new Date(q).toLocaleString("fr-FR") + " — et l'adresse opaque de cet "
      + "appareil. C'est tout, et il n'y a rien à chiffrer parce qu'il n'y a rien. Le serveur "
      + "n'apprend jamais qu'un seuil a été dépassé : c'est l'app qui a calculé l'heure.");
    await D.pause(2600);
    await D.dit("Ce qui ne part pas",
      "« Prière », le seuil d'1 h 08, les 13 minutes d'habitude. Tout ça reste ici, dans un miroir "
      + "posé sur l'appareil — et c'est ce miroir que le service worker lira, <b>réveillé par un "
      + "message vide</b>, pour écrire : « Prière — 9 h · D'habitude, 13 min. Est-ce que ça tourne "
      + "encore ? » Le nom n'a jamais voyagé.");
    await D.pause(2800);

    /* 5 — l'état, et le moyen de l'éteindre */
    SY.abo = "https://push.exemple/demo"; SY.rev = q;
    S.view = "sync"; S.pile = []; render();
    await D.dit("Allumé, il se dit et il s'éteint",
      "L'offre était sur la carte, parce qu'elle y répondait à quelque chose. L'interrupteur est "
      + "ici, avec l'heure du prochain réveil.", true);
    await D.montre(D.bloc("Le réveil") || ".block-title", 3000);
    D.cache();

    /* 6 — ce qui n'est pas fait, et qui ne l'est pas par moi */
    SY.abo = "";
    await D.dit("Ce qu'il reste, et qui est à toi",
      "La table, la fonction qui sonne et l'horloge vivent chez Supabase : elles demandent ton "
      + "compte, et je ne les fais pas à ta place. Quatre gestes, écrits dans "
      + "<b>serveur/LISEZ-MOI.md</b>. Tant qu'ils ne sont pas faits, l'offre le dit au lieu de "
      + "s'allumer pour rien.");
    await D.pause(2400);
  }

  D.porte({
    k: "v133 · le réveil",
    titre: "Prévenir sans rien dire",
    phrase: "Six étapes. La démo écrit dans cette copie du navigateur seulement, et le bouton « Effacer la démo » remet tout à zéro à la fin.",
    bouton: "Commencer",
    n: 6,
    fin: "Voilà le réveil.",
    jouer: jouer,
    nettoie: function(){
      rendLeVrai();
      db = sane({}); save();
      try{ soVide(); }catch(e){}
      try{ localStorage.removeItem("ebenezer.vues"); }catch(e){}
      try{ caches.delete("ebenezer-veille"); }catch(e){}
      render(); majChrono();
    }
  });
})();
