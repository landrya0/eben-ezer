/* Ében-Ézer — sondes
   Ce que l'application coûte en gestes, et là où elle se trompe de porte.

   Sa demande : « ajoute des sondes partout dans l'app pour capter mon
   utilisation et detecter automatiquement là ou il y a trop de gestes, là ou
   on peut optimiser, etc. comprendre quand je me trompe, pourquoi je me suis
   tromper ce qu'on peut améliorer pour éviter ça. et comment acceder à ce que
   je veux faire plus vite » (13.dn).

   « Partout » ne veut pas dire « à chaque bouton ». L'application a trois
   entonnoirs, et ils sont uniques : TOUS les gestes passent par un seul
   écouteur (le 13), toute parole par toast(), toute écriture par save().
   Trois lignes voient donc l'application entière — alors qu'une sonde
   recopiée à trois cents endroits serait trois cents endroits à tenir
   d'accord, et le premier bouton ajouté demain serait aveugle.

   RIEN DE CE QU'IL ÉCRIT N'ENTRE ICI. Une sonde garde le nom du geste et, de
   sa valeur, seulement ce qui ressemble à un mot de code. Un identifiant
   devient « # », tout le reste devient « · ». C'est une liste blanche : un
   attribut ajouté demain est muet par défaut, et non bavard par défaut. Les
   messages de l'application perdent de même ce qu'ils citent de lui.

   ET ÇA NE VIT PAS DANS L'ARCHIVE. L'archive garde ce que Dieu a fait ; les
   sondes mesurent l'outil. Les mettre dans `db` les ferait voyager à la
   synchronisation — or les frictions d'un téléphone ne sont pas celles d'un
   portable —, grossirait chaque sauvegarde, et pousserait `db.maj` à chaque
   effleurement, donc déclencherait une synchronisation par geste. Elles ont
   leur clé, et s'effacent sans toucher une ligne du mémorial.

   Ce fichier fait partie d'une suite chargée DANS L'ORDRE (01, 02, …) par
   index.html, dans une seule portée globale. Ce ne sont pas des modules : on
   ne les importe pas, on les empile. Les sortir de l'ordre casse le
   démarrage. Voir ARCHITECTURE.md. */
"use strict";

const SO_KEY = "ebenezer.sondes";
/* Trois mille gestes : des semaines d'usage, et quelques dizaines de kilos
   d'octets à côté d'une archive qui porte des photos. Au-delà, le plus vieux
   part — une friction d'il y a trois mois a été corrigée ou ne l'intéresse
   plus. */
const SO_MAX = 3000;
const SO_RATES = 60;

let SO = {on:true, g:[], e:[], de:0, prof:0, ecrit:0, ouvert:null, dit:"", sauve:0};

/* Ces attributs-là portent du texte qu'il a écrit : une suggestion est un nom
   d'activité, parfois un nom de personne. Ils ne sont jamais recopiés. */
const SO_TEXTE = {sug:1, sugg:1, tcat:1};
/* La forme d'un identifiant fabriqué par uid() : « n42-ab12cd ». */
const SO_ID = /^[a-z]{1,6}\d+-[a-z0-9]{3,12}$/;
/* La forme d'un mot de code écrit dans le source : « dieu », « moiPrevu ». */
const SO_CODE = /^[a-zA-Z]{1,18}$/;
/* Quel acte il a ouvert ne dit rien sur la friction, et dit beaucoup sur lui.
   Tous les identifiants deviennent donc le même « # » : ça compte les gestes
   sans nommer leur objet. */
function soSauf(k, v){
  v = String(v==null ? "" : v);
  if(!v) return "";
  if(SO_TEXTE[k]) return "·";
  if(SO_ID.test(v)) return "#";
  if(SO_CODE.test(v)) return v;
  if(/^-?\d{1,7}$/.test(v)) return v;
  return "·";
}
/* Ce que l'application dit se garde, mais pas ce qu'elle cite de lui : les
   deux seules formes d'insertion dans le source sont « … » et « Verbe : … ».
   « Arrêté : Prière » devient « Arrêté : … », et les refus se regroupent. */
