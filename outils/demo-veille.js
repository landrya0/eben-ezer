/* v129 — la veille des compteurs. Démo pour le volet, injectée à la main.
   Tout ce qu'elle pose se calcule depuis l'instant : elle doit tourner à
   n'importe quelle heure, et le lendemain aussi (AGENTS §6). */
(function(){
  if(typeof SY !== "undefined" && SY && SY.actif) throw new Error("STOP : la synchro est active");
  const H = 3600000, M = 60000, J = 86400000;
  const D = window.DEMO;

  function b(id, t, deb, fin){
    const o = {id:id, t:t, deb:deb, maj:deb};
    if(typeof fin === "number") o.fin = fin;
    return o;
  }
  function posePrieres(){
    const n = Date.now();
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
  function poseSommeil(){
    const n = Date.now();
    db.temps = [
      b("ds1","d2", n-4*J-8*H, n-4*J),
      b("ds2","d2", n-3*J-7*H, n-3*J),
      b("ds3","d2", n-2*J-6*H, n-2*J),
      b("ds4","d2", n-1*J-5*H, n-1*J),
      b("do2","d2", n-9*H)                    /* neuf heures, encore ouvert */
    ];
    save(); render(); majChrono();
  }
  function hm(ms){ const m=Math.round(ms/60000), h=Math.floor(m/60), r=m%60;
    return h ? (r ? h+" h "+String(r).padStart(2,"0") : h+" h") : m+" min"; }

  async function jouer(){
    /* 1 — le point de départ, vide : sans lui on ne sait pas ce qui a changé */
    db = sane({}); save(); render(); majChrono();
    await D.tape('[data-go="today"]');
    await D.dit("Le point de départ",
      "Rien ne tourne, et le rail n'est même pas là. C'est l'app telle que tu la quittes quand tout est à jour.");
    await D.pause(900);

    /* 2 — l'archive, et le compteur oublié */
    posePrieres();
    await D.dit("Ce que l'archive sait de tes prières",
      "Quatre prières : 10, 12, 15 et 34 minutes. Et une cinquième, lancée il y a neuf heures — "
      + "celle qu'on oublie d'arrêter. Rien ici n'est réglé à la main.");
    await D.pause(1200);

    /* 3 — le signe, sur tous les écrans */
    await D.dit("Le rail a changé de point",
      "Il est creux, et le rail s'est rouvert tout seul. C'est le seul objet présent sur <b>tous</b> les écrans : "
      + "le signe te trouve où que tu sois.", true);
    await D.montre("#rail", 3000);
    D.cache();

    /* 4 — il mène quelque part */
    await D.dit("Et il mène là où on peut répondre",
      "Un chiffre qui accuse doit mener quelque part. La tape ouvre le pointage.");
    await D.tape("#rail .tic");

    /* 5 — la question */
    await D.dit("La question dit la durée, et l'habitude",
      "<b>" + hm(9*H) + "</b> — et « d'habitude, 13 min ». Le seuil de cette activité a été déduit de ses "
      + "quatre prières : deux fois son neuvième décile, soit 1 h 08. Personne ne l'a réglé.", true);
    await D.montre(".veille", 3400);
    D.cache();

    /* 6 — les trois portes */
    await D.dit("Trois réponses, jamais une seule",
      "Arrêter maintenant · corriger l'heure de fin si ça s'est arrêté plus tôt · ou dire que ça tourne encore. "
      + "L'app ne ferme <b>rien</b> à ta place.", true);
    await D.montre(D.ligne("Corriger l'heure de fin"), 2600);
    D.cache();

    /* 7 — la réponse, et le silence qui suit */
    await D.dit("« Oui, ça tourne encore »",
      "Tu réponds une fois. La réponse se garde sur le bloc, datée : la question ne reviendra ni au "
      + "rechargement, ni demain, ni après une synchro avec l'autre téléphone.", true);
    await D.tape('a[data-vok]');
    await D.dit("Le compteur tourne toujours, et l'app se tait",
      "Le point du rail est redevenu plein, et rien n'a été arrêté. L'app prévient, puis elle se tait.", true);
    await D.montre("#rail", 3000);
    D.cache();

    /* 8 — le même neuf heures, sur autre chose */
    poseSommeil();
    await D.tape("#rail .tic");
    await D.dit("Les mêmes neuf heures, sur le sommeil",
      "Neuf heures de sommeil : <b>aucune question</b>. Quatre nuits de 5 à 8 heures dans l'archive mettent "
      + "son seuil à seize heures.", true);
    await D.montre(D.ligne("le temps va à") || ".amorce", 3200);
    D.cache();

    /* 9 — pourquoi le type ne pouvait pas décider */
    await D.dit("C'est pour ça que le type ne décide pas",
      "Tu proposais un seuil « selon le type de chose qu'on compte ». Dans ton archive, « Toilette » et "
      + "« Sommeil » portent le même type, et leur neuvième décile commun donne <b>quatorze heures</b> : "
      + "une toilette oubliée tournerait une journée avant un mot. Le seuil vient de la chose, pas de sa famille.");
    await D.pause(2400);

    /* 10 */
    await D.dit("Mesuré sur ta vraie archive",
      "Sur tes 65 blocs fermés, trois auraient été questionnés — dont une nuit de prière de sept heures, "
      + "où la question se répond d'une tape. Et la visite du 7 novembre, ouverte à 8 h et jetée à 13 h 51, "
      + "aurait eu sa question 1 h 50 avant que tu la jettes.");
    await D.pause(1200);
  }

  D.porte({
    k: "v129 · la veille des compteurs",
    titre: "Un compteur oublié ne mesure plus rien",
    phrase: "Dix étapes. La démo écrit dans cette copie du navigateur seulement, et le bouton « Effacer la démo » remet tout à zéro à la fin.",
    bouton: "Commencer",
    n: 10,
    fin: "Voilà la veille.",
    jouer: jouer,
    nettoie: function(){
      db = sane({}); save();
      try{ soVide(); }catch(e){}
      try{ localStorage.removeItem("ebenezer.vues"); }catch(e){}
      render(); majChrono();
    }
  });
})();