function soSigne(t){
  let s = String(t==null ? "" : t).replace(/«[^»]*»/g, "«…»");
  s = s.replace(/\s*:\s+\S[\s\S]*$/, " : …");
  /* Les chiffres partent : une page lue, un chapitre, une heure sont à lui.
     Mais une adresse n'est pas un chiffre, et masquée elle n'est plus
     cherchable — « landryan.github.io » n'existe pas, et le raté qui le
     citait était introuvable. On garde donc le chemin d'une URL, amputé de
     sa question : ce qui suit un « ? » peut porter autre chose, et rien ne
     part en clair (13.bh, 13.ed). */
  s = s.split(/(\bhttps?:\/\/\S+)/).map(function(p, i){
    return i%2 ? p.replace(/[?#][\s\S]*$/, "") : p.replace(/\d+/g, "n");
  }).join("");
  return s.length>64 ? s.slice(0,63)+"…" : s;
}

function soLoad(){
  SO.de = Date.now();
  try{
    const r = localStorage.getItem(SO_KEY);
    if(!r) return;
    const o = JSON.parse(r);
    SO.on = o.on !== false;
    SO.g = Array.isArray(o.g) ? o.g.filter(function(x){ return x && typeof x.t==="number"; }).slice(-SO_MAX) : [];
    SO.e = Array.isArray(o.e) ? o.e.filter(function(x){ return x && typeof x.t==="number"; }).slice(-SO_RATES) : [];
    if(typeof o.de==="number" && o.de) SO.de = o.de;
    else if(SO.g.length) SO.de = SO.g[0].t;
  }catch(e){}
}
/* Une sonde ne doit pas peser sur ce qu'elle mesure : écrire dans
   localStorage est synchrone, et le faire à chaque effleurement ferait
   traîner le geste même qu'on observe. On écrit au plus une fois par seconde
   et demie, et pour de bon quand l'écran s'en va. */
function soEcris(force){
  const n = Date.now();
  if(!force && n-SO.ecrit < 1500) return false;
  SO.ecrit = n;
  try{ localStorage.setItem(SO_KEY, JSON.stringify({on:SO.on, de:SO.de, g:SO.g, e:SO.e})); }
  catch(e){ return false; }
  return true;
}
function soVide(){
  SO.g=[]; SO.e=[]; SO.de=Date.now(); SO.prof=0;
  /* Le geste qui efface ne doit pas se retrouver dans ce qu'il vient
     d'effacer : « tout effacer » laisse zéro, sinon le mot est faux. */
  SO.ouvert=null;
  soEcris(true);
}
function soBascule(){ SO.on = !SO.on; SO.ouvert=null; soEcris(true); return SO.on; }
/* Les sondes ne vivent pas dans l'archive, et c'est toujours vrai : elles ne
   se synchronisent pas, ne pèsent pas sur `db.maj`, et s'effacent sans
   toucher une ligne du mémorial. Mais elles doivent pouvoir SORTIR — sinon
   ce que l'application mesure d'elle-même ne quitte jamais le téléphone, et
   ne sert qu'à celui qui l'a déjà sous les yeux. Le fichier les emporte donc
   dans une clé à part : il est un courrier, pas un contenant (13.ec).
   Rien n'est à masquer ici : un geste ne porte déjà qu'un nom de code, « # »
   à la place d'un identifiant et « · » à la place de tout le reste. */
function sondesPartantes(){ return {on:SO.on, de:SO.de, g:SO.g, e:SO.e}; }
function sondesPoids(){ try{ return JSON.stringify(sondesPartantes()).length; }catch(e){ return 0; } }

function soOu(src, lig){
  const f = String(src||"").split("/").pop();
  if(!f) return "";
  return f + (lig ? ":"+lig : "");
}
/* Un raté qu'on ne voit pas est un raté qui revient. Le message et l'endroit
   suffisent à le retrouver dans le source ; ils ne portent pas son journal. */
function soRate(msg, src, lig){
  if(!SO.on) return;
  SO.e.push({t:Date.now(), m:soSigne(msg||"erreur"), o:soOu(src, lig), w:S.view});
  if(SO.e.length>SO_RATES) SO.e = SO.e.slice(-SO_RATES);
  soEcris(true);
}

/* Le crochet que le socle appelle. Il est déclaré là-bas (`let SONDE`) et
   rempli ici : le socle est chargé avant ce fichier et ne peut pas en
   dépendre — l'ordre est porteur. */
SONDE = {
  /* Avant le geste : d'où il part, et combien de gestes depuis l'onglet. */
  ouvre: function(g){
    if(!SO.on){ SO.ouvert=null; return; }
    const ks = Object.keys(g).sort();
    if(!ks.length){ SO.ouvert=null; return; }
    SO.ouvert = {t:Date.now(), k:ks.join("+"), v:soSauf(ks[0], g[ks[0]]), w:S.view};
    SO.dit = ""; SO.sauve = 0;
  },
  /* Après le geste : où il a atterri, s'il a écrit quelque chose, et ce que
     l'application a répondu. Les trois ensemble suffisent à distinguer un
     refus d'une confirmation sans toucher aux trois cents appels à toast() :
     une parole sans écriture, c'est l'application qui a dit non. */
  ferme: function(){
    const o = SO.ouvert; SO.ouvert = null;
    if(!o) return;
    /* La profondeur se remet à zéro sur un onglet : c'est là que tout départ
       commence, et c'est en gestes DEPUIS un onglet que se mesure ce qu'une
       porte coûte. Un retour qui ramène à un onglet se remet donc à zéro
       tout seul.
       Et un retour DÉFAIT un pas, il n'en ajoute pas : compté comme les
       autres, il faisait grandir sans fin la profondeur d'un écran où l'on ne
       fait que repasser en revenant — « Mon argent », à un geste de l'onglet,
       se déclarait ainsi à trois (13.do).
       Enfin, un geste qui NE CHANGE PAS D'ÉCRAN n'est pas un pas : c'est du
       travail dans l'écran, et le chemin pour y venir était déjà parcouru.
       Les onze tapes d'une fiche comptaient pour onze pas ; « Un acte », où
       l'on atterrit en sauvegardant et qui est à deux écrans d'un onglet, se
       déclarait ainsi à dix-huit, et le bilan annonçait « +55 gestes de
       trop » sur une porte qui n'en coûtait que quinze (13.ed). */
    const pas = o.w !== S.view;
    SO.prof = ONGLETS.some(function(x){ return x[0]===S.view; }) ? 0
            : !pas ? SO.prof
            : (o.k==="back" ? Math.max(0, SO.prof-1) : SO.prof+1);
    o.a = S.view; o.d = SO.prof;
    if(SO.sauve) o.s = 1;
    if(SO.dit) o.r = SO.dit;
    SO.g.push(o);
    if(SO.g.length>SO_MAX) SO.g = SO.g.slice(-SO_MAX);
    soEcris();
  },
  dit: function(t){ if(SO.on) SO.dit = soSigne(t); },
  ecrit: function(){ if(SO.on) SO.sauve++; },
  rate: soRate
};

/* ---------- ce que les sondes ont vu ---------- */

/* Les noms d'écrans et la liste de ceux qui tiennent debout seuls vivent
   dans la charpente : les portes épinglées s'en servent aussi, et une table
   recopiée deux fois diverge (13.do). */
function soNom(v){ return nomVue(v); }

/* « go:argent → back:1 » ne se lit pas. Un chemin qu'il faut décoder ne
   sert à personne, pas même à moi. */
function soGesteTxt(x){
  if(x.k==="back") return "Retour";
  if(x.k==="go") return soNom(x.v);
  if(x.k==="act") return x.v || "une action";
  return x.k + (x.v && x.v!=="#" && x.v!=="·" ? " "+x.v : "");
}
function soMed(ds){
  const t = ds.slice().sort(function(a,b){ return a-b; });
  return t[Math.floor(t.length/2)];
}
/* Le prochain écran où il est VRAIMENT arrivé : après un demi-tour, c'est ce
   qu'il cherchait. Un retour ne compte pas pour une arrivée. */
function soApres(g, i){
  for(let j=i; j<g.length && j<i+4; j++){
    if(g[j].a && g[j].a!==g[j].w && g[j].k!=="back") return g[j].a;
  }
  return "";
}

/* Tout se déduit d'une seule liste de gestes : aucune mesure n'est posée à la
   main, et rien n'est à cocher pour que ça marche. */
function soBilan(){
  const g = SO.g;
  const b = {n:g.length, de:SO.de, fin:g.length ? g[g.length-1].t : 0,
             couts:[], tours:[], refus:[], rates:[], chemins:[], morts:[]};

  /* Ce qu'une porte coûte : les gestes qu'il a fallu pour l'atteindre, fois
     le nombre de fois qu'il y est allé, moins le geste qu'elle coûterait si
     elle était à portée. Le chiffre qui sort est en gestes — exactement ceux
     qu'un raccourci lui rendrait. */
  const parVue = {};
  g.forEach(function(x){
    if(!x.a || x.a===x.w || !x.d) return;
    /* Revenir sur un écran n'est pas s'y rendre : ce qu'on mesure, c'est ce
       qu'il en coûte d'y ALLER. */
    if(x.k==="back") return;
    (parVue[x.a] = parVue[x.a] || []).push(x.d);
  });
  Object.keys(parVue).forEach(function(v){
    const ds = parVue[v], med = soMed(ds);
    b.couts.push({v:v, n:ds.length, court:Math.min.apply(null, ds), med:med,
                  poids:ds.length*(med-1)});
  });
  /* Une porte déjà à un geste ne coûte rien : la lister à « +0 » noierait
     les deux lignes qui comptent vraiment.
     Et un chiffre qui accuse doit mener quelque part (13.cb) : cette section
     répond à « comment y aller plus vite », donc elle ne chiffre que les
     portes qu'une épingle peut rapprocher. « Un acte », « Ce bloc », « Une
     activité » attendent qu'on leur désigne d'abord une fiche : on n'y va
     pas, on y atterrit. Les lister promettait un raccourci qui n'existe pas,
     et elles occupaient les trois premières lignes — muettes à la tape, sous
     une phrase qui invite à toucher pour y aller (13.ed). */
  const por = portables();
  b.couts = b.couts.filter(function(c){ return c.poids>0 && por.indexOf(c.v)!==-1; })
    .sort(function(a, z){ return (z.poids-a.poids) || (z.n-a.n); });

  /* Le demi-tour : arrivé quelque part, reparti aussitôt sans rien écrire.
     C'est la trace exacte de « je me suis trompé de porte » — et l'écran où
     il arrive juste après dit ce qu'il cherchait. */
  const tours = {};
  for(let i=0; i<g.length-1; i++){
    const x = g[i], y = g[i+1];
    if(!x.a || x.a===x.w || x.s) continue;
    /* Un onglet n'est pas une porte où l'on se trompe, c'est un carrefour :
       on y passe, et repartir d'un carrefour n'est pas une erreur. */
    if(ONGLETS.some(function(o){ return o[0]===x.a; })) continue;
    if(y.t-x.t > 6000 || y.s) continue;
    const repart = y.k==="back" || (y.k==="go" && ONGLETS.some(function(o){ return o[0]===y.v; }));
    if(!repart) continue;
    const e = (tours[x.a] = tours[x.a] || {v:x.a, n:0, vers:{}});
    e.n++;
    const d = soApres(g, i+2);
    if(d && d!==x.a) e.vers[d] = (e.vers[d]||0)+1;
  }
  b.tours = Object.keys(tours).map(function(v){
    const e = tours[v];
    e.suite = Object.keys(e.vers).map(function(d){ return {v:d, n:e.vers[d]}; })
      .sort(function(a, z){ return z.n-a.n; });
    return e;
  }).sort(function(a, z){ return z.n-a.n; });

  /* Un refus : l'application a parlé et rien n'a été écrit. Le même refus,
     cinq fois sur le même écran, ne dit pas qu'il est distrait — il dit que
     l'écran ne demande pas clairement ce qu'il attend. */
  const rf = {};
  g.forEach(function(x){
    if(!x.r || x.s) return;
    const c = x.r+"@"+x.w;
    if(!rf[c]) rf[c] = {r:x.r, w:x.w, n:0, der:0};
    rf[c].n++; rf[c].der = x.t;
  });
  b.refus = Object.keys(rf).map(function(c){ return rf[c]; })
    .sort(function(a, z){ return z.n-a.n; });

  /* Les ratés : regroupés, parce qu'un bug se répète. */
  const rt = {};
  SO.e.forEach(function(x){
    const c = x.m+"@"+x.o;
    if(!rt[c]) rt[c] = {m:x.m, o:x.o, w:x.w, n:0, der:0};
    rt[c].n++; rt[c].der = x.t;
  });
  b.rates = Object.keys(rt).map(function(c){ return rt[c]; })
    .sort(function(a, z){ return z.n-a.n; });

  /* Le chemin le plus usé : trois gestes de suite, partis d'un onglet. Un
     trajet refait vingt fois est un bouton qui manque. */
  const ch = {};
  for(let i=0; i+2<g.length; i++){
    if(g[i].d!==1) continue;
    const suite = [g[i], g[i+1], g[i+2]].map(soGesteTxt).join(" → ");
    if(!ch[suite]) ch[suite] = {suite:suite, n:0, a:g[i+2].a};
    ch[suite].n++;
  }
  b.chemins = Object.keys(ch).map(function(c){ return ch[c]; })
    .filter(function(x){ return x.n>=3; })
    .sort(function(a, z){ return z.n-a.n; });

  /* Et les écrans jamais ouverts : du travail qui ne sert à personne, ou une
     porte que personne ne trouve. L'un des deux, et il faut aller voir. */
  /* Le geste en cours n'est pas encore dans la liste quand l'écran se
     dessine : sans cette ligne, « Comment je m'en sers » se déclarerait
     jamais ouvert à celui qui le lit. */
  const vus = {};
  if(S.view) vus[S.view] = 1;
  g.forEach(function(x){ if(x.w) vus[x.w]=1; if(x.a) vus[x.a]=1; });
  b.morts = Object.keys(VUES).filter(function(v){ return !vus[v]; });

  return b;
}

/* La ligne des Réglages dit déjà l'essentiel : combien ça coûte, et si ça
   mesure. Un réglage qu'il faut ouvrir pour savoir où il en est fait faire un
   aller-retour pour rien (13.cg). */
function soEtat(){
  if(!SO.on) return "Arrêté";
  const b = soBilan();
  if(!b.n) return "Rien encore mesuré";
  const c = b.couts[0];
  if(c && c.poids) return c.poids+" gestes de trop sur « "+soNom(c.v)+" »";
  return b.n+" geste"+(b.n>1?"s":"")+" mesuré"+(b.n>1?"s":"");
}
function soDepuis(b){
  if(!b.n) return "";
  const j = Math.max(1, Math.round((Date.now()-b.de)/86400000));
  return b.n+" geste"+(b.n>1?"s":"")+" sur "+j+" jour"+(j>1?"s":"");
}
function soLigneCout(c){
  const bout = c.med===c.court ? c.med+" geste"+(c.med>1?"s":"")
             : c.court+" à "+c.med+" gestes";
  /* `data-go` sans condition : le bilan ne retient plus que des portes
     épinglables, donc toutes se tiennent debout seules. Le test de `SEULES`
     qui était ici ne protégeait rien et laissait croire qu'une ligne muette
     était permise (13.ed). */
  return ligne({titre:esc(soNom(c.v)),
    sous:c.n+" fois · "+bout,
    apres:c.poids ? `<b>+${c.poids}</b>` : "",
    attr:`data-go="${c.v}"`});
}

/* L'application propose, elle n'épingle pas à sa place (13.bc).

   Les deux chemins se comparent sans tricher, parce qu'ils paient la même
   chose pour commencer : le bouton du milieu est dans le rail, exactement
   comme un onglet, et l'un et l'autre sont là sur tous les écrans. Une porte
   épinglée est donc à UN geste du rail, comme un onglet l'est de n'importe
   où. `med` compte les gestes après le rail : le gain par visite est
   `med − 1`, ce qui est précisément le chiffre de la colonne de droite. En
   proposer une qui est déjà à un geste serait promettre un gain de rien, et
   un chiffre faux est pire que pas de chiffre (13.do). */
function soPropose(b){
  const c = b.couts.filter(function(x){
    return x.med>=2 && portables().indexOf(x.v)!==-1 && !porteEp(x.v);
  })[0];
  if(!c) return "";
  return liste(ligne({titre:"Mettre « "+esc(nomVue(c.v))+" » sous le pouce",
    sous:(c.med+1)+" gestes aujourd'hui, 2 depuis n'importe où",
    attr:'data-eppo="'+c.v+'"'}), "lien");
}

function vSondes(){
  Z.titre = "Comment je m'en sers"; Z.retour = true;
  const b = soBilan();
  let h = `<div class="block amorce" style="margin-top:16px">`;
  if(!SO.on){
    h += `Les sondes sont <b>arrêtées</b>. Rien ne se mesure.`;
  }else if(!b.n){
    h += `Rien encore. Sers-toi de l'application ; elle compte les gestes, et revient ici te dire lesquels étaient de trop.`;
  }else{
    h += `<b>${esc(soDepuis(b))}</b>. Les sondes gardent le nom du geste et l'écran, jamais un mot de ce que tu écris.`;
  }
  h += `</div>`;

  if(SO.on && b.n){
    /* Ce qui coûte, d'abord : c'est la réponse à « comment y aller plus
       vite », et chaque ligne EST le raccourci — on y va d'ici. */
    if(b.couts.length){
      h += titreBloc("Ce qui te coûte le plus");
      h += `<div class="block amorce">Le chiffre de droite, ce sont les gestes qu'une épingle t'aurait rendus. Touche une ligne pour y aller tout de suite.</div>`;
      h += liste(b.couts.slice(0,7).map(soLigneCout).join(""), "lien");
      h += soPropose(b);
    }
    if(b.tours.length){
      h += titreBloc("Les demi-tours","ecart");
      h += `<div class="block amorce">Arrivé là, reparti en moins de six secondes sans rien écrire : le temps de voir que ce n'était pas la bonne porte. L'écran suivant dit ce que tu cherchais.</div>`;
      h += liste(b.tours.slice(0,6).map(function(t){
        const v = t.suite[0];
        return ligne({titre:esc(soNom(t.v)),
          sous: v ? "tu allais à "+esc(soNom(v.v)) : "reparti sans aller ailleurs",
          apres:`<b>${t.n}</b>`});
      }).join(""));
    }
    if(b.refus.length){
      h += titreBloc("Ce que l'app a refusé","ecart");
      h += `<div class="block amorce">Elle a parlé, et rien ne s'est écrit. Le même refus plusieurs fois au même endroit, c'est l'écran qui demande mal — pas toi qui lis mal.</div>`;
      h += liste(b.refus.slice(0,8).map(function(r){
        return ligne({titre:esc(r.r), sous:esc(soNom(r.w)), apres:`<b>${r.n}</b>`});
      }).join(""));
    }
    if(b.chemins.length){
      h += titreBloc("Le chemin le plus usé","ecart");
      h += `<div class="block amorce">Trois gestes refaits à l'identique depuis un onglet. Un trajet repris souvent est un bouton qui manque.</div>`;
      h += liste(b.chemins.slice(0,4).map(function(c){
        return ligne({titre:esc(c.suite), sous:c.a ? "mène à "+esc(soNom(c.a)) : "",
                      apres:`<b>${c.n}</b>`});
      }).join(""));
    }
  }

  if(b.rates.length){
    h += titreBloc("Les ratés","ecart");
    h += `<div class="block amorce">L'application a trébuché sans rien dire. Montre-moi ces lignes : c'est là qu'il y a un bug.</div>`;
    h += liste(b.rates.slice(0,6).map(function(r){
      return ligne({titre:esc(r.m),
                    sous:[r.o, soNom(r.w)].filter(Boolean).map(esc).join(" · "),
                    apres:`<b>${r.n}</b>`});
    }).join(""));
  }

  if(SO.on && b.n && b.morts.length){
    h += titreBloc("Jamais ouvert","ecart");
    h += `<div class="block amorce">Du travail qui ne sert à personne, ou une porte que tu ne trouves pas. Il faut aller voir lequel des deux.</div>`;
    h += liste(ligne({titre:esc(b.morts.map(soNom).join(", "))}));
  }

  h += titreBloc("Les sondes","ecart");
  h += liste(
    ligne({titre:"Mesurer mes gestes",
           sous:"Sur cet appareil seulement — rien ne part, rien n'entre dans l'archive",
           apres:`<b>${SO.on?"Oui":"Non"}</b>`, attr:'data-act="soBascule"'})
    + ligne({titre:`<span class="rouge">Tout effacer</span>`,
             sous:"Les mesures, pas ton journal", attr:'data-act="soVider"'}), "lien");
  Z.html = h;
}

VUES.sondes = vSondes;

/* Les ratés silencieux sont la moitié des bugs : une erreur de script laisse
   l'écran tel quel, et c'est tout ce qu'il en voit. */
soLoad();
try{
  window.addEventListener("error", function(ev){
    soRate(ev && ev.message, ev && ev.filename, ev && ev.lineno);
  });
  window.addEventListener("unhandledrejection", function(ev){
    const r = ev && ev.reason;
    soRate(r && r.message ? r.message : String(r), "promesse", 0);
  });
  window.addEventListener("pagehide", function(){ soEcris(true); });
  document.addEventListener("visibilitychange", function(){
    if(document.hidden) soEcris(true);
  });
}catch(e){}
