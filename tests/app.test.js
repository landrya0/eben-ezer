/* La batterie.
 *
 *   node --test tests/
 *
 * Chaque test porte le numéro de la règle qu'il défend. Un test qui casse
 * doit donc d'abord renvoyer à la spec : ou bien le code a dérivé, ou bien
 * la règle a changé et le test doit changer avec elle — jamais en silence.
 */
"use strict";
const { test } = require("node:test");
const A = require("node:assert/strict");
const { charge, MIN, H, j, jour, bloc } = require("./harnais.js");

/* Midi, le 8 novembre 2026 : l'heure de référence de toute la batterie. */
const MIDI = j(12, 0);

function app(maintenant) {
  const a = charge({ maintenant: maintenant === undefined ? MIDI : maintenant });
  a.vide();
  return a;
}
function deuxActivites(a) {
  a.db.taches = [
    { id: "a1", nom: "Lecture de la Parole", cat: "dieu", maj: 1 },
    { id: "a2", nom: "Prière", cat: "dieu", maj: 1 }
  ];
}
/* « 8h00→9h30 », pour que l'échec se lise sans décoder des millisecondes. */
function dit(b) {
  const q = function (ms) {
    const d = new Date(ms);
    return d.getHours() + "h" + String(d.getMinutes()).padStart(2, "0");
  };
  return q(b.deb) + "→" + (typeof b.fin === "number" ? q(b.fin) : "en cours");
}
/* Les tableaux rendus par l'application naissent dans le bac à sable : leur
   prototype n'est pas celui d'ici, et `deepEqual` les refuse pour cette seule
   raison. On recopie donc dans un tableau de chez nous. */
function etat(a) {
  const out = [];
  (a.db.temps || []).forEach(function (b) { out.push(b); });
  out.sort(function (x, y) { return x.deb - y.deb; });
  return out.map(function (b) { return b.t + " " + dit(b); });
}

/* ========================================================================
   13.bi — corriger un bloc ne touche qu'à ce bloc
   ======================================================================== */

test("13.bi — raccourcir un bloc par son début laisse un creux, et ne rallonge pas le voisin", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", j(8, 0), j(9, 0)), bloc("b2", "a2", j(9, 0), j(10, 0))];

  const b2 = a.f.blocT("b2");
  a.ouvreBloc(b2);
  a.poseHeure("bDeb", j(9, 30));
  a.actions.majBloc();

  A.deepEqual(etat(a), ["a1 8h00→9h00", "a2 9h30→10h00"],
    "la lecture n'a pas duré une demi-heure de plus parce que la prière a commencé plus tard");
  A.equal(a.f.cumul(j(8, 0), j(10, 0)).tot, 90 * MIN,
    "la demi-heure rendue n'est comptée à personne : c'est un creux");
});

test("13.bi — raccourcir un bloc par sa fin laisse un creux, et n'avance pas le suivant", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", j(8, 0), j(9, 0)), bloc("b2", "a2", j(9, 0), j(10, 0))];

  const b1 = a.f.blocT("b1");
  a.ouvreBloc(b1);
  a.poseHeure("bFin", j(8, 30));
  a.actions.majBloc();

  A.deepEqual(etat(a), ["a1 8h00→8h30", "a2 9h00→10h00"]);
});

test("13.bi — allonger un bloc ne rogne pas le voisin : les deux se recouvrent", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", j(8, 0), j(9, 0)), bloc("b2", "a2", j(9, 0), j(10, 0))];

  const b2 = a.f.blocT("b2");
  a.ouvreBloc(b2);
  a.poseHeure("bDeb", j(8, 30));
  a.actions.majBloc();

  A.deepEqual(etat(a), ["a1 8h00→9h00", "a2 8h30→10h00"],
    "si la lecture doit s'arrêter plus tôt, c'est au disciple de le dire sur son bloc");
  A.equal(a.f.cumul(j(8, 0), j(10, 0)).tot, 2 * H,
    "la demi-heure menée de front ne compte qu'une fois dans la journée");
});

test("13.bi — un voisin ne change jamais d'heure de mise à jour", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", j(8, 0), j(9, 0)), bloc("b2", "a2", j(9, 0), j(10, 0))];
  const majAvant = a.f.blocT("b1").maj;

  const b2 = a.f.blocT("b2");
  a.ouvreBloc(b2);
  a.poseHeure("bDeb", j(9, 15));
  a.actions.majBloc();

  A.equal(a.f.blocT("b1").maj, majAvant,
    "un voisin intact ne doit pas repartir en synchro comme s'il avait changé");
});

test("13.bi — un bloc en cours se corrige sans fin, et reste en cours", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", j(11, 0), null)];

  const b1 = a.f.blocT("b1");
  a.ouvreBloc(b1);
  a.poseHeure("bDeb", j(10, 30));
  a.actions.majBloc();

  const apres = a.f.blocT("b1");
  A.equal(apres.deb, j(10, 30));
  A.equal(apres.fin, undefined, "corriger le début n'a pas fermé le bloc");
});

test("13.cj — rouvrir l'écran et garder sans rien toucher ne change rien", () => {
  const a = app();
  deuxActivites(a);
  /* Des secondes, que le champ du téléphone ne sait pas afficher. */
  const deb = j(8, 0) + 17000, fin = j(9, 0) + 43000;
  a.db.temps = [bloc("b1", "a1", deb, fin)];

  a.ouvreBloc(a.f.blocT("b1"));
  a.actions.majBloc();

  const b = a.f.blocT("b1");
  A.equal(b.deb, deb, "les secondes du début n'ont pas été arasées");
  A.equal(b.fin, fin, "ni celles de la fin");
});

/* ========================================================================
   13.by / 13.bx — la journée est l'union, jamais la somme
   ======================================================================== */

test("13.by — deux activités de front comptent une fois dans le total, deux fois en part", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", j(8, 0), j(10, 0)), bloc("b2", "a2", j(9, 0), j(11, 0))];

  const c = a.f.cumul(j(8, 0), j(11, 0));
  A.equal(c.tot, 3 * H, "de 8 h à 11 h, il s'est écoulé trois heures, pas quatre");
  A.equal(c.porte, 4 * H, "mais quatre heures d'activité ont bien été portées");
  A.equal(c.par.a1, 2 * H);
  A.equal(c.par.a2, 2 * H);
});

test("13.by — un bloc à cheval sur minuit ne donne à chaque jour que sa part", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", jour(7, 23, 0), jour(8, 1, 0))];

  const veille = a.f.bornes("jour", jour(7, 12, 0));
  const jourJ = a.f.bornes("jour", jour(8, 12, 0));
  A.equal(a.f.cumul(veille[0], veille[1]).tot, H, "une heure avant minuit");
  A.equal(a.f.cumul(jourJ[0], jourJ[1]).tot, H, "une heure après");
});

test("13.ch / 13.ci — un temps bref se dit en secondes, jamais « 0 min »", () => {
  const a = app();
  A.equal(a.f.hm(30000), "30 s");
  A.equal(a.f.hm(1000), "1 s");
  A.equal(a.f.hm(60000), "1 min");
  A.equal(a.f.hm(90 * MIN), "1 h 30");
  A.equal(a.f.hm(2 * H), "2 h");
});

/* ========================================================================
   13.cl — les fenêtres du calendrier
   ======================================================================== */

test("13.cl — la semaine commence un lundi", () => {
  const a = app();
  /* Le 8 novembre 2026 est un dimanche : sa semaine part du lundi 2. */
  const b = a.f.bornes("sem", j(12, 0));
  A.equal(new Date(b[0]).getDay(), 1, "elle commence un lundi");
  A.equal(new Date(b[0]).getDate(), 2);
  A.equal(b[1] - b[0], 7 * 24 * H);
});

test("13.cl — on recule et on avance d'un cran, par-dessus les mois et les ans", () => {
  const a = app();
  const mois = a.f.bornes("mois", j(12, 0))[0];
  const avant = a.f.decale("mois", mois, -1);
  A.equal(new Date(avant).getMonth(), 9, "octobre");
  A.equal(new Date(avant).getDate(), 1);

  const janvier = a.f.bornes("mois", new Date(2026, 0, 15).getTime())[0];
  const decembre = a.f.decale("mois", janvier, -1);
  A.equal(new Date(decembre).getFullYear(), 2025);
  A.equal(new Date(decembre).getMonth(), 11);

  A.equal(a.f.decale("mois", avant, 1), mois, "et l'on revient d'où l'on vient");
});

test("13.cl — la fenêtre d'aujourd'hui s'arrête maintenant ; une fenêtre passée va jusqu'à sa fin", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", jour(7, 8, 0), jour(7, 9, 0))];
  a.S.per = "jour";

  a.S.anc = null;
  const f = a.f.fenetre();
  A.equal(f.t1, MIDI, "on ne compte pas les heures qui n'ont pas eu lieu");
  A.equal(f.ici, true);
  A.equal(f.apres, false, "il n'y a pas de jour après aujourd'hui");

  a.S.anc = a.f.bornes("jour", jour(7, 12, 0))[0];
  const h = a.f.fenetre();
  A.equal(h.t1, a.f.bornes("jour", jour(7, 12, 0))[1], "hier s'est fermé sur sa propre fin");
  A.equal(h.ici, false);
  A.equal(h.apres, true);
  A.equal(h.avant, false, "on ne remonte pas avant le premier bloc de l'archive");
});

test("13.cl — « Tout » part du premier bloc et n'a ni avant ni après", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", jour(3, 8, 0), jour(3, 9, 0))];
  a.S.per = "tout"; a.S.anc = null;

  const f = a.f.fenetre();
  A.equal(f.t0, jour(3, 8, 0));
  A.equal(f.avant, false);
  A.equal(f.apres, false);
  A.equal(f.court, "Tout");
});

/* ========================================================================
   13.cf — réunir ne perd jamais une minute
   ======================================================================== */

test("13.cf — deux morceaux collés de la même activité n'en font qu'un", () => {
  const a = app();
  deuxActivites(a);
  const out = a.f.fusionTemps([
    bloc("b1", "a1", j(8, 0), j(9, 0)),
    bloc("b2", "a1", j(9, 0), j(10, 0))
  ]);
  A.equal(out.length, 1);
  A.equal(out[0].deb, j(8, 0));
  A.equal(out[0].fin, j(10, 0));
});

test("13.cf — la réunion garde les deux notes et les deux lectures", () => {
  const a = app();
  deuxActivites(a);
  const out = a.f.fusionTemps([
    bloc("b1", "a1", j(8, 0), j(9, 0), { note: "au lever", lu: [["jean", 1, 3]] }),
    bloc("b2", "a1", j(9, 0), j(10, 0), { note: "et encore après", lu: [["jean", 4, 5]] })
  ]);
  A.equal(out.length, 1);
  A.match(out[0].note, /au lever/);
  A.match(out[0].note, /et encore après/);
  A.equal(out[0].lu.length, 2, "aucun chapitre n'est tombé dans la réunion");
});

test("13.cf — deux activités différentes qui se touchent ne fusionnent pas", () => {
  const a = app();
  deuxActivites(a);
  const out = a.f.fusionTemps([
    bloc("b1", "a1", j(8, 0), j(9, 0)),
    bloc("b2", "a2", j(9, 0), j(10, 0))
  ]);
  A.equal(out.length, 2);
});

test("13.cf — un bloc en cours ne mange jamais ce qui le suit", () => {
  const a = app();
  deuxActivites(a);
  const liste = [
    bloc("b1", "a1", j(7, 0), null),
    bloc("b2", "a1", j(9, 0), j(10, 0))
  ];
  const avant = a.f.couvert(liste);
  const out = a.f.fusionTemps(liste);
  A.ok(a.f.couvert(out) >= avant, "une réunion ne perd jamais une minute");
});

/* ========================================================================
   13.bd / 13.be — deux appareils, une archive
   ======================================================================== */

test("13.bd — à la fusion, c'est la dernière parole qui vaut", () => {
  const a = app();
  const A1 = a.f.sane({ taches: [{ id: "a1", nom: "Prière", cat: "dieu", maj: 100 }] });
  const B1 = a.f.sane({ taches: [{ id: "a1", nom: "La prière seul", cat: "dieu", maj: 200 }] });
  const out = a.f.fusionne(A1, B1);
  A.equal(out.taches.length, 1);
  A.equal(out.taches[0].nom, "La prière seul");
});

test("13.be — une pierre tombale empêche la résurrection", () => {
  const a = app();
  const A1 = a.f.sane({ taches: [], morts: { a1: 300 } });
  const B1 = a.f.sane({ taches: [{ id: "a1", nom: "Prière", cat: "dieu", maj: 200 }] });
  A.equal(a.f.fusionne(A1, B1).taches.length, 0,
    "l'autre appareil ne l'avait pas encore effacée : elle reste morte");

  /* Mais une fiche retouchée APRÈS sa mort revient : la dernière parole vaut. */
  const C = a.f.sane({ taches: [{ id: "a1", nom: "Prière", cat: "dieu", maj: 400 }] });
  A.equal(a.f.fusionne(A1, C).taches.length, 1);
});

test("13.bd — la fusion réunit aussi les auteurs et les livres", () => {
  const a = app();
  const A1 = a.f.sane({ auteurs: [{ id: "u1", nom: "Theodore Andoseh", maj: 1 }], livres: [] });
  const B1 = a.f.sane({ auteurs: [], livres: [{ id: "l1", nom: "Une voix pour le réveil", a: "u1", maj: 1 }] });
  const out = a.f.fusionne(A1, B1);
  A.equal(out.auteurs.length, 1);
  A.equal(out.livres.length, 1);
});

/* ========================================================================
   13.cm / 13.cn / 13.cq — les seize routines
   ======================================================================== */

test("13.cm — le nom d'une activité donne un premier avis sur sa routine", () => {
  const a = app();
  A.equal(a.f.discDeNom("Lecture de la Parole"), "parole");
  A.equal(a.f.discDeNom("Évangélisation de rue"), "ames");
  A.equal(a.f.discDeNom("Nuit de prière"), "ensemble");
  A.equal(a.f.discDeNom("Prière du matin"), "priere");
  A.equal(a.f.discDeNom("Jeûne"), "jeune");
  A.equal(a.f.discDeNom("RDQD"), "rdqd");
  A.equal(a.f.discDeNom("Trajet"), "", "et il se tait quand il ne sait pas");
});

test("13.cn — l'avis du nom cède devant ce que le disciple a posé", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Prière du matin", cat: "dieu", d: "rdqd", maj: 1 }];
  A.equal(a.f.discTache("a1"), "rdqd",
    "le champ posé à la main vaut mieux qu'une devinette qui revient");

  a.db.taches.push({ id: "a2", nom: "Prière du soir", cat: "dieu", maj: 1 });
  A.equal(a.f.discTache("a2"), "priere", "et sans champ, c'est le nom qui parle");
});

test("13.cq — la routine propose une mesure, le support peut la refuser", () => {
  const a = app();
  A.equal(a.f.mesureProposee("litt"), "livre");
  A.equal(a.f.mesureProposee("parole"), "bible");
  /* La prière comptait autrefois le temps et rien d'autre. Elle compte
     maintenant les sujets nommés (13.de) — mais toutes les routines ne
     comptent pas quelque chose de plus, et c'est ce que ce test garde. */
  A.equal(a.f.mesureProposee("priere"), "sujets");
  A.equal(a.f.mesureProposee("eglise"), "",
    "être membre fidèle d'une église ne se compte qu'en temps");

  a.db.taches = [
    { id: "a1", nom: "Un livre", cat: "dieu", d: "litt", maj: 1 },
    { id: "a2", nom: "Enseignements de TA", cat: "dieu", d: "litt", m: 0, maj: 1 }
  ];
  A.equal(a.f.mesureProposee(a.f.discTache("a2")), "livre");
  A.equal(a.db.taches[1].m, 0,
    "une vidéo est de la littérature chrétienne et n'a pas de pages");
});

test("13.cp — chaque routine rend ce qu'elle compte en propre", () => {
  const a = app();
  a.db.taches = [
    { id: "a1", nom: "Lecture de la Parole", cat: "dieu", d: "parole", maj: 1 },
    { id: "a2", nom: "Lecture d'un livre", cat: "dieu", d: "litt", maj: 1 }
  ];
  a.db.livres = [{ id: "l1", nom: "Une voix pour le réveil", pages: 200, maj: 1 }];
  a.db.temps = [
    bloc("b1", "a1", j(8, 0), j(9, 0), { lu: [["jean", 1, 3]] }),
    bloc("b2", "a2", j(9, 0), j(10, 0), { pg: [["l1", 10, 29]] })
  ];
  const t0 = j(0, 0), t1 = j(23, 59);
  A.equal(a.f.mesureDisc("parole", t0, t1), "3 chapitres");
  A.equal(a.f.mesureDisc("litt", t0, t1), "20 pages");
  A.equal(a.f.mesureDisc("priere", t0, t1), "", "une routine sans mesure propre se tait");
});

/* ========================================================================
   13.cr / 13.ct — les auteurs
   ======================================================================== */

test("13.cr — un auteur déjà connu n'est pas créé deux fois, quelle que soit la casse", () => {
  const a = app();
  const u = a.f.auteurId("Theodore Andoseh");
  A.equal(a.f.auteurId("theodore andoseh"), u);
  A.equal(a.f.auteurId("  Theodore Andoseh  "), u);
  A.equal(a.db.auteurs.length, 1);
});

test("13.cr — un nom tapé en minuscules reprend ses majuscules, un nom déjà écrit reste tel quel", () => {
  const a = app();
  A.equal(a.f.capNom("theodore andoseh"), "Theodore Andoseh");
  A.equal(a.f.capNom("jean-marc o'brien"), "Jean-Marc O'Brien");
  A.equal(a.f.capNom("Theodore ANDOSEH"), "Theodore ANDOSEH", "on ne corrige pas qui a déjà choisi");
  A.equal(a.f.capNom("  watchman   nee  "), "Watchman Nee");
});

test("13.cr — ce qu'on reçoit d'un auteur vient du livre comme de la vidéo", () => {
  const a = app();
  const u = a.f.auteurId("Theodore Andoseh");
  a.db.livres = [{ id: "l1", nom: "Une voix pour le réveil", pages: 200, a: u, maj: 1 }];
  a.db.taches = [
    { id: "a1", nom: "Lecture", cat: "dieu", d: "litt", maj: 1 },
    { id: "a2", nom: "Enseignements de TA", cat: "dieu", d: "litt", m: 0, au: u, maj: 1 }
  ];
  a.db.temps = [
    bloc("b1", "a1", j(8, 0), j(9, 0), { pg: [["l1", 1, 48]] }),
    bloc("b2", "a2", j(10, 0), j(11, 0))
  ];
  const r = a.f.recuDe(u);
  A.equal(r.livres.length, 1);
  A.equal(r.pages, 48);
  A.equal(r.ms, 2 * H, "l'heure de lecture et l'heure de vidéo comptent toutes deux");
});

test("13.ct — réunir deux fiches d'auteur transporte tout et ne perd rien", () => {
  const a = app();
  const vieux = a.f.auteurId("T. Andoseh");
  const vrai = a.f.auteurId("Theodore Andoseh");
  a.db.livres = [{ id: "l1", nom: "Une voix pour le réveil", a: vieux, maj: 1 }];
  a.db.taches = [{ id: "a1", nom: "Enseignements", cat: "dieu", d: "litt", m: 0, au: vieux, maj: 1 }];

  a.S.auId = vieux;
  a.ctx.document.getElementById("auFus").value = vrai;
  a.actions.auReunir();

  A.equal(a.db.auteurs.length, 1, "la fiche en double a disparu");
  A.equal(a.db.auteurs[0].id, vrai);
  A.equal(a.db.livres[0].a, vrai, "le livre a suivi");
  A.equal(a.db.taches[0].au, vrai, "et ce qu'on suit de lui aussi");
  A.ok(a.db.morts[vieux], "une pierre tombale, pour que la synchro ne la ramène pas");
});

/* ========================================================================
   Le chargement lui-même
   ======================================================================== */

test("une archive vide se charge et ne compte rien", () => {
  const a = app();
  const c = a.f.cumul(j(0, 0), j(23, 59));
  A.equal(c.tot, 0);
  A.equal(c.porte, 0);
});

test("sane() rend toujours les listes attendues, même d'un fichier abîmé", () => {
  const a = app();
  const d = a.f.sane({ temps: "n'importe quoi", taches: null });
  ["nodes", "taches", "temps", "livres", "auteurs"].forEach(function (k) {
    A.ok(Array.isArray(d[k]), k + " doit être une liste");
  });
});

/* ========================================================================
   13.cw — un temps mis à part : une période, pas un bloc
   ======================================================================== */

test("13.cw — une période ne pèse aucune heure : elle n'entre ni dans le total ni dans les parts", () => {
  const a = app();
  deuxActivites(a);
  /* Une retraite de deux jours, et une heure de prière dedans. */
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];
  a.db.temps = [bloc("b1", "a2", j(9, 0), j(10, 0))];

  const c = a.f.cumul(j(0, 0), MIDI);
  A.equal(c.tot, H, "la journée compte l'heure de prière, pas les douze heures de retraite");
  A.equal(c.par.retraite, undefined, "une période n'a pas de part");
  A.equal(Object.keys(c.par).length, 1);
});

test("13.cw — ce qu'on a donné dedans se compte, lui, et se range par routine", () => {
  const a = app();
  a.db.taches = [
    { id: "a1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 },
    { id: "a2", nom: "Lecture de la Parole", cat: "dieu", d: "parole", maj: 1 }
  ];
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];
  a.db.temps = [
    bloc("b1", "a1", jour(7, 8, 0), jour(7, 12, 0)),
    bloc("b2", "a2", j(9, 0), j(11, 0)),
    /* Avant la retraite : ne doit pas y entrer. */
    bloc("b3", "a1", jour(6, 8, 0), jour(6, 9, 0))
  ];
  const pr = a.f.periode("p1");
  const c = a.f.cumulPer(pr);
  A.equal(c.tot, 6 * H, "quatre heures de prière et deux de Parole, dedans");
  const pd = a.f.parDisc(c.par);
  A.equal(pd.priere, 4 * H);
  A.equal(pd.parole, 2 * H);
});

test("13.cw — une période ouverte dure jusqu'à maintenant et se dit en jours", () => {
  const a = app();
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];
  const pr = a.f.periode("p1");
  A.equal(a.f.perOuverte(pr), true);
  A.equal(a.f.finPer(pr), MIDI, "tant qu'elle n'est pas close, elle court jusqu'à maintenant");
  A.equal(a.f.dureePer(pr), "1 jour 5 h");
  A.match(a.f.perTxt(pr), /depuis hier à 7 h 00/);
});

test("13.cw — sous un jour, elle se dit en heures ; le jeûne y trouve son compte", () => {
  const a = app();
  a.db.periodes = [{ id: "p1", d: "jeune", deb: j(0, 0), fin: j(18, 0), maj: 1 }];
  A.equal(a.f.dureePer(a.f.periode("p1")), "18 h");
  A.equal(a.f.perOuverte(a.f.periode("p1")), false);
});

test("13.cw — on la commence, on la date en arrière, et personne ne la referme à ta place", () => {
  const a = app();
  a.actions.perNeuve();
  a.ctx.document.getElementById("pdDisc").value = "retraite";
  a.poseHeure("pdDeb", jour(7, 7, 0));
  a.actions.perCommencer();

  A.equal(a.db.periodes.length, 1);
  const pr = a.db.periodes[0];
  A.equal(pr.d, "retraite");
  A.equal(pr.deb, jour(7, 7, 0), "datée d'hier, pas de maintenant");
  A.equal(a.f.perOuverte(pr), true, "elle reste ouverte tant qu'on ne la ferme pas");

  /* Et la fermer est un geste, pas une conséquence. */
  a.ouvrePeriode(pr);
  a.actions.perCours();
  A.equal(a.f.perOuverte(a.f.periode(pr.id)), false);
});

test("13.cw — un début à venir est refusé", () => {
  const a = app();
  a.actions.perNeuve();
  a.ctx.document.getElementById("pdDisc").value = "jeune";
  a.poseHeure("pdDeb", jour(9, 7, 0));
  a.actions.perCommencer();
  A.equal(a.db.periodes.length, 0);
});

test("13.cw — effacer une période pose une pierre tombale", () => {
  const a = app();
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];
  a.S.perId = "p1";
  a.actions.perEffacer();
  A.equal(a.db.periodes.length, 0);
  A.ok(a.db.morts.p1, "sinon l'autre appareil la ramènerait");
});

test("13.cw — les périodes voyagent à la synchronisation", () => {
  const a = app();
  const A1 = a.f.sane({ periodes: [{ id: "p1", d: "retraite", deb: 100, maj: 100 }] });
  const B1 = a.f.sane({ periodes: [{ id: "p1", d: "retraite", deb: 100, fin: 500, maj: 200 }] });
  const out = a.f.fusionne(A1, B1);
  A.equal(out.periodes.length, 1);
  A.equal(out.periodes[0].fin, 500, "l'appareil qui l'a close a parlé en dernier");
});

test("13.cw — seules les périodes qui touchent la fenêtre sont montrées, les ouvertes d'abord", () => {
  const a = app();
  a.db.periodes = [
    { id: "p1", d: "jeune", deb: jour(1, 6, 0), fin: jour(1, 18, 0), maj: 1 },
    { id: "p2", d: "retraite", deb: jour(7, 7, 0), maj: 1 }
  ];
  const jourJ = a.f.bornes("jour", MIDI);
  const vus = a.f.perDans(jourJ[0], jourJ[1]).map(function (x) { return x.id; });
  A.deepEqual(Array.from(vus), ["p2"], "le jeûne du 1er ne touche pas aujourd'hui");

  const mois = a.f.bornes("mois", MIDI);
  const tous = a.f.perDans(mois[0], mois[1]).map(function (x) { return x.id; });
  A.deepEqual(Array.from(tous), ["p2", "p1"], "sur le mois, les deux — l'ouverte en tête");
});

/* ========================================================================
   13.cx — un acte peut nommer ce pendant quoi il est arrivé
   ======================================================================== */

function acte(a, id, txt, pdt) {
  const n = { id: id, act: "dieu", man: "parle", kind: "rhema", txt: txt,
              par: [], date: "2026-11-08", prec: "j", etat: "fait", ts: 1, maj: 1 };
  if (pdt) n.pdt = pdt;
  a.db.nodes.push(n);
  return n;
}

test("13.cx — le lien désigne aussi bien un bloc qu'un temps mis à part", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", m: 0, maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];

  const vb = a.f.pdtDe("b1");
  A.equal(vb.kind, "bloc");
  A.equal(vb.nom, "Enseignements de TA");
  A.equal(vb.d, "litt", "le bloc porte la routine de son activité");

  const vp = a.f.pdtDe("p1");
  A.equal(vp.kind, "periode");
  A.equal(vp.d, "retraite");

  A.equal(a.f.pdtDe("rien"), null, "un lien qui ne mène nulle part se tait");
});

test("13.cx — l'application propose ce qui tournait, elle ne le demande pas", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(11, 0), null), bloc("b2", "a1", j(8, 0), j(9, 0))];
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];

  const ids = a.f.pdtCandidats().map(function (c) { return c.id; });
  A.deepEqual(Array.from(ids), ["b1", "p1"],
    "ce qui est en cours — le bloc fermé n'est pas un candidat");
});

test("13.cx — depuis un bloc, on note ce qu'Il y a fait et le lien est déjà posé", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];

  a.ctx.actions; /* le chemin réel passe par le délégué : on l'imite */
  a.S.draft = null;
  a.S.draft = a.ctx.__eben ? null : null;
  /* Ce que fait data-pdtneuf : */
  const d = { act: null, par: [], pdt: "b1", txt: "", date: "2026-11-08", prec: "j", etat: "fait" };
  a.S.draft = d;
  d.act = "dieu"; d.man = "parle"; d.txt = "Il m'a dit de reprendre Ésaïe 43";
  a.ctx.document.getElementById("nDate").value = "2026-11-08";
  a.actions.saveNote();

  const n = a.db.nodes[a.db.nodes.length - 1];
  A.equal(n.pdt, "b1", "l'acte sait d'où il est venu");
  A.deepEqual(Array.from(a.f.actesPdt("b1").map(function (x) { return x.id; })), [n.id]);
});

test("13.cx — « pendant » n'est pas « en réponse à » : les deux ne se mélangent pas", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];
  const cause = acte(a, "n1", "Je lui ai demandé une direction");
  const recu = acte(a, "n2", "Il a répondu", "b1");
  recu.par = [cause.id];

  A.deepEqual(Array.from(a.f.enfants("n1").map(function (x) { return x.id; })), ["n2"],
    "le graphe des actes ne voit que les liens de cause");
  A.equal(a.f.pdtDe(recu.pdt).kind, "bloc", "la circonstance vit à côté, pas dedans");
});

test("13.cx — un lien gardé par un acte ne survit pas à l'effacement de sa circonstance", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];
  acte(a, "n1", "Il a parlé", "b1");

  /* L'autre appareil a effacé le bloc — après l'avoir connu : une pierre
     tombale plus ancienne que la fiche ne vaut rien (13.be). */
  const autre = a.f.sane({ taches: a.db.taches, temps: [], nodes: [], morts: { b1: j(23, 0) } });
  const out = a.f.fusionne(a.f.sane(JSON.parse(JSON.stringify(a.db))), autre);
  A.equal(out.nodes.length, 1, "l'acte reste — c'est le mémorial");
  A.equal(out.nodes[0].pdt, undefined, "mais il a perdu sa circonstance, jamais l'inverse");
});

test("13.cx — ce que le lien permet de déduire : par routine, combien de fois Il a parlé", () => {
  const a = app();
  a.db.taches = [
    { id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 },
    { id: "a2", nom: "Prière du matin", cat: "dieu", d: "priere", maj: 1 }
  ];
  a.db.temps = [
    bloc("b1", "a1", j(9, 0), j(11, 0)),
    bloc("b2", "a2", j(6, 0), j(7, 0))
  ];
  acte(a, "n1", "Il a parlé pendant la vidéo", "b1");
  acte(a, "n2", "Encore", "b1");
  acte(a, "n3", "Pendant la prière", "b2");
  /* Un acte de moi ne compte pas : la question est ce qu'IL a fait. */
  const mien = acte(a, "n4", "J'ai jeûné", "b1"); mien.act = "moi";

  const r = a.f.actesParDisc(j(0, 0), j(23, 59));
  A.equal(r.litt, 2);
  A.equal(r.priere, 1);

  const hier = a.f.bornes("jour", jour(7, 12, 0));
  A.equal(Object.keys(a.f.actesParDisc(hier[0], hier[1])).length, 0,
    "et la fenêtre regardée décide, comme partout ailleurs");
});

test("13.cx — changer d'acteur ne perd pas la circonstance déjà posée", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];

  /* « Noter ce qu'Il a fait pendant ce temps », depuis l'écran du bloc. */
  a.geste({ pdtneuf: "b1" });
  A.equal(a.S.draft.pdt, "b1");
  A.equal(a.S.view, "note");

  /* Puis la première question de l'écran : qui a fait ? */
  a.geste({ qui: "dieu" });
  A.equal(a.S.draft.act, "dieu");
  A.equal(a.S.draft.pdt, "b1",
    "le brouillon est refait à ce moment-là : le lien doit traverser");
});

test("13.cx — toucher la circonstance la pose, la retoucher la retire", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(11, 0), null)];

  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  A.equal(a.S.draft.pdt, null, "rien n'est posé d'office");

  a.geste({ pdt: "b1" });
  A.equal(a.S.draft.pdt, "b1");
  a.geste({ pdt: "b1" });
  A.equal(a.S.draft.pdt, null, "on retire ce qu'on a posé par erreur");
});

test("13.cw — une routine encadrée ne porte plus le tiret du « rien reçu »", () => {
  const a = app();
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];
  const ps = a.f.perDisc("retraite", a.f.bornes("jour", MIDI)[0], MIDI);
  A.equal(ps.length, 1);
  A.match(a.f.perDiscTxt(ps), /en cours depuis hier à 7 h 00 · 1 jour 5 h/);

  A.equal(a.f.perDisc("jeune", a.f.bornes("jour", MIDI)[0], MIDI).length, 0);
  A.equal(a.f.perDiscTxt([]), "", "une routine sans cadre ne dit rien de plus");
});

test("13.cw — une période close se dit au passé ; plusieurs se comptent", () => {
  const a = app();
  a.db.periodes = [
    { id: "p1", d: "jeune", deb: jour(2, 6, 0), fin: jour(2, 18, 0), maj: 1 },
    { id: "p2", d: "jeune", deb: jour(5, 6, 0), fin: jour(5, 20, 0), maj: 1 }
  ];
  const mois = a.f.bornes("mois", MIDI);
  const un = a.f.perDisc("jeune", jour(2, 0, 0), jour(3, 0, 0));
  A.match(a.f.perDiscTxt(un), /^12 h, depuis/);

  const deux = a.f.perDisc("jeune", mois[0], mois[1]);
  A.equal(deux.length, 2);
  A.equal(a.f.perDiscTxt(deux), "2 fois");

  a.db.periodes.push({ id: "p3", d: "jeune", deb: jour(8, 6, 0), maj: 1 });
  A.equal(a.f.perDiscTxt(a.f.perDisc("jeune", mois[0], mois[1])), "3 fois, dont une en cours");
});

/* ========================================================================
   13.cy — la circonstance entre dans le chemin
   ======================================================================== */

function dieu(a, id, txt, pdt, par) {
  const n = { id: id, act: "dieu", man: "parle", kind: "rhema", txt: txt,
              par: par || [], date: "2026-11-08", prec: "j", etat: "fait", ts: +id.slice(1), maj: 1 };
  if (pdt) n.pdt = pdt;
  a.db.nodes.push(n);
  return n;
}

test("13.cy — un acte de Dieu reçu pendant quelque chose fait un chemin à lui seul", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];
  dieu(a, "n1", "Reprends Ésaïe 43", "b1");

  const ch = a.f.chemins();
  A.equal(ch.length, 1, "il n'est pas isolé : on sait d'où il vient");
  A.equal(ch[0].length, 1);
  const cs = a.f.circonstancesDe(ch[0]);
  A.equal(cs.length, 1);
  A.equal(cs[0].nom, "Enseignements de TA");
});

test("13.cy — un acte sans cause et sans circonstance ne fait toujours pas de chemin", () => {
  const a = app();
  dieu(a, "n1", "Une parole, et rien autour");
  A.equal(a.f.chemins().length, 0, "il n'y a rien à retracer");
});

test("13.cy — deux actes reçus pendant la même chose tiennent au même fil", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];
  dieu(a, "n1", "Première parole", "b1");
  dieu(a, "n2", "Seconde parole", "b1");

  const ch = a.f.chemins();
  A.equal(ch.length, 1, "la circonstance relie comme une cause relie");
  A.equal(ch[0].length, 2);
});

test("13.cy — une période encadre un chemin comme un bloc", () => {
  const a = app();
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];
  dieu(a, "n1", "Pendant la retraite", "p1");
  const ch = a.f.chemins();
  A.equal(ch.length, 1);
  const cs = a.f.circonstancesDe(ch[0]);
  A.equal(cs[0].kind, "periode");
  A.equal(cs[0].nom, "Retraites pour le progrès spirituel");
});

test("13.cy — un chemin se nomme par l'acte de Dieu le plus récent, pas par son dernier pas", () => {
  const a = app();
  const demande = { id: "n1", act: "moi", txt: "Je lui ai demandé", par: [], date: "2026-11-05",
                    prec: "j", etat: "fait", ts: 1, maj: 1 };
  a.db.nodes.push(demande);
  dieu(a, "n2", "Il a pourvu", null, ["n1"]).date = "2026-11-06";
  a.db.nodes.push({ id: "n3", act: "moi", txt: "J'ai remercié", par: ["n2"], date: "2026-11-07",
                    prec: "j", etat: "fait", ts: 3, maj: 1 });

  const ch = a.f.chemins();
  A.equal(ch.length, 1);
  A.equal(ch[0][0].id, "n3", "la tête reste le pas le plus récent");
  A.equal(a.f.nomChemin(ch[0]).id, "n2", "mais c'est Son acte qui nomme le chemin");
});

test("13.cy — un chemin sans acte de Dieu garde sa tête pour nom", () => {
  const a = app();
  a.db.nodes.push({ id: "n1", act: "moi", txt: "J'ai donné", par: [], date: "2026-11-05",
                    prec: "j", etat: "fait", ts: 1, maj: 1 });
  a.db.nodes.push({ id: "n2", act: "gens", txt: "Il a rendu", par: ["n1"], date: "2026-11-06",
                    prec: "j", etat: "fait", ts: 2, maj: 1 });
  const ch = a.f.chemins();
  A.equal(a.f.nomChemin(ch[0]).id, ch[0][0].id);
});

test("13.cy — une circonstance effacée ne retient plus rien", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];
  dieu(a, "n1", "Une parole", "b1");
  A.equal(a.f.chemins().length, 1);

  a.db.temps = [];
  A.equal(a.f.chemins().length, 0,
    "le lien ne mène plus nulle part : l'acte reste, le chemin non");
  A.equal(a.f.circonstancesDe([a.f.node("n1")]).length, 0);
});

/* ========================================================================
   13.cz — un chemin se ramifie
   ======================================================================== */

function moi(a, id, txt, par, ts, extra) {
  const n = { id: id, act: "moi", txt: txt, par: par || [], date: "2026-11-08",
              prec: "j", etat: "fait", ts: ts || 1, maj: 1 };
  Object.assign(n, extra || {});
  a.db.nodes.push(n);
  return n;
}

/* Lit l'arbre rendu par vChemin : un pas par ligne, avec sa profondeur de
   branche, sa classe et son texte. On n'inspecte que le fil. */
function arbre(a, id) {
  a.S.cheminId = id;
  a.f.vChemin();
  const html = a.Z.html;
  const i = html.indexOf('<div class="fil">');
  A.ok(i !== -1, "le fil n'a pas été rendu");
  const fil = html.slice(i + '<div class="fil">'.length);
  const re = /<div class="ramif">|<\/div>|<a class="pas ([^"]+)"[\s\S]*?<\/a>/g;
  const out = [];
  let prof = 0, m;
  while ((m = re.exec(fil))) {
    if (m[0] === '<div class="ramif">') prof++;
    else if (m[0] === "</div>") prof--;
    else out.push({
      prof: prof,
      cls: m[1],
      txt: m[0].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    });
  }
  return out;
}

test("13.cz — deux causes pour un même acte : deux branches, pas une liste", () => {
  const a = app();
  moi(a, "n1", "J'ai jeûné", [], 1);
  moi(a, "n2", "J'ai demandé conseil", [], 2);
  dieu(a, "n3", "Il a répondu", null, ["n1", "n2"]).ts = 3;

  const t = arbre(a, "n3");
  A.equal(t.length, 3);
  A.equal(t[0].prof, 0, "l'acte est le tronc");
  A.ok(t[0].txt.includes("Il a répondu"));
  A.equal(t[1].prof, 1, "sa première cause est une branche");
  A.equal(t[2].prof, 1, "sa seconde cause en est une autre, pas sa suite");
  A.ok(t.some(x => x.txt.includes("J'ai jeûné")) && t.some(x => x.txt.includes("conseil")),
    "les deux causes se lisent entières");
});

test("13.cz — une seule cause ne décale rien : c'est la même ligne qui continue", () => {
  const a = app();
  moi(a, "n1", "J'ai cherché", [], 1);
  dieu(a, "n2", "Il a parlé", null, ["n1"]).ts = 2;

  const t = arbre(a, "n2");
  A.equal(t.length, 2);
  A.equal(t[0].prof, 0);
  A.equal(t[1].prof, 0, "inventer une fourche là où il n'y en a pas serait un mensonge");
});

test("13.cz — un acte déjà posé plus haut se rappelle au lieu de se relire", () => {
  const a = app();
  dieu(a, "n1", "La promesse de départ").ts = 1;
  moi(a, "n2", "Première réponse", ["n1"], 2);
  moi(a, "n3", "Seconde réponse", ["n1"], 3);
  dieu(a, "n4", "Il a tout noué", null, ["n2", "n3"]).ts = 4;

  const t = arbre(a, "n4");
  const pleins = t.filter(x => x.txt.includes("La promesse de départ") && x.cls.indexOf("rappel") === -1);
  const rappels = t.filter(x => x.cls.indexOf("rappel") !== -1);
  A.equal(pleins.length, 1, "la promesse ne se lit qu'une fois");
  A.equal(rappels.length, 1, "l'autre fil dit seulement qu'elle est là");
  A.ok(rappels[0].txt.includes("La promesse de départ"),
    "le rappel nomme bien l'acte où les deux fils se rejoignent");
});

test("13.cz — la circonstance se lit sous l'acte qu'elle a porté, pas au bas du chemin", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(9, 0), j(11, 0))];
  moi(a, "n1", "J'ai ouvert Ésaïe", [], 1);
  dieu(a, "n2", "Reprends Ésaïe 43", "b1", ["n1"]).ts = 2;

  const t = arbre(a, "n2");
  const cadre = t.filter(x => x.cls.indexOf("cadre") !== -1)[0];
  A.ok(cadre, "la circonstance est dans le fil");
  A.equal(cadre.prof, 1, "elle est une branche de l'acte qu'elle a porté");
  A.equal(t[0].prof, 0);
  A.ok(t[0].txt.includes("Reprends"), "l'acte reçu reste le tronc");
});

test("13.cz — deux pointes : deux fils posés sur le même filet, aucun branche de l'autre", () => {
  const a = app();
  moi(a, "n1", "La racine commune", [], 1);
  dieu(a, "n2", "Un premier fruit", null, ["n1"]).ts = 2;
  dieu(a, "n3", "Un second fruit", null, ["n1"]).ts = 3;

  const t = arbre(a, "n2");
  A.equal(t.filter(x => x.prof > 0).length, 0,
    "décaler l'un sous l'autre en ferait la branche d'un acte qui n'existe pas");
  A.equal(t.filter(x => x.cls.indexOf("rappel") === -1).length, 3);
  A.equal(t.filter(x => x.cls.indexOf("rappel") !== -1).length, 1,
    "la racine se lit une fois, et l'autre fil renvoie à elle");
});

test("13.cz — un acte prévu passe en dernier : il n'a pas eu lieu, il n'ouvre pas la lecture", () => {
  const a = app();
  dieu(a, "n1", "Il a promis").ts = 1;
  moi(a, "n2", "J'ai obéi", ["n1"], 2);
  moi(a, "n3", "Jeûner encore une semaine", ["n1"], 3, { etat: "prevu" });

  const t = arbre(a, "n1");
  A.ok(t[0].txt.includes("J'ai obéi"), "ce qui a eu lieu tient la tête");
  A.ok(t[0].cls.indexOf("prevu") === -1);
  const iPrevu = t.findIndex(x => x.cls.indexOf("prevu") !== -1);
  A.ok(iPrevu > 0, "le prévu vient après");
  A.ok(t.filter(x => x.txt.includes("Il a promis") && x.cls.indexOf("rappel") === -1).length === 1,
    "la promesse se lit entière sous ce qui a eu lieu, pas sous ce qui est prévu");
});

/* ========================================================================
   13.da — une journée ne garde que sa part
   ======================================================================== */

/* Un bloc d'écoute commencé hier à 23 h 51 et fini ce matin à 3 h 06. */
function aCheval(a) {
  a.db.taches = [{ id: "a1", nom: "Écoute Enseignements TA", cat: "dieu", d: "litt", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", jour(7, 23, 51), j(3, 6))];
  return a.db.temps[0];
}

test("13.da — un bloc à cheval ne pèse sur chaque jour que ce qu'il y a duré", () => {
  const a = app();
  const b = aCheval(a);
  const hier = a.f.bornes("jour", jour(7, 12, 0));
  const auj = a.f.bornes("jour", j(12, 0));

  const ph = a.f.partBloc(b, hier[0], hier[1]);
  A.equal(ph.duree, 9 * MIN, "hier n'en garde que les neuf dernières minutes");
  A.equal(ph.tot, 3 * H + 15 * MIN, "mais le bloc entier fait bien ses trois heures");
  A.ok(ph.apres && !ph.avant, "hier doit dire qu'il se poursuit");

  const pa = a.f.partBloc(b, auj[0], auj[1]);
  A.equal(pa.duree, 3 * H + 6 * MIN);
  A.ok(pa.avant && !pa.apres, "aujourd'hui doit dire qu'il a commencé avant");

  A.equal(ph.duree + pa.duree, ph.tot, "les deux parts font le bloc, et rien de plus");
});

test("13.da — les deux jours comptent ensemble exactement le bloc, pas deux fois", () => {
  const a = app();
  aCheval(a);
  const hier = a.f.bornes("jour", jour(7, 12, 0));
  const auj = a.f.bornes("jour", j(12, 0));
  const ch = a.f.cumul(hier[0], hier[1]).par.a1;
  const ca = a.f.cumul(auj[0], auj[1]).par.a1;
  A.equal(ch + ca, 3 * H + 15 * MIN);
});

test("13.da — un acte appartient au jour où il est arrivé, pas à l'étendue de sa circonstance", () => {
  const a = app();
  aCheval(a);
  const auj = new Date(j(12, 0));
  const d = auj.getFullYear() + "-" + String(auj.getMonth() + 1).padStart(2, "0")
          + "-" + String(auj.getDate()).padStart(2, "0");
  a.db.nodes.push({ id: "n1", act: "dieu", man: "parle", kind: "rhema",
                    txt: "Il a parlé pendant l'écoute", pdt: "b1",
                    date: d, prec: "j", etat: "fait", par: [], ts: 1, maj: 1 });

  const hier = a.f.bornes("jour", jour(7, 12, 0));
  const dj = a.f.bornes("jour", j(12, 0));
  A.equal(a.f.actesParDisc(dj[0], dj[1]).litt, 1, "la parole est de ce matin");
  A.equal(a.f.actesParDisc(hier[0], hier[1]).litt, undefined,
    "elle n'a rien à faire sur le compte rendu d'hier");
});

test("13.da — une date connue au mois près se lit sur tout le mois, jamais sur un jour", () => {
  const a = app();
  aCheval(a);
  const auj = new Date(j(12, 0));
  a.db.nodes.push({ id: "n1", act: "dieu", man: "parle", kind: "rhema",
                    txt: "Il a parlé, je ne sais plus quel jour", pdt: "b1",
                    date: auj.getFullYear() + "-" + String(auj.getMonth() + 1).padStart(2, "0") + "-01",
                    prec: "m", etat: "fait", par: [], ts: 1, maj: 1 });
  const mois = a.f.bornes("mois", j(12, 0));
  A.equal(a.f.actesParDisc(mois[0], mois[1]).litt, 1, "le mois le tient");
});

test("13.da — ce qui ne se divise pas ne se divise pas : les pages restent au jour où la lecture a commencé", () => {
  const a = app();
  aCheval(a);
  a.db.temps[0].pg = [["Une voix pour le réveil", 1, 52]];
  const hier = a.f.bornes("jour", jour(7, 12, 0));
  const auj = a.f.bornes("jour", j(12, 0));
  A.equal(a.f.mesureDisc("litt", hier[0], hier[1]), "52 pages",
    "on ne coupe pas 52 pages en deux à minuit : ce serait inventer un chiffre");
  A.equal(a.f.mesureDisc("litt", auj[0], auj[1]), "",
    "et on ne les compte surtout pas une seconde fois");
});

test("13.da — le jour qui ne compte pas la lecture dit où elle se compte", () => {
  const a = app();
  aCheval(a);
  a.db.temps[0].pg = [["Une voix pour le réveil", 1, 52]];
  const b = a.db.temps[0];
  const hier = a.f.bornes("jour", jour(7, 12, 0));
  const auj = a.f.bornes("jour", j(12, 0));
  A.equal(a.f.lectureAilleurs(b, hier[0], hier[1]), false,
    "hier compte ces pages : il n'a rien à renvoyer ailleurs");
  A.equal(a.f.lectureAilleurs(b, auj[0], auj[1]), true,
    "aujourd'hui montre le bloc sans compter ses pages : il doit le dire");
});

test("13.da — un bloc sans lecture ne renvoie nulle part", () => {
  const a = app();
  const b = aCheval(a);
  const auj = a.f.bornes("jour", j(12, 0));
  A.equal(a.f.lectureAilleurs(b, auj[0], auj[1]), false);
});

/* ========================================================================
   13.db — un arrêt est un arrêt
   ======================================================================== */

test("13.db — après un arrêt, une activité démarre maintenant, pas à l'heure de l'arrêt", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Sommeil", cat: "soi", maj: 1 },
                 { id: "a2", nom: "Toilettes", cat: "soi", maj: 1 }];
  a.db.temps = [{ id: "b1", t: "a1", deb: j(0, 30), maj: 1 }];

  a.maintenant(j(7, 23));
  a.f.arrete();
  A.ok(a.f.creuxVif(), "l'arrêt ouvre un creux vif");

  /* Sept minutes pour se lever, puis la tape sur le rail — le geste
     habituel pour dire à quoi on est. */
  a.maintenant(j(7, 30));
  a.actions.comblerVif();
  a.f.poseTache("a2");

  const b = a.db.temps.filter(x => x.t === "a2")[0];
  A.ok(b, "le bloc est créé");
  A.equal(b.deb, j(7, 30),
    "les sept minutes passées à se lever n'ont été données à personne");
});

test("13.db — mais reprendre le temps non compté reste à une tape", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Sommeil", cat: "soi", maj: 1 },
                 { id: "a2", nom: "Prière", cat: "dieu", maj: 1 }];
  a.db.temps = [{ id: "b1", t: "a1", deb: j(0, 30), maj: 1 }];
  a.maintenant(j(7, 23));
  a.f.arrete();
  a.maintenant(j(7, 30));
  a.S.vifPrend = true;
  a.f.poseTache("a2");

  const b = a.db.temps.filter(x => x.t === "a2")[0];
  A.equal(b.deb, j(7, 23), "on priait déjà : le compte reprend à l'arrêt");
  A.equal(b.fin, undefined, "et il tourne encore");
});

test("13.db — reprendre ne vaut que pour le geste qu'on vient de faire", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Sommeil", cat: "soi", maj: 1 },
                 { id: "a2", nom: "Prière", cat: "dieu", maj: 1 },
                 { id: "a3", nom: "Manger", cat: "soi", maj: 1 }];
  a.db.temps = [{ id: "b1", t: "a1", deb: j(0, 30), maj: 1 }];
  a.maintenant(j(7, 23));
  a.f.arrete();
  a.maintenant(j(7, 30));
  a.S.vifPrend = true;
  a.f.poseTache("a2");
  A.equal(a.S.vifPrend, false, "l'interrupteur retombe : il ne vaut pas pour la suite");

  a.maintenant(j(8, 0));
  /* La prière tourne : sur le vrai chemin, l'application demande avant de
     l'arrêter, et c'est la réponse qui pose l'activité (13.dt). */
  a.geste({ tache: "a3" });
  A.equal(a.S.poseEn, "a3", "rien n'est posé tant qu'il n'a pas répondu");
  a.geste({ plus: "0" });
  A.equal(a.db.temps.filter(x => x.t === "a3")[0].deb, j(8, 0));
});

/* ========================================================================
   13.dc — un raccourci, c'est une activité épinglée
   ======================================================================== */

function troisTaches(a) {
  a.db.taches = [
    { id: "t1", nom: "Lecture de la Parole", cat: "dieu", d: "parole", maj: 1 },
    { id: "t2", nom: "Lecture Littérature Chrétienne", cat: "dieu", d: "litt", maj: 1 },
    { id: "t3", nom: "Prière", cat: "dieu", d: "priere", maj: 1 }
  ];
  return a.db.taches;
}

test("13.dc — tant que rien n'est épinglé, ce qui était là reste là", () => {
  const a = app();
  troisTaches(a);
  /* `Array.from` ramène le tableau dans NOTRE royaume : deepEqual refuse de
     comparer un tableau né dans le bac à sable, même identique. */
  const e = Array.from(a.f.epingles(), t => t.id).sort();
  A.deepEqual(e, ["t1", "t2"],
    "la Parole et le livre en cours se montrent d'eux-mêmes, comme avant");
});

test("13.dc — dès qu'une activité est épinglée, c'est la liste du disciple qui vaut", () => {
  const a = app();
  const ts = troisTaches(a);
  ts[2].ep = 1000;
  A.deepEqual(Array.from(a.f.epingles(), t => t.id), ["t3"],
    "prier a été choisi : les deux lignes d'office s'effacent");
});

test("13.dc — l'ordre des lignes suit l'ordre où on les a épinglées", () => {
  const a = app();
  const ts = troisTaches(a);
  ts[2].ep = 3000; ts[0].ep = 1000; ts[1].ep = 2000;
  A.deepEqual(Array.from(a.f.epingles(), t => t.id), ["t1", "t2", "t3"]);
});

test("13.dc — décocher voyage à la synchronisation au lieu de se faire écraser", () => {
  const a = app();
  const ici = { taches: [{ id: "t1", nom: "Prière", cat: "dieu", ep: 1000, maj: 5 }],
                nodes: [], gens: [], noms: [], mans: [], cats: [], livres: [], auteurs: [],
                temps: [], periodes: [], morts: {}, seq: 1, maj: 5 };
  const ailleurs = JSON.parse(JSON.stringify(ici));
  ailleurs.taches[0].ep = 0;
  ailleurs.taches[0].maj = 9;
  const r = a.f.fusionne(a.f.sane(ici), a.f.sane(ailleurs));
  A.equal(r.taches[0].ep, 0,
    "le décochage est une écriture, pas une absence : la dernière parole vaut (13.bd)");
});

test("13.dc — ce qu'on demandera à l'arrêt vient de la routine, pas du raccourci", () => {
  const a = app();
  const ts = troisTaches(a);
  ts.forEach(t => { t.ep = 1000 + ts.indexOf(t); });
  A.ok(a.f.raccourciArret(ts[0]).includes("jusqu'où"), "la Parole demande les chapitres");
  A.ok(a.f.raccourciArret(ts[1]).includes("quelle page"), "la littérature demande les pages");
  A.ok(a.f.raccourciArret(ts[2]).includes("nommé"), "la prière demande les sujets (13.de)");
  a.db.taches.push({ id: "t4", nom: "Culte", cat: "dieu", d: "eglise", ep: 1003, maj: 1 });
  A.equal(a.f.raccourciArret(a.f.tache("t4")), "",
    "une routine sans mesure propre ne demande rien de plus");
});

test("13.dc — une activité qui refuse la mesure de sa routine ne demande rien de plus", () => {
  const a = app();
  const ts = troisTaches(a);
  ts[1].m = 0;               /* un enseignement en vidéo : pas de pages (13.cq) */
  A.equal(a.f.raccourciArret(ts[1]), "");
  A.equal(a.f.raccourciSous(ts[1]), "Le compteur part");
});

/* ========================================================================
   13.dd — un raccourci peut partir à côté de ce qui tourne
   ======================================================================== */

function deuxEpinglees(a) {
  a.db.taches = [
    { id: "t1", nom: "Marche", cat: "soi", ep: 1000, maj: 1 },
    { id: "t2", nom: "Prière", cat: "dieu", d: "priere", ep: 2000, maj: 1 }
  ];
  a.db.temps = [{ id: "b1", t: "t1", deb: j(9, 0), maj: 1 }];
}

test("13.dd — un raccourci peut arrêter ce qui tourne, mais seulement s'il l'a dit", () => {
  const a = app();
  deuxEpinglees(a);
  a.maintenant(j(9, 30));
  a.geste({ ep: "t2" });
  A.equal(a.f.ouverts().length, 1, "rien n'a bougé : l'application demande (13.dt)");
  A.equal(a.f.ouverts()[0].t, "t1");
  A.equal(a.S.poseEn, "t2");

  a.geste({ plus: "0" });
  const marche = a.db.temps.filter(b => b.t === "t1")[0];
  A.ok(marche.fin, "la marche s'est arrêtée, parce qu'il l'a dit");
  A.equal(a.f.ouverts().length, 1);
  A.equal(a.f.ouverts()[0].t, "t2");
});

test("13.dd — « en plus » le lance à côté, sans rien arrêter", () => {
  const a = app();
  deuxEpinglees(a);
  a.maintenant(j(9, 30));
  a.S.enPlus = true;
  a.geste({ ep: "t2" });

  A.equal(a.f.ouverts().length, 2, "on prie en marchant : les deux couvrent la journée");
  A.equal(a.db.temps.filter(b => b.t === "t1")[0].fin, undefined);
  A.equal(a.db.temps.filter(b => b.t === "t2")[0].deb, j(9, 30));
});

test("13.dd — la réponse ne survit pas à l'écran où elle a été donnée", () => {
  const a = app();
  deuxEpinglees(a);
  a.db.taches.push({ id: "t3", nom: "Manger", cat: "soi", ep: 3000, maj: 1 });
  a.maintenant(j(9, 30));
  /* Le chemin réel : l'interrupteur est sur l'écran du +, et c'est là
     qu'on touche les raccourcis. */
  a.geste({ go: "note" });
  a.S.enPlus = true;
  a.geste({ ep: "t2" });
  A.equal(a.f.ouverts().length, 2);
  A.ok(a.S.enPlus, "il tient : c'est ce qui permet d'en lancer une troisième (13.dq)");
  A.equal(a.S.view, "note", "et l'écran reste ouvert");

  a.geste({ go: "today" });
  A.equal(a.S.enPlus, null,
    "mais la réponse ne survit pas à l'écran : la fois d'après, il redira (13.dt)");

  a.geste({ go: "note" });
  a.maintenant(j(10, 0));
  a.geste({ ep: "t3" });
  A.equal(a.f.ouverts().length, 2, "il redemande : la réponse d'avant n'est plus là");
  a.geste({ plus: "0" });
  A.equal(a.f.ouverts().length, 1, "manger arrête les deux, parce qu'il l'a dit");
  A.equal(a.f.ouverts()[0].t, "t3");
});

test("13.dd — toucher un raccourci qui tourne l'arrête, quel que soit l'interrupteur", () => {
  const a = app();
  deuxEpinglees(a);
  a.maintenant(j(9, 30));
  a.S.enPlus = true;
  a.geste({ ep: "t1" });
  A.ok(a.db.temps.filter(b => b.t === "t1")[0].fin, "c'est la même ligne qui arrête");
  A.equal(a.f.ouverts().length, 0);
});

/* ---------- 13.de — compter ce qu'on a nommé ---------- */

function priant(a) {
  a.db.taches = [
    { id: "p1", nom: "Actions de grâces", cat: "dieu", d: "priere", maj: 1 },
    { id: "p2", nom: "Lecture de la Parole", cat: "dieu", d: "parole", maj: 1 }
  ];
  a.db.temps = [bloc("b1", "p1", j(6, 0), j(6, 40))];
  /* L'écran du cahier est ouvert : ailleurs, le bloc en cours d'édition est
     relâché à chaque dessin, et le deuxième sujet ne trouverait plus où se
     poser. */
  a.S.view = "sujets"; a.S.blocId = "b1";
  return a.db.temps[0];
}

test("13.de — un sujet redit n'est pas un sujet neuf", () => {
  const a = app();
  const i1 = a.f.sujetId("Merci pour le travail");
  const i2 = a.f.sujetId("  merci   pour le TRAVAIL ");
  A.equal(i2, i1, "ni la casse ni les espaces ne font deux sujets");
  A.equal(a.db.sujets.length, 1);
  A.equal(a.f.sujetTxt(i1), "Merci pour le travail", "la première forme est gardée");
  A.notEqual(a.f.sujetId("Merci pour l'assemblée"), i1);
  A.equal(a.db.sujets.length, 2);
  A.equal(a.f.sujetId("   "), null, "un sujet vide n'est pas un sujet");
});

test("13.de — le compte est le nombre de lignes", () => {
  const a = app();
  const b = priant(a);
  a.geste({ sjadd: a.f.sujetId("La santé de maman") });
  a.geste({ sjadd: a.f.sujetId("Le travail") });
  A.equal(b.sj.length, 2);
  A.equal(a.f.mesureDisc("priere", jour(8, 0), jour(9, 0)), "2 sujets");
  a.geste({ sjadd: a.f.sujetId("Le travail") });
  A.equal(b.sj.length, 2, "ce qu'on a nommé une fois ne se compte pas deux fois");
  a.geste({ sjsup: "0" });
  A.equal(a.f.mesureDisc("priere", jour(8, 0), jour(9, 0)), "1 sujet");
});

test("13.de — nommer passe par le champ, et le champ se vide", () => {
  const a = app();
  const b = priant(a);
  a.S.sjQ = "Merci pour la nouvelle année";
  a.actions.sjAdd();
  A.equal(b.sj.length, 1);
  A.equal(a.f.sujetTxt(b.sj[0]), "Merci pour la nouvelle année");
  A.equal(a.S.sjQ, "", "le champ se vide, on enchaîne sur le suivant");
  a.actions.sjAdd();
  A.equal(b.sj.length, 1, "un champ vide n'ajoute rien");
});

test("13.de — la dernière fois ne vient que de la même routine, et rien n'est coché", () => {
  const a = app();
  const b = priant(a);
  const s1 = a.f.sujetId("La santé de maman"), s2 = a.f.sujetId("L'assemblée");
  const s3 = a.f.sujetId("Un chapitre");
  a.db.temps = [
    bloc("b0", "p1", jour(7, 6, 0), jour(7, 6, 40), { sj: [s1, s2] }),
    bloc("bL", "p2", jour(7, 8, 0), jour(7, 8, 30), { sj: [s3] }),
    b
  ];
  A.deepEqual(Array.from(a.f.sujetsDerniers(b)), [s1, s2],
    "les sujets d'une lecture ne sont pas ceux d'une prière");
  A.equal((b.sj || []).length, 0, "l'app tend la liste, elle ne coche rien");
});

test("13.de — la dernière fois, c'est la dernière AVANT ce bloc", () => {
  const a = app();
  const b = priant(a);
  const vieux = a.f.sujetId("Il y a longtemps"), hier = a.f.sujetId("Hier");
  const apres = a.f.sujetId("Ce soir");
  a.db.temps = [
    bloc("b0", "p1", jour(5, 6, 0), jour(5, 6, 40), { sj: [vieux] }),
    bloc("b1b", "p1", jour(7, 6, 0), jour(7, 6, 40), { sj: [hier] }),
    b,
    bloc("b2", "p1", j(20, 0), j(20, 30), { sj: [apres] })
  ];
  A.deepEqual(Array.from(a.f.sujetsDerniers(b)), [hier],
    "ni l'avant-dernière, ni une séance qui vient après");
});

test("13.de — arrêter une prière mène au cahier, comme une lecture mène aux chapitres", () => {
  const a = app();
  priant(a);
  a.db.temps = [bloc("b1", "p1", j(6, 0))];
  a.S.view = "today";
  a.maintenant(j(6, 40));
  a.actions.arretNet();
  A.equal(a.S.view, "sujets", "la question est posée à l'arrêt, pas à retrouver plus tard");
  A.equal(a.S.blocId, "b1");
});

test("13.de — une activité qui refuse la mesure de sa routine ne demande pas de sujets", () => {
  const a = app();
  priant(a);
  a.db.taches[0].m = 0;      /* on prie, on ne tient pas de liste (13.cq) */
  A.equal(a.f.spTache("p1"), "");
  a.db.temps = [bloc("b1", "p1", j(6, 0))];
  a.S.view = "today";
  a.maintenant(j(6, 40));
  a.actions.arretNet();
  A.notEqual(a.S.view, "sujets");
});

test("13.de — un sujet effacé ailleurs ne laisse pas une ligne vide qui compte", () => {
  const a = app();
  const s1 = a.f.sujetId("La santé de maman"), s2 = a.f.sujetId("L'assemblée");
  const ici = {
    sujets: [{ id: s1, txt: "La santé de maman", maj: 10 },
             { id: s2, txt: "L'assemblée", maj: 10 }],
    taches: [{ id: "p1", nom: "Actions de grâces", cat: "dieu", d: "priere", maj: 1 }],
    temps: [bloc("b1", "p1", j(6, 0), j(6, 40), { sj: [s1, s2] })],
    morts: {}, maj: 10, seq: 50
  };
  const ailleurs = JSON.parse(JSON.stringify(ici));
  ailleurs.sujets = ailleurs.sujets.filter(s => s.id !== s2);
  ailleurs.morts[s2] = 20; ailleurs.maj = 20;
  const d = a.f.fusionne(a.f.sane(ici), a.f.sane(ailleurs));
  A.deepEqual(Array.from(d.temps[0].sj), [s1]);
  A.equal(d.sujets.length, 1);
});

/* ---------- 13.df — compter les personnes ---------- */

function annoncant(a) {
  a.db.taches = [{ id: "e1", nom: "Évangélisation", cat: "dieu", d: "ames", maj: 1 }];
  a.db.temps = [bloc("e1b", "e1", j(15, 0), j(17, 0))];
  a.S.view = "annonce"; a.S.blocId = "e1b";
  return a.db.temps[0];
}

test("13.df — la conquête des âmes se compte en personnes", () => {
  const a = app();
  A.equal(a.f.mesureProposee("ames"), "gens");
  const b = annoncant(a);
  a.geste({ qadd: a.f.gensId("Jean-Jacques") });
  a.geste({ qadd: a.f.gensId("Félix") });
  A.equal(a.f.mesureDisc("ames", jour(8, 0), jour(9, 0)), "2 personnes");
  a.geste({ qadd: a.f.gensId("félix") });
  A.equal(b.qui.length, 2, "la même personne nommée deux fois reste une personne");
});

test("13.df — une ligne sans nom compte quand même", () => {
  const a = app();
  const b = annoncant(a);
  a.geste({ qadd: a.f.gensId("Jean-Jacques") });
  a.actions.qAnon();
  a.actions.qAnon();
  A.equal(b.qui.length, 3, "on prêche à des foules qu'on ne nomme pas");
  A.deepEqual(Array.from(b.qui).map(x => (x ? "nommé" : "")), ["nommé", "", ""]);
  A.equal(a.f.mesureDisc("ames", jour(8, 0), jour(9, 0)), "3 personnes");
  A.equal(a.db.gens.length, 1, "un anonyme n'entre pas dans le registre des gens");
});

test("13.df — nommer quelqu'un le relie au mémorial, pas à ce seul bloc", () => {
  const a = app();
  a.db.gens = [{ id: "g9", nom: "Félix", maj: 5 }];
  const b = annoncant(a);
  a.S.gQ = "Félix";
  a.actions.qAdd();
  A.deepEqual(Array.from(b.qui), ["g9"], "c'est la personne déjà connue, pas une deuxième fiche");
  A.equal(a.db.gens.length, 1);
  A.equal(a.S.gQ, "");
});

test("13.df — arrêter une évangélisation demande à qui on a annoncé", () => {
  const a = app();
  annoncant(a);
  a.db.temps = [bloc("e1b", "e1", j(15, 0))];
  a.S.view = "today";
  a.maintenant(j(17, 0));
  a.actions.arretNet();
  A.equal(a.S.view, "annonce");
  A.equal(a.S.blocId, "e1b");
});

test("13.df — une personne effacée ailleurs laisse la ligne, sans nom", () => {
  const a = app();
  const ici = {
    gens: [{ id: "g1", nom: "Jean-Jacques", maj: 10 }, { id: "g2", nom: "Félix", maj: 10 }],
    taches: [{ id: "e1", nom: "Évangélisation", cat: "dieu", d: "ames", maj: 1 }],
    temps: [bloc("e1b", "e1", j(15, 0), j(17, 0), { qui: ["g1", "g2", ""] })],
    morts: {}, maj: 10, seq: 50
  };
  const ailleurs = JSON.parse(JSON.stringify(ici));
  ailleurs.gens = ailleurs.gens.filter(g => g.id !== "g2");
  ailleurs.morts.g2 = 20; ailleurs.maj = 20;
  const d = a.f.fusionne(a.f.sane(ici), a.f.sane(ailleurs));
  A.deepEqual(Array.from(d.temps[0].qui), ["g1", "", ""],
    "on perd le nom, jamais le fait d'avoir annoncé");
});

/* ---------- 13.dg — un sujet relié à l'acte qui l'exauce ---------- */

function cahier(a) {
  a.db.taches = [{ id: "p1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 }];
  const s = a.f.sujetId("Le projet de Qualitas");
  a.db.temps = [
    bloc("c1", "p1", jour(1, 6, 0), jour(1, 6, 30), { sj: [s] }),
    bloc("c2", "p1", jour(5, 6, 0), jour(5, 6, 30), { sj: [s] }),
    bloc("c3", "p1", j(6, 0), j(6, 30), { sj: [s] })
  ];
  a.db.nodes = [{ id: "n1", act: "dieu", txt: "Le contrat est signé", man: "pourvu",
                  kind: "acte", date: "2026-11-08", prec: "j", etat: "fait", par: [], ts: 1, maj: 1 }];
  return s;
}

test("13.dg — l'acte dit ce qu'il exauce, et le sujet se lit à l'envers", () => {
  const a = app();
  const s = cahier(a);
  A.deepEqual(Array.from(a.f.exaucesDe(s)), [], "rien tant que le lien n'est pas posé");
  a.db.nodes[0].suj = [s];
  A.deepEqual(Array.from(a.f.exaucesDe(s), n => n.id), ["n1"]);
  A.match(a.f.exauceTxt(s), /^Exaucé/);
  A.match(a.f.exauceTxt(s), /pourvu/i, "la manière vient de l'acte, pas d'un second champ");
});

test("13.dg — l'histoire d'un sujet se déduit des séances, elle ne se saisit pas", () => {
  const a = app();
  const s = cahier(a);
  A.equal(a.f.sujetFois(s), 3);
  A.equal(a.f.sujetDepuis(s), jour(1, 6, 0), "la première prière est la plus ancienne séance");
  A.match(a.f.sujetHist(s), /3 fois/);
  A.match(a.f.sujetHist(s), /1er novembre/);
});

test("13.dg — poser puis retirer le lien depuis « ce qui a précédé »", () => {
  const a = app();
  const s = cahier(a);
  a.S.view = "lier"; a.S.nodeId = "n1";
  a.geste({ sujp: s });
  A.deepEqual(Array.from(a.db.nodes[0].suj), [s]);
  A.deepEqual(Array.from(a.db.nodes[0].par), [], "un sujet n'entre pas dans les causes");
  a.S.view = "lier"; a.S.nodeId = "n1";
  a.geste({ sujp: s });
  A.deepEqual(Array.from(a.db.nodes[0].suj), [], "le même geste le retire");
});

test("13.dg — le lien posé pendant la saisie arrive sur l'acte gardé", () => {
  const a = app();
  const s = cahier(a);
  a.S.draft = { act: "dieu", gid: null, dest: null, dgid: null, txt: "Le contrat est signé",
                desc: "", man: "pourvu", par: [], suj: [], pdt: null, etat: "fait",
                date: "2026-11-08", prec: "j", fige: false };
  a.S.view = "note";
  a.geste({ sujp: s });
  A.deepEqual(Array.from(a.S.draft.suj), [s]);
  a.actions.saveNote();
  const n = a.db.nodes.filter(x => x.id !== "n1")[0];
  A.deepEqual(Array.from(n.suj), [s]);
  A.deepEqual(Array.from(a.f.exaucesDe(s), x => x.id), [n.id]);
});

test("13.dg — le chemin montre le sujet sous l'acte qui l'a exaucé", () => {
  const a = app();
  const s = cahier(a);
  a.db.nodes[0].suj = [s];
  a.S.cheminId = a.db.nodes[0].id;
  a.f.vChemin();
  A.match(a.Z.html, /un sujet que tu as nommé/);
  A.match(a.Z.html, /Le projet de Qualitas/);
});

test("13.dg — un sujet effacé ailleurs laisse l'acte, jamais l'inverse", () => {
  const a = app();
  const s = cahier(a);
  a.db.nodes[0].suj = [s];
  const ici = JSON.parse(JSON.stringify({
    sujets: a.db.sujets, taches: a.db.taches, temps: a.db.temps, nodes: a.db.nodes,
    morts: {}, maj: 10, seq: 90
  }));
  /* Une pierre tombale ne l'emporte que sur une écriture plus ancienne : le
     sujet date d'avant sa suppression, sinon c'est lui qui gagne (13.be). */
  ici.sujets.forEach(x => { x.maj = 10; });
  const ailleurs = JSON.parse(JSON.stringify(ici));
  ailleurs.sujets = [];
  ailleurs.temps.forEach(b => { b.sj = []; });
  ailleurs.morts[s] = 20; ailleurs.maj = 20;
  const d = a.f.fusionne(a.f.sane(ici), a.f.sane(ailleurs));
  A.equal(d.nodes.length, 1, "l'acte reste");
  A.deepEqual(Array.from(d.nodes[0].suj), [], "il perd seulement ce qu'il exauçait");
});

/* ---------- 13.dh — ce qui vient, et ce qui attend ---------- */

function prevu(id, date, txt, prec) {
  return { id: id, act: "moi", dest: "dieu", txt: txt, man: "", kind: "acte",
           date: date, prec: prec || "j", etat: "prevu", par: [], ts: 1, maj: 1 };
}
/* Les titres des blocs de « Mes actes », dans l'ordre où ils sont rendus,
   chacun avec les actes qu'il contient. */
function sections(a) {
  a.S.view = "actes";
  a.f.vActes();
  const out = [];
  a.Z.html.split(/<div class="block-title/).slice(1).forEach(function (bout) {
    const t = (bout.match(/>([^<]+)<\/div>/) || [])[1] || "";
    const ids = (bout.split('<div class="block-title')[0].match(/data-node="([^"]+)"/g) || [])
      .map(function (m) { return m.slice(11, -1); });
    out.push({ titre: t, ids: ids });
  });
  return out;
}

test("13.dh — un acte noté aujourd'hui passe devant ceux dont le jour est passé", () => {
  const a = app();
  a.db.nodes = [
    prevu("vieux", "2026-11-07", "Recenser ce que TA attend"),
    prevu("vieux2", "2026-11-07", "Évaluer ce que mes dirigeants attendent"),
    prevu("neuf", "2026-11-08", "Faire mon compte rendu financier"),
    prevu("loin", "2026-11-20", "Travailler sur le livre")
  ];
  const s = sections(a);
  const av = s.filter(x => x.titre === "À venir")[0];
  const at = s.filter(x => x.titre === "Ce qui attend")[0];
  A.ok(av, "une section pour ce qui vient");
  A.deepEqual(av.ids, ["neuf", "loin"], "aujourd'hui d'abord, puis le plus proche");
  A.deepEqual(at.ids, ["vieux", "vieux2"], "ce dont le jour est passé se dit plus bas");
  A.ok(s.indexOf(av) < s.indexOf(at), "ce qui regarde en avant passe devant");
});

test("13.dh — sans retard, une seule section ; sans rien, l'ancienne amorce", () => {
  const a = app();
  a.db.nodes = [prevu("neuf", "2026-11-08", "Faire mon compte rendu")];
  let s = sections(a);
  A.ok(s.some(x => x.titre === "À venir"));
  A.ok(!s.some(x => x.titre === "Ce qui attend"), "pas de section vide qui accuse de rien");

  a.db.nodes = [];
  s = sections(a);
  A.ok(s.some(x => x.titre === "Planifié"));
  A.match(a.Z.html, /Rien de prévu/);
});

test("13.dh — un acte prévu « en novembre » n'est pas en retard avant décembre", () => {
  const a = app();
  a.db.nodes = [
    prevu("mois", "2026-11-01", "Jeûner un jour ce mois-ci", "m"),
    prevu("jour", "2026-11-01", "Appeler le frère", "j")
  ];
  const s = sections(a);
  A.deepEqual(s.filter(x => x.titre === "À venir")[0].ids, ["mois"],
    "le mois court encore : rien n'est en retard");
  A.deepEqual(s.filter(x => x.titre === "Ce qui attend")[0].ids, ["jour"],
    "le jour, lui, est passé");
});

/* ---------- 13.di — le cahier, feuilletable ---------- */

function registre(a) {
  a.db.taches = [{ id: "p1", nom: "Actions de grâces", cat: "dieu", d: "priere", maj: 1 }];
  const q = a.f.sujetId("Que le projet de Qualitas aboutisse");
  const m = a.f.sujetId("La santé de maman");
  const c = a.f.sujetId("Que la chorale soit établie");
  a.db.temps = [
    bloc("b1", "p1", jour(1, 6, 0), jour(1, 6, 30), { sj: [q, m, c] }),
    bloc("b2", "p1", jour(5, 6, 0), jour(5, 6, 30), { sj: [q, m] }),
    bloc("b3", "p1", j(6, 0), j(6, 30), { sj: [q] })
  ];
  a.db.nodes = [{ id: "n1", act: "dieu", txt: "Le contrat est signé", man: "pourvu",
                  kind: "acte", date: "2026-11-08", prec: "j", etat: "fait",
                  par: [], suj: [q], ts: 1, maj: 1 }];
  return { q: q, m: m, c: c };
}
/* Les sujets listés par le cahier, dans l'ordre où il les rend. */
function listeCahier(a) {
  a.S.view = "cahier";
  a.f.vCahier();
  return (a.Z.html.match(/data-sujo="([^"]+)"/g) || []).map(x => x.slice(11, -1));
}

test("13.di — le cahier s'ouvre sur ce qui attend encore une réponse", () => {
  const a = app();
  const s = registre(a);
  A.equal(a.S.sjF, "attente", "c'est l'état d'ouverture");
  A.deepEqual(listeCahier(a), [s.m, s.c], "l'exaucé n'y est pas");
  a.geste({ sjf: "exauces" });
  A.deepEqual(listeCahier(a), [s.q]);
  a.geste({ sjf: "tout" });
  A.equal(listeCahier(a).length, 3);
});

test("13.di — du dernier nommé au premier", () => {
  const a = app();
  const s = registre(a);
  a.geste({ sjf: "tout" });
  A.deepEqual(listeCahier(a), [s.q, s.m, s.c],
    "ce qu'on porte en ce moment remonte, ce qu'on a cessé de dire descend");
  A.equal(a.f.sujetDernier(s.c), jour(1, 6, 0));
});

test("13.di — la fiche déplie la ligne du cahier", () => {
  const a = app();
  const s = registre(a);
  a.geste({ sujo: s.q });
  A.equal(a.S.view, "sujet");
  a.f.vSujet();
  A.match(a.Z.html, /nommé 3 fois, depuis le 1er novembre/);
  A.match(a.Z.html, /Le contrat est signé/);
  A.deepEqual(Array.from(a.f.seancesDe(s.q), b => b.id), ["b3", "b2", "b1"],
    "les séances, de la plus récente à la plus ancienne");
});

test("13.di — « Il y a répondu » ouvre l'assistant déjà lié, et l'acte gardé ramène sur lui", () => {
  const a = app();
  const s = registre(a);
  a.geste({ sujrep: s.m });
  A.equal(a.S.view, "note");
  A.equal(a.S.draft.act, "dieu", "la réponse est de Lui, pas de moi");
  A.ok(a.S.draft.fige, "le lien est posé : on ne redemande pas en réponse à quoi");
  A.deepEqual(Array.from(a.S.draft.suj), [s.m]);

  a.S.draft.txt = "Elle est sortie de l'hôpital";
  a.S.draft.man = "delivre";
  a.actions.saveNote();
  const n = a.db.nodes.filter(x => x.id !== "n1")[0];
  A.equal(a.S.view, "node");
  A.equal(a.S.nodeId, n.id, "un acte né d'un sujet n'a pas de cause : on revient sur lui");
  A.deepEqual(Array.from(n.suj), [s.m]);
  A.match(a.f.exauceTxt(s.m), /délivré/);
});

test("13.di — un sujet se corrige, mais rien ne se réunit à sa place", () => {
  const a = app();
  const s = registre(a);
  a.S.view = "sujet"; a.S.sujId = s.c;
  a.ecrit("sjTxt", "Que la chorale de France soit établie");
  a.actions.sjGarder();
  A.equal(a.f.sujetTxt(s.c), "Que la chorale de France soit établie");

  a.ecrit("sjTxt", "La santé de maman");
  a.actions.sjGarder();
  A.equal(a.f.sujetTxt(s.c), "Que la chorale de France soit établie",
    "un autre sujet porte déjà ce texte : on le dit, on ne fusionne pas (13.ct)");
  A.equal(a.db.sujets.length, 3);
});

/* ---------- 13.dj — un temps mis à part se dit en haut ---------- */

function enRetraite(a) {
  a.db.periodes = [{ id: "pr1", d: "retraite", deb: jour(7, 7, 0), maj: 1 }];
  a.db.nodes = [{ id: "n1", act: "dieu", txt: "Il a parlé au matin", man: "parle",
                  kind: "rhema", date: "2026-11-07", prec: "j", etat: "fait",
                  par: [], ts: 1, maj: 1 }];
  return a.db.periodes[0];
}

test("13.dj — une retraite en cours se dit sur l'écran d'ouverture", () => {
  const a = app();
  const pr = enRetraite(a);
  A.match(a.f.rappelPer(), /Retraites pour le progrès spirituel/);
  A.match(a.f.rappelPer(), /C'est fini/);
  A.match(a.f.rappelPer(), /data-perfin="pr1"/);
  a.S.view = "today";
  a.f.vToday();
  A.match(a.Z.html, /data-perfin="pr1"/, "et pas seulement dans Mon temps");

  pr.fin = jour(8, 18, 0);
  A.equal(a.f.rappelPer(), "", "refermée, elle quitte le haut de l'écran");
});

test("13.dj — « C'est fini » referme et mène aussitôt à la fiche", () => {
  const a = app();
  const pr = enRetraite(a);
  a.maintenant(j(12, 0));
  a.geste({ perfin: "pr1" });
  A.equal(a.f.perOuverte(pr), false);
  A.equal(pr.fin, j(12, 0), "elle se referme à l'instant où il le dit");
  A.equal(a.S.view, "periode", "et on arrive là où l'heure se corrige");
  A.equal(a.S.perId, "pr1");
});

test("13.dj — la ligne dit le geste, et le geste se reprend", () => {
  const a = app();
  const pr = enRetraite(a);
  a.S.view = "periode"; a.S.perId = "pr1";
  a.f.vPeriode();
  A.match(a.Z.html, /C'est fini/, "ouverte : la ligne propose de refermer");
  A.ok(!/C'est toujours en cours/.test(a.Z.html));

  a.maintenant(j(12, 0));
  a.actions.perCours();
  A.equal(a.f.perOuverte(pr), false);
  a.f.vPeriode();
  A.match(a.Z.html, /C'est toujours en cours/, "refermée : on peut la rouvrir");

  a.actions.perCours();
  A.equal(a.f.perOuverte(pr), true, "une fin posée par erreur se reprend (13.cl)");
});

/* ---------- 13.dk — l'argent est le troisième registre ---------- */

/* « là ou est ton trésor là sera ton coeur » : ce qui se mesure, c'est la
   destination, et le poste la porte à lui seul. */
function mvt(id, d, m, p, q) {
  return { id: id, t: jour(d, 0, 0), m: m, p: p, q: q || "", maj: 1 };
}
function enArgent(a) {
  a.db.sous = [
    mvt("mv1", 2, 250000, "salaire", "Salaire d'octobre"),
    mvt("mv2", 3, 25000, "dieu", "Dîme"),
    mvt("mv3", 4, 90000, "moi", "Le loyer"),
    mvt("mv4", 5, 40000, "epargne"),
    mvt("mv5", 6, 5000, "dieu", "Offrande")
  ];
  return a.db.sous;
}
function argent(a, vue) {
  a.S.view = "argent"; a.S.per = "mois"; a.S.anc = null;
  if (vue) a.S.vueA = vue;
  a.f.vArgent();
  return a.Z.html;
}

test("13.dk — le poste porte le sens : aucun champ à tenir d'accord", () => {
  const a = app();
  enArgent(a);
  /* Rien, dans une fiche, ne dit « entrée » ou « sortie » : c'est le poste
     qui le dit, et lui seul (13.cn). */
  a.db.sous.forEach(function (x) {
    A.equal(x.sens, undefined, "pas de champ de sens à saisir");
  });
  A.equal(a.f.posteSens("salaire"), "e");
  A.equal(a.f.posteSens("dieu"), "s");
  A.equal(a.f.posteSens("retour"), "e", "reprendre son épargne est une entrée");

  const b = a.f.bornes("mois", MIDI);
  const c = a.f.cumulSous(b[0], b[1]);
  A.equal(c.entre, 250000);
  A.equal(c.sorti, 25000 + 90000 + 40000 + 5000);
  A.equal(c.par.dieu, 30000, "deux lignes pour Dieu font une seule part");
  A.equal(c.n, 5);
});

test("13.dk — l'heure et le franc vont aux mêmes destinataires", () => {
  const a = app();
  const sorties = Array.from(a.f.postesDe("s"));
  /* Les cinq de CAT_SOCLE se retrouvent à l'identique : c'est le même cœur
     qui répartit l'heure et le franc. */
  Array.from(a.c.CAT_SOCLE).forEach(function (cat) {
    A.ok(sorties.indexOf(cat[0]) !== -1, "le temps donne à « " + cat[1] + " », l'argent aussi");
  });
  /* Et l'argent en ajoute deux que le temps n'a pas : on n'épargne pas une
     heure, on ne l'investit pas. */
  A.ok(sorties.indexOf("epargne") !== -1);
  A.ok(sorties.indexOf("invest") !== -1);
  A.equal(sorties.length, Array.from(a.c.CAT_SOCLE).length + 2);
});

test("13.dk — les sommes se gardent en entiers, et se lisent comme on les tape", () => {
  const a = app();
  A.equal(a.f.montantLu("12,50"), 1250);
  A.equal(a.f.montantLu("12.5"), 1250, "le point d'un clavier étranger vaut la virgule");
  A.equal(a.f.montantLu("12"), 1200);
  A.equal(a.f.montantLu("1 234,56"), 123456, "l'espace des milliers ne gêne pas");
  A.equal(a.f.montantLu("1.234"), 123400, "mille deux cent trente-quatre, pas un euro vingt-trois");
  A.equal(a.f.montantLu("-43,20"), -4320, "un relevé recopié arrive négatif");
  A.equal(a.f.montantLu("12 €"), 1200);
  A.equal(a.f.montantLu(""), null);
  A.equal(a.f.montantLu("rien"), null);
  /* Le centime ne se perd pas en route : 0,1 + 0,2 doit faire 0,3. */
  A.equal(a.f.montantLu("0,10") + a.f.montantLu("0,20"), a.f.montantLu("0,30"));
  /* Et ce qui s'affiche dans un champ se retape tel quel. */
  A.equal(a.f.sousNu(123456), "1234,56");
  A.equal(a.f.montantLu(a.f.sousNu(123456)), 123456);
});

test("13.dk — le signe ne se garde pas : le poste dit le sens", () => {
  const a = app();
  a.S.view = "argent";
  a.actions.souNeuf();
  a.ecrit("souM", "-43,20");
  a.geste({ poste: "moi" });
  A.equal(a.S.sd.mTxt, "-43,20", "choisir un poste ne perd pas ce qui est tapé (13.ct)");
  a.actions.souGarder();
  A.equal(a.db.sous.length, 1);
  A.equal(a.db.sous[0].m, 4320, "on n'en retient que la somme");
  A.equal(a.db.sous[0].p, "moi");
  A.equal(a.S.view, "argent");
});

test("13.dk — un mouvement sans somme ou sans poste n'entre pas", () => {
  const a = app();
  a.actions.souNeuf();
  a.actions.souGarder();
  A.equal(a.db.sous.length, 0, "rien à garder");

  a.ecrit("souM", "0");
  a.actions.souGarder();
  A.equal(a.db.sous.length, 0, "zéro n'a rien bougé");

  a.ecrit("souM", "30");
  a.actions.souGarder();
  A.equal(a.db.sous.length, 0, "sans poste, la somme n'irait nulle part");

  a.geste({ poste: "dieu" });
  a.actions.souGarder();
  A.equal(a.db.sous.length, 1);
  A.equal(a.db.sous[0].m, 3000);
});

test("13.dk — un jour qui n'est pas arrivé ne se note pas", () => {
  const a = app();
  a.actions.souNeuf();
  a.ecrit("souM", "30");
  a.ecrit("souJ", "2026-12-01");
  a.geste({ poste: "dieu" });
  a.actions.souGarder();
  A.equal(a.db.sous.length, 0);

  a.ecrit("souJ", "2026-11-08");
  a.actions.souGarder();
  A.equal(a.db.sous.length, 1, "aujourd'hui passe");
  A.equal(a.db.sous[0].t, jour(8, 0, 0));
});

test("13.dk — une fiche se corrige et s'efface, et l'effacement laisse sa pierre", () => {
  const a = app();
  enArgent(a);
  a.geste({ sou: "mv3" });
  A.equal(a.S.view, "sou");
  A.equal(a.S.sd.mTxt, "900,00", "la somme revient telle qu'elle se retape");
  a.ecrit("souM", "950");
  a.actions.souGarder();
  A.equal(a.f.sou("mv3").m, 95000);

  a.geste({ sou: "mv3" });
  a.actions.souEffacer();
  A.equal(a.f.sou("mv3"), null);
  /* Sans pierre tombale, la synchro le ressusciterait (13.be). */
  A.ok(a.db.morts["mv3"], "une suppression se dit à l'autre appareil");
});

test("13.dk — l'écart n'est pas un solde, et l'écran le dit", () => {
  const a = app();
  enArgent(a);
  const h = argent(a, "parts");
  A.match(h, /Il est entré/);
  A.match(h, /il est resté/, "entré moins sorti, nommé pour ce qu'il est");
  A.match(h, /pas un solde de compte/, "l'application ignore ce qu'il y avait avant");
  /* La part de Dieu se dit en une phrase : c'est la question du registre. */
  A.match(h, /sont allés à Dieu/);
  A.match(h, /19\u202f%/, "30 000 sur 160 000 sortis");
  A.match(h, /Où c'est allé/);
  A.match(h, /D'où c'est venu/);
});

test("13.dk — la part vide se dit, et mène quelque part", () => {
  const a = app();
  a.db.sous = [mvt("mv1", 3, 90000, "moi", "Le loyer")];
  const h = argent(a, "parts");
  A.match(h, /Rien n'est allé à Dieu/, "un chiffre qui accuse ne se cache pas");
  A.match(a.Z.action, /data-act="souNeuf"/, "et jamais un reproche sans porte (13.cb)");
});

test("13.dk — les mouvements se relisent un par un, du plus récent au plus ancien", () => {
  const a = app();
  enArgent(a);
  const h = argent(a, "mvts");
  const ordre = (h.match(/data-sou="(mv\d)"/g) || []).join(" ");
  A.equal(ordre, 'data-sou="mv5" data-sou="mv4" data-sou="mv3" data-sou="mv2" data-sou="mv1"');
  A.match(h, /Le loyer/, "le libellé se lit, mais c'est le poste qui structure");
  A.match(h, /− 900,00/, "une sortie se voit au signe");
  A.match(h, /\+ 2[\s\u202f\u00a0]?500,00/, "une entrée aussi");
});

test("13.dk — un registre dont on ne peut pas dire la monnaie n'est pas un registre", () => {
  const a = app();
  enArgent(a);
  A.equal(a.db.dev, "EUR");
  A.match(a.f.sousTxt(123456), /€/);

  a.S.view = "reglages"; a.f.vReglages();
  A.match(a.Z.html, /data-go="devise"/, "le réglage a une porte (13.cl)");

  a.geste({ dev: "XAF" });
  A.equal(a.db.dev, "XAF");
  A.match(a.f.sousTxt(1234), /FCFA/);
  A.equal(a.f.sousTxt(1234), "1 234 FCFA".replace(" ", " "), "le franc CFA n'a pas de centimes");
  /* Changer de monnaie ne convertit rien : aucun taux ne se devine. */
  A.equal(a.f.sou("mv3").m, 90000, "le nombre gardé ne bouge pas");
  a.S.view = "devise"; a.f.vDevise();
  A.match(a.Z.html, /ne convertit rien/, "et l'écran le dit avant qu'on y touche");
});

test("13.dk — le registre survit au rechargement et à la réunion", () => {
  const a = app();
  enArgent(a);
  a.db.dev = "XAF";
  /* Les quatre points de câblage : le littéral, sane(), la boucle maj,
     fusionne(). */
  const r = a.f.sane(JSON.parse(JSON.stringify(a.db)));
  A.equal(r.sous.length, 5, "le tableau traverse le rechargement");
  A.equal(r.dev, "XAF");
  A.equal(r.sous[0].id, "mv1", "et il est rangé du plus ancien au plus récent");

  /* Un mouvement né sur l'autre appareil arrive ; celui qu'on a effacé ici
     ne revient pas. */
  const B = JSON.parse(JSON.stringify(r));
  B.sous.push(mvt("mv9", 7, 10000, "dieu", "Soutien"));
  const A2 = JSON.parse(JSON.stringify(r));
  A2.sous = A2.sous.filter(function (x) { return x.id !== "mv2"; });
  A2.morts = { mv2: Date.now() };
  const d = a.f.fusionne(A2, B);
  const ids = Array.from(d.sous).map(function (x) { return x.id; });
  A.ok(ids.indexOf("mv9") !== -1, "ce qui est né ailleurs arrive");
  A.equal(ids.indexOf("mv2"), -1, "ce qui est effacé ne ressuscite pas (13.be)");
  A.equal(d.dev, "XAF");
});

test("13.dk — la porte de Mes actes dit la part de Dieu du mois", () => {
  const a = app();
  enArgent(a);
  a.S.view = "actes"; a.f.vActes();
  A.match(a.Z.html, /data-go="argent"/, "le troisième registre a sa porte (13.di)");
  A.match(a.Z.html, /19\u202f% à Dieu ce mois-ci/);

  a.db.sous = [];
  a.f.vActes();
  A.match(a.Z.html, /Ce qui entre, ce qui sort/, "et vide, elle invite sans accuser");
});

/* ---------- 13.dl — un relevé se verse, il ne remplace pas ---------- */

const RELEVE = [
  "2026-11-02 | salaire | 2500,00 | Salaire d'octobre",
  "2026-11-03 | dieu | 250,00 | Dîme de novembre",
  "2026-11-04 | moi | 900,00 | Loyer"
].join("\n");

function colle(a, txt) {
  a.S.pile = []; a.S.view = "argent";
  a.geste({ go: "charger" });
  a.f.vCharger();
  a.ecrit("chTxt", txt);
  a.actions.chLire();
  return a.S.ch;
}

test("13.dl — le format se lit, et rien n'entre avant le dernier geste", () => {
  const a = app();
  const r = colle(a, RELEVE);
  A.equal(r.ok.length, 3);
  A.equal(r.deja.length, 0);
  A.equal(r.ko.length, 0);
  /* Lire ne touche pas au registre : l'application montre, le disciple
     ajoute (13.bc). */
  A.equal(a.db.sous.length, 0, "lire n'écrit rien");

  a.actions.chAjoute();
  A.equal(a.db.sous.length, 3);
  A.equal(a.S.view, "argent", "et il revient là d'où il venait");
  const x = a.db.sous.filter(function (y) { return y.p === "dieu"; })[0];
  A.equal(x.m, 25000, "les centimes, en entier");
  A.equal(x.t, jour(3, 0, 0));
  A.equal(x.q, "Dîme de novembre");
  A.ok(x.id, "et chaque mouvement reçoit son identifiant");
  A.equal(a.S.ch, null, "le lot ne reste pas en mémoire");
});

test("13.dl — coller deux fois ne double pas la dîme", () => {
  const a = app();
  colle(a, RELEVE);
  a.actions.chAjoute();
  A.equal(a.db.sous.length, 3);

  const r = colle(a, RELEVE);
  A.equal(r.ok.length, 0, "tout est déjà là");
  A.equal(r.deja.length, 3);
  a.actions.chAjoute();
  A.equal(a.db.sous.length, 3, "un registre qui double ce qu'on donne ne prouve rien");
});

test("13.dl — une ligne répétée dans le collage même ne passe qu'une fois", () => {
  const a = app();
  const r = colle(a, RELEVE + "\n" + "2026-11-03 | dieu | 250,00 | Dîme de novembre");
  A.equal(r.ok.length, 3);
  A.equal(r.deja.length, 1);
});

test("13.dl — deux mouvements du même jour passent s'ils se distinguent", () => {
  const a = app();
  const r = colle(a, [
    "2026-11-03 | moi | 3,50 | Café",
    "2026-11-03 | moi | 3,50 | Le marché",
    "2026-11-03 | moi | 4,00 | Café"
  ].join("\n"));
  A.equal(r.ok.length, 3, "le libellé et la somme les séparent");
  A.equal(r.deja.length, 0);
});

test("13.dl — ce qui ne se lit pas se dit, et n'entre pas", () => {
  const a = app();
  const r = colle(a, [
    RELEVE,
    "2026-13-01 | dieu | 10,00 | Mois impossible",
    "2026-02-31 | dieu | 10,00 | Jour impossible",
    "2026-11-09 | dieu | 10,00 | Demain",
    "2026-11-03 | cantine | 10,00 | Poste inconnu",
    "2026-11-03 | dieu | zéro | Montant illisible",
    "2026-11-03 dieu 10,00 Sans séparateur"
  ].join("\n"));
  A.equal(r.ok.length, 3, "les bonnes lignes passent quand même");
  A.equal(r.ko.length, 6);
  const raisons = Array.from(r.ko).map(function (k) { return k[1]; }).join(" ~ ");
  A.match(raisons, /le jour ne se lit pas/);
  A.match(raisons, /n'est pas encore arrivé/);
  A.match(raisons, /« cantine » n'est pas un poste/);
  A.match(raisons, /le montant ne se lit pas/);
  A.match(raisons, /il manque des colonnes/);

  a.f.vCharger();
  A.match(a.Z.html, /je n'ai pas su lire/, "l'écran les montre une par une");
  A.match(a.Z.html, /Jour impossible/, "avec la ligne telle qu'elle a été collée");

  a.actions.chAjoute();
  A.equal(a.db.sous.length, 3, "rien d'illisible n'est entré");
});

test("13.dl — un nom qui désigne deux postes ne se devine pas", () => {
  const a = app();
  /* « Mon travail » est une sortie ET une entrée : deviner serait inventer
     un chiffre (13.ch). */
  A.equal(a.f.chPoste("Mon travail"), false);
  A.equal(a.f.chPoste("Le reste"), false);
  A.equal(a.f.chPoste("travail"), "travail", "l'identifiant, lui, tranche");
  A.equal(a.f.chPoste("salaire"), "salaire");

  const r = colle(a, "2026-11-03 | Mon travail | 10,00 | Péage");
  A.equal(r.ok.length, 0);
  A.match(r.ko[0][1], /peut être une entrée ou une sortie/);
});

test("13.dl — on accepte ce qu'un relevé recopié donne vraiment", () => {
  const a = app();
  const r = colle(a, [
    "jour | poste | montant | à qui, à quoi",
    "03/11/2026 ; Pour Dieu ; 250,00 ; Dîme",
    "2026-11-04\tMA FAMILLE\t1 234,56 €\tEnvoi à maman",
    "2026-11-05 | moi | -43,20 | Courses",
    "2026-11-06 | epargne | 400 | Virement | automatique"
  ].join("\n"));
  A.equal(r.ko.length, 0, Array.from(r.ko).map(function (k) { return k.join(" → "); }).join(" ~ "));
  A.equal(r.ok.length, 4, "l'en-tête du modèle n'est pas un mouvement");
  const o = Array.from(r.ok);
  A.equal(o[0].p, "dieu", "le nom du poste, accents et majuscules compris");
  A.equal(o[1].p, "famille");
  A.equal(o[1].m, 123456, "l'espace des milliers et le symbole ne gênent pas");
  A.equal(o[2].m, 4320, "le signe d'un relevé ne se garde pas : le poste dit le sens");
  A.equal(o[3].q, "Virement | automatique", "une barre dans le libellé reste dans le libellé");
});

test("13.dl — l'écran donne la consigne avant de demander le texte", () => {
  const a = app();
  a.S.pile = []; a.S.view = "argent";
  a.geste({ go: "charger" });
  a.f.vCharger();
  A.match(a.Z.html, /jour \| poste \| montant/, "le format est écrit noir sur blanc");
  A.match(a.Z.html, /data-act="chCopie"/, "et se copie d'un geste");
  A.match(a.Z.html, /id="chTxt"/);
  A.match(a.Z.action, /data-act="chLire"/);
  /* Tous les postes sont nommés dans la consigne, sans quoi Claude en
     inventerait. */
  Array.from(a.c.POSTES).forEach(function (p) {
    A.match(a.c.CONSIGNE, new RegExp("\\b" + p[0] + "\\b"), p[0] + " manque à la consigne");
  });
});

test("13.dl — la porte est sur Mon argent, vide ou plein", () => {
  const a = app();
  a.S.view = "argent"; a.S.per = "mois"; a.S.anc = null;
  a.f.vArgent();
  A.match(a.Z.html, /data-go="charger"/, "registre vide : c'est là qu'on commence");

  a.db.sous = [{ id: "mv1", t: jour(3, 0, 0), m: 25000, p: "dieu", q: "Dîme", maj: 1 }];
  a.S.vueA = "parts"; a.f.vArgent();
  A.match(a.Z.html, /data-go="charger"/);
  a.S.vueA = "mvts"; a.f.vArgent();
  A.match(a.Z.html, /data-go="charger"/);
});

test("13.dl — un relevé à demi lu ne survit pas à l'écran", () => {
  const a = app();
  colle(a, RELEVE);
  A.ok(a.S.ch, "le lot est là tant qu'on le regarde");
  a.geste({ go: "today" });
  A.equal(a.S.ch, null, "il ne revient pas par la porte d'à côté");
  A.equal(a.S.chTxt, "");
});

/* ---------- 13.dm — une activité se renomme, se range et se réunit ---------- */

/* « je dois pouvoir corriger le nom d'une action dont j'ai mesuré le temps.
   aujourd'hui ce n'est pas possible. » */
function uneActivite(a) {
  a.db.taches = [
    { id: "a1", nom: "Priere", cat: "reste", maj: 1 },
    { id: "a2", nom: "Prière", cat: "dieu", d: "priere", maj: 1 },
    { id: "a3", nom: "Travail", cat: "travail", maj: 1 }
  ];
  a.db.temps = [
    bloc("b1", "a1", jour(6, 7, 0), jour(6, 8, 0)),
    bloc("b2", "a1", jour(7, 7, 0), jour(7, 7, 30)),
    bloc("b3", "a2", jour(8, 6, 0), jour(8, 7, 0))
  ];
  a.S.pile = []; a.S.view = "temps";
  a.geste({ tch: "a1" });
  a.f.vTache();
  return a.f.tache("a1");
}

test("13.dm — le nom se corrige, et les heures ne bougent pas", () => {
  const a = app();
  const t = uneActivite(a);
  A.match(a.Z.html, /id="tNom"/, "la fiche a enfin son champ");
  A.equal(a.Z.titre, "Priere");

  a.change("tNom", "Prière du matin");
  A.equal(t.nom, "Prière du matin");
  A.equal(a.f.heuresTache("a1").n, 2, "les blocs restent attachés");
  A.equal(a.f.heuresTache("a1").ms, 90 * MIN, "et les heures avec eux");
  A.equal(a.Z.titre, "Prière du matin", "le titre de l'écran suit");
});

test("13.dm — un nom déjà pris est refusé, avec son orthographe et la suite", () => {
  const a = app();
  const t = uneActivite(a);
  const champ = a.change("tNom", "prière");
  A.equal(t.nom, "Priere", "rien n'a bougé");
  A.equal(champ.value, "Priere", "et le champ reprend ce qui est rangé");
  A.match(a.dernierToast(), /« Prière » existe déjà/, "l'orthographe exacte de l'autre");
  A.match(a.dernierToast(), /réunis les deux/, "et ce qu'il faut faire à la place (13.ct)");

  a.change("tNom", "   ");
  A.equal(t.nom, "Priere", "une activité porte un nom");
});

test("13.dm — le rangement se change, et il refait les parts de tout l'historique", () => {
  const a = app();
  const t = uneActivite(a);
  A.match(a.Z.html, /id="tCat"/, "le rangement a sa porte (13.cb)");

  const b = a.f.bornes("jour", jour(6, 12, 0));
  A.equal(a.f.cumul(b[0], b[1]).parCat.dieu || 0, 0, "avant : rien pour Dieu ce jour-là");

  a.change("tCat", "dieu", "input");
  A.equal(t.cat, "dieu");
  A.equal(a.f.cumul(b[0], b[1]).parCat.dieu, 60 * MIN,
    "l'heure du 6 novembre est maintenant pour Dieu");
});

test("13.dm — réunir transporte les heures ; on ne supprime pas", () => {
  const a = app();
  uneActivite(a);
  A.equal(a.f.heuresTache("a2").ms, 60 * MIN);

  a.ecrit("tFus", "a2");
  a.actions.tchReunir();
  A.equal(a.f.tache("a1"), undefined, "la fiche absorbée s'en va");
  A.equal(a.f.heuresTache("a2").n, 3, "ses trois blocs sont là");
  A.equal(a.f.heuresTache("a2").ms, 150 * MIN, "et pas une minute perdue (13.cf)");
  A.equal(a.S.tchId, "a2", "et on reste sur la fiche qui demeure");
  /* Sans pierre tombale, l'autre appareil la ferait revenir (13.be). */
  A.ok(a.db.morts["a1"]);
});

test("13.dm — les heures réunies survivent à la synchronisation", () => {
  const a = app();
  uneActivite(a);
  a.ecrit("tFus", "a2");
  a.actions.tchReunir();

  /* L'autre appareil a encore l'ancienne activité et ses blocs. */
  const B = JSON.parse(JSON.stringify(a.db));
  B.morts = {};
  B.taches = Array.from(B.taches).concat([{ id: "a1", nom: "Priere", cat: "reste", maj: 1 }]);
  const d = a.f.fusionne(JSON.parse(JSON.stringify(a.db)), B);
  const ids = Array.from(d.taches).map(function (x) { return x.id; });
  A.equal(ids.indexOf("a1"), -1, "l'activité réunie ne ressuscite pas");
  A.equal(Array.from(d.temps).length, 3, "et aucun bloc n'est tombé avec elle");
  Array.from(d.temps).forEach(function (b) {
    A.equal(b.t, "a2", "tous rattachés à la fiche qui demeure");
  });
});

test("13.dm — la fiche dit ce qu'une réunion déplacerait", () => {
  const a = app();
  uneActivite(a);
  A.match(a.Z.html, /Tu y as compté/);
  A.match(a.Z.html, /1 h 30 sur 2 blocs/, "ce qui pèse se dit avant le geste");
  A.match(a.Z.html, /Réunir avec une autre/);
  A.match(a.Z.html, /id="tFus"/);
  A.match(a.Z.html, /data-act="tchReunir"/);
  A.ok(!/value="a1"/.test(a.Z.html), "on ne se réunit pas avec soi-même");

  /* Seule activité : il n'y a personne avec qui réunir, et la section s'en va. */
  a.db.taches = [{ id: "a1", nom: "Priere", cat: "reste", maj: 1 }];
  a.f.vTache();
  A.ok(!/data-act="tchReunir"/.test(a.Z.html));
});

/* ---------- 13.dn — l'application se mesure elle-même ---------- */

/* Un départ propre : on est sur un onglet, la profondeur à zéro. */
function surOnglet(a) {
  a.geste({ go: "today" });
  return a;
}

test("13.dn — un geste se compte : d'où, vers où, en combien", () => {
  const a = app();
  surOnglet(a);
  a.geste({ go: "temps" });

  const g = Array.from(a.SO.g);
  const x = g[g.length - 1];
  A.equal(x.k, "go", "le nom du geste");
  A.equal(x.v, "temps", "sa valeur, qui est un mot de code");
  A.equal(x.w, "today", "l'écran d'où il part");
  A.equal(x.a, "temps", "l'écran où il arrive");
  A.equal(x.d, 1, "un geste depuis l'onglet");

  /* Et un deuxième pas s'enfonce d'un cran. */
  a.db.taches = [{ id: "a1", nom: "Prière", cat: "dieu", maj: 1 }];
  a.geste({ tch: "a1" });
  const y = Array.from(a.SO.g).pop();
  A.equal(y.w, "temps");
  A.equal(y.d, 2, "deux gestes depuis l'onglet");
});

test("13.dn — la profondeur se remet à zéro sur un onglet", () => {
  const a = app();
  surOnglet(a);
  a.geste({ go: "temps" });
  a.geste({ go: "cahier" });
  A.equal(Array.from(a.SO.g).pop().d, 2);
  /* Revenir à un onglet, c'est repartir de zéro : c'est en gestes DEPUIS un
     onglet que se mesure ce qu'une porte coûte. */
  a.geste({ go: "actes" });
  A.equal(Array.from(a.SO.g).pop().d, 0, "un onglet ne coûte rien");
  a.geste({ go: "argent" });
  A.equal(Array.from(a.SO.g).pop().d, 1, "et le compte reprend à un");
});

test("13.dn — rien de ce qu'il écrit n'entre dans une sonde", () => {
  const a = app();
  /* Un attribut qui porte du texte : muet, quoi qu'il contienne. */
  A.equal(a.f.soSauf("sug", "Prière du matin avec Marie"), "·");
  A.equal(a.f.soSauf("sugg", "prier"), "·", "même court, même sans accent");
  /* Un identifiant ne dit rien sur la friction et beaucoup sur lui. */
  A.equal(a.f.soSauf("node", "n42-ab12cd"), "#");
  A.equal(a.f.soSauf("tache", "a12-7f3k2b"), "#");
  /* Un mot de code écrit dans le source, lui, se garde : c'est le geste. */
  A.equal(a.f.soSauf("go", "argent"), "argent");
  A.equal(a.f.soSauf("qui", "moiPrevu"), "moiPrevu");
  A.equal(a.f.soSauf("mes", "1"), "1");
  /* Et tout le reste — donc tout ce qui est ajouté demain — est muet. */
  A.equal(a.f.soSauf("inconnu", "Marie Dupont"), "·", "muet par défaut");

  /* La preuve par le geste : une suggestion touchée ne laisse pas son texte. */
  surOnglet(a);
  a.geste({ sugg: "Lecture de la Parole" });
  const x = Array.from(a.SO.g).pop();
  A.equal(x.v, "·");
  A.ok(!JSON.stringify(Array.from(a.SO.g)).includes("Lecture"),
    "le texte n'est nulle part dans les sondes");
});

test("13.dn — ce que l'app cite de lui est retiré de ses paroles", () => {
  const a = app();
  A.equal(a.f.soSigne("Combien ?"), "Combien ?", "un refus sec reste entier");
  A.equal(a.f.soSigne("Arrêté : Prière du matin"), "Arrêté : …");
  A.equal(a.f.soSigne("Noté : Euro"), "Noté : …");
  A.equal(a.f.soSigne("« Prière » existe déjà — réunis les deux activités"),
    "«…» existe déjà — réunis les deux activités");
  A.equal(a.f.soSigne("2 mouvements ajoutés."), "n mouvements ajoutés.",
    "les chiffres se rangent ensemble");
});

test("13.dn — un refus se distingue d'une confirmation sans le déclarer", () => {
  const a = app();
  surOnglet(a);
  a.geste({ go: "argent" });
  a.geste({ act: "souNeuf" });
  /* Garder sans montant : l'app parle, et rien ne s'écrit. */
  a.geste({ act: "souGarder" });
  const x = Array.from(a.SO.g).pop();
  A.equal(x.r, "Combien ?", "la parole est gardée");
  A.equal(x.s, undefined, "et rien n'a été écrit : c'est un refus");

  /* Un vrai enregistrement, lui, porte la marque de l'écriture. */
  a.ecrit("souM", "2500");
  a.geste({ poste: "dieu" });
  a.geste({ act: "souGarder" });
  const y = Array.from(a.SO.g).pop();
  A.equal(y.s, 1, "une écriture a eu lieu");
  A.equal(a.f.soBilan().refus.length, 1, "la confirmation ne compte pas pour un refus");
});

test("13.dn — le bilan nomme la porte qui coûte, et mène à elle", () => {
  const a = app();
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "argent" });
    a.geste({ go: "charger" });
  }
  const b = a.f.soBilan();
  const c = b.couts.filter(function (x) { return x.v === "charger"; })[0];
  A.ok(c, "l'écran atteint le plus loin est là");
  A.equal(c.n, 3, "trois visites");
  A.equal(c.med, 2, "deux gestes chaque fois");
  A.equal(c.poids, 3, "trois gestes qu'un raccourci lui aurait rendus");
  A.equal(b.couts[0].v, "charger", "et il passe devant, parce qu'il coûte plus");

  /* Un chiffre qui accuse doit mener quelque part (13.cb). */
  a.f.vSondes();
  A.match(a.Z.html, /data-go="charger"/);
  A.match(a.Z.html, /Charger un relevé/);
});

test("13.dn — le demi-tour dit où il voulait aller", () => {
  const a = app();
  for (let i = 0; i < 2; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "argent" });   // la mauvaise porte
    a.geste({ back: "1" });      // reparti aussitôt, sans rien écrire
    a.geste({ go: "temps" });    // ce qu'il cherchait
    a.geste({ go: "actes" });
  }
  const b = a.f.soBilan();
  const t = b.tours.filter(function (x) { return x.v === "argent"; })[0];
  A.ok(t, "le demi-tour est vu");
  A.equal(t.n, 2);
  A.equal(t.suite[0].v, "temps", "et l'écran suivant dit ce qu'il cherchait");
  a.f.vSondes();
  A.match(a.Z.html, /tu allais à Mon temps/);
});

test("13.dn — un écran où il écrit n'est pas un demi-tour", () => {
  const a = app();
  a.db.sous = [{ id: "mv1", t: MIDI - H, m: 1000, p: "dieu", q: "", maj: 1 }];
  a.geste({ go: "actes" });
  a.geste({ go: "argent" });
  a.geste({ sou: "mv1" });
  a.geste({ act: "souEffacer" });      // il a fait ce qu'il venait faire
  a.geste({ back: "1" });
  A.equal(a.f.soBilan().tours.length, 0,
    "être reparti après avoir écrit, c'est avoir réussi");
});

test("13.dn — les refus se regroupent par écran", () => {
  const a = app();
  a.geste({ go: "argent" });
  a.geste({ act: "souNeuf" });
  a.geste({ act: "souGarder" });
  a.geste({ act: "souGarder" });
  a.geste({ act: "souGarder" });
  const b = a.f.soBilan();
  A.equal(b.refus[0].n, 3, "trois fois le même refus");
  A.equal(b.refus[0].r, "Combien ?");
  A.equal(b.refus[0].w, "sou", "et l'écran qui demande mal est nommé");
  a.f.vSondes();
  A.match(a.Z.html, /Ce que l'app a refusé/);
});

test("13.dn — un raté silencieux est gardé, nommé par son endroit", () => {
  const a = app();
  a.geste({ go: "temps" });
  a.f.soRate("x is not a function", "http://localhost/src/09-ecrans-temps.js", 412);
  a.f.soRate("x is not a function", "http://localhost/src/09-ecrans-temps.js", 412);
  const b = a.f.soBilan();
  A.equal(b.rates.length, 1, "un bug qui se répète est un seul bug");
  A.equal(b.rates[0].n, 2);
  A.equal(b.rates[0].o, "09-ecrans-temps.js:412", "l'endroit, pour aller le lire");
  A.equal(b.rates[0].w, "temps", "et l'écran où il a trébuché");
  a.f.vSondes();
  A.match(a.Z.html, /Les ratés/);
});

test("13.dn — les écrans jamais ouverts se disent", () => {
  const a = app();
  a.geste({ go: "temps" });
  const b = a.f.soBilan();
  A.ok(b.morts.indexOf("annonce") !== -1, "un écran jamais vu est nommé");
  A.equal(b.morts.indexOf("temps"), -1, "celui-là a été ouvert");
  A.equal(b.morts.indexOf("today"), -1, "et celui-ci aussi");
});

test("13.dn — une sonde s'arrête et s'efface ; le journal ne bouge pas", () => {
  const a = app();
  a.db.nodes = [{ id: "n1", act: "dieu", txt: "Il a pourvu", date: "2026-11-08", maj: 1 }];
  const avant = a.db.maj;
  a.geste({ go: "temps" });
  A.ok(Array.from(a.SO.g).length > 0);
  A.equal(a.db.maj, avant, "un geste qui n'écrit rien ne pousse pas la synchro");

  /* Une sonde qu'on ne peut pas arrêter est une surveillance. */
  a.geste({ act: "soBascule" });
  A.equal(a.SO.on, false);
  const n = Array.from(a.SO.g).length;
  a.geste({ go: "cahier" });
  A.equal(Array.from(a.SO.g).length, n, "arrêtée, elle ne compte plus rien");
  a.f.vSondes();
  A.match(a.Z.html, /arrêtées/);

  a.geste({ act: "soBascule" });
  a.geste({ act: "soVider" });
  A.equal(Array.from(a.SO.g).length, 0, "tout s'efface");
  A.equal(Array.from(a.db.nodes).length, 1, "et le mémorial n'a pas bougé");
});

test("13.dn — les sondes vivent hors de l'archive", () => {
  const a = app();
  A.notEqual(a.c.SO_KEY, a.c.KEY, "une autre clé, un autre rangement");
  a.geste({ go: "temps" });
  a.f.soEcris(true);
  const brut = a.stocke(a.c.SO_KEY);
  A.ok(brut && brut.includes('"temps"'), "les gestes sont bien écrits là");
  /* Et l'archive les ignore : ni dans db, ni dans ce qui voyage. */
  A.equal(a.db.sondes, undefined);
  A.equal(a.db.g, undefined);
  const d = a.f.fusionne(JSON.parse(JSON.stringify(a.db)), JSON.parse(JSON.stringify(a.db)));
  A.equal(d.sondes, undefined, "rien ne passe à la synchronisation");
});

test("13.dn — les Réglages disent déjà ce que ça coûte", () => {
  const a = app();
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "argent" });
    a.geste({ go: "charger" });
  }
  A.match(a.f.soEtat(), /3 gestes de trop sur « Charger un relevé »/);
  a.f.vReglages();
  A.match(a.Z.html, /data-go="sondes"/, "la porte est dans les Réglages");
  A.match(a.Z.html, /Comment je m'en sers/);

  a.f.soVide();
  A.equal(a.f.soEtat(), "Rien encore mesuré");
  a.f.soBascule();
  A.equal(a.f.soEtat(), "Arrêté");
});

test("13.dn — la liste des gestes ne grossit pas sans fin", () => {
  const a = app();
  const max = a.c.SO_MAX;
  for (let i = 0; i < max + 40; i++) a.geste({ go: "temps" });
  A.equal(Array.from(a.SO.g).length, max, "le plus vieux part, le reste tient");
});

test("13.dn — une porte déjà à portée ne figure pas dans ce qui coûte", () => {
  const a = app();
  /* Depuis un onglet, un seul geste : il n'y a rien à gagner. */
  for (let i = 0; i < 6; i++) { a.geste({ go: "actes" }); a.geste({ go: "argent" }); }
  const b = a.f.soBilan();
  A.equal(b.couts.filter(function (c) { return c.v === "argent"; }).length, 0,
    "six visites à un geste ne coûtent rien");
  a.f.vSondes();
  A.ok(!/CE QUI TE COÛTE|Ce qui te coûte/.test(a.Z.html),
    "et la section s'en va plutôt que de lister des « +0 »");
});

test("13.dn — un onglet n'est pas une porte où l'on se trompe", () => {
  const a = app();
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "temps" });
    a.geste({ go: "actes" });   // un onglet : un carrefour, pas une erreur
    a.geste({ go: "argent" });
  }
  const b = a.f.soBilan();
  A.equal(b.tours.filter(function (t) { return t.v === "actes"; }).length, 0,
    "on passe par un carrefour, on ne s'y trompe pas");
});

test("13.dn — l'écran qu'il regarde n'est pas « jamais ouvert »", () => {
  const a = app();
  a.geste({ go: "actes" });
  a.geste({ go: "reglages" });
  a.geste({ go: "sondes" });
  /* Le geste en cours n'est pas encore compté quand l'écran se dessine. */
  A.equal(a.f.soBilan().morts.indexOf("sondes"), -1);
  A.ok(!/Comment je m'en sers<\/div>[\s\S]*Jamais ouvert/.test(a.Z.html));
});

test("13.dn — un chemin se lit sans être décodé", () => {
  const a = app();
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "argent" });
    a.geste({ go: "charger" });
    a.geste({ back: "1" });
  }
  const c = a.f.soBilan().chemins[0];
  A.ok(c, "le trajet repris trois fois est là");
  A.equal(c.suite, "Mon argent → Charger un relevé → Retour",
    "en mots, pas en noms d'attributs");
});

/* ---------- 13.do — une porte s'épingle, et l'ordre se règle à la main ---------- */

/* L'écran du bouton du milieu : c'est là que tout ce qui est « sous le
   pouce » se présente, à une tape des quatre onglets. */
function sousLePouce(a) {
  a.geste({ go: "note" });
  return a.Z.html;
}

test("13.do — une porte épinglée s'ouvre d'une tape, sous le pouce", () => {
  const a = app();
  A.ok(!/Aller tout de suite/.test(sousLePouce(a)), "rien tant que rien n'est épinglé");

  a.geste({ potog: "charger" });
  const h = sousLePouce(a);
  A.match(h, /Aller tout de suite/);
  A.match(h, /data-go="charger"/, "la ligne mène à l'écran");
  A.match(h, /Charger un relevé/);
  A.equal(a.f.portesEp().length, 1);
});

test("13.do — une porte et un raccourci ne portent pas la même forme", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Prière", cat: "dieu", ep: 1, maj: 1 }];
  a.geste({ potog: "argent" });
  const h = sousLePouce(a);
  /* Un raccourci d'activité fait partir le compteur ; une porte ouvre un
     écran. Deux blocs, deux titres : les mêler ferait démarrer un compteur
     à qui voulait seulement regarder (13.cu). */
  A.match(h, /data-ep="a1"/, "le raccourci d'activité est là");
  A.match(h, /Le compteur part/, "et il dit ce qu'il fait");
  A.match(h, /data-go="argent"/, "la porte aussi");
  A.ok(a.Z.html.indexOf("Le compteur part") < a.Z.html.indexOf("Aller tout de suite"),
    "chacune dans son bloc, et le compteur d'abord");
  A.ok(!/data-ep="argent"/.test(h), "une porte ne démarre rien");
});

test("13.do — décrocher laisse une pierre tombale", () => {
  const a = app();
  a.geste({ potog: "argent" });
  const id = a.f.portesEp()[0].id;
  a.geste({ potog: "argent" });
  A.equal(a.f.portesEp().length, 0, "la seconde tape décroche");
  A.ok(a.db.morts[id], "et laisse sa pierre (13.be)");

  /* Sans elle, l'autre appareil la remettrait à la synchronisation. */
  const B = JSON.parse(JSON.stringify(a.db));
  B.morts = {};
  B.portes = [{ id: id, v: "argent", ep: 1, maj: 1 }];
  const d = a.f.fusionne(JSON.parse(JSON.stringify(a.db)), B);
  A.equal(Array.from(d.portes).length, 0, "elle ne ressuscite pas");
});

test("13.do — les portes voyagent à la synchronisation", () => {
  const a = app();
  a.geste({ potog: "argent" });
  const B = a.f.sane({ portes: [{ id: "po9-zz", v: "cahier", ep: 1, maj: 2 }] });
  const d = a.f.fusionne(JSON.parse(JSON.stringify(a.db)), B);
  const vs = Array.from(d.portes).map(function (p) { return p.v; }).sort();
  A.deepStrictEqual(vs, ["argent", "cahier"], "les deux appareils se réunissent");
});

test("13.do — deux fois la même porte n'est pas deux raccourcis", () => {
  const a = app();
  /* Deux appareils peuvent l'avoir épinglée chacun de son côté. */
  const d = a.f.sane({ portes: [
    { id: "po1-aa", v: "argent", ep: 1, maj: 1 },
    { id: "po2-bb", v: "argent", ep: 2, maj: 1 },
    { id: "po3-cc", v: "cahier", ep: 3, maj: 1 }
  ] });
  A.equal(Array.from(d.portes).length, 2);
  A.equal(Array.from(d.portes)[0].v, "argent");

  /* Et la même tape deux fois n'ajoute rien non plus. */
  a.geste({ potog: "cahier" });
  A.equal(a.f.epinglePorte("cahier"), false);
  A.equal(a.f.portesEp().length, 1);
});

test("13.do — on n'épingle pas une porte qui ne mène nulle part", () => {
  const a = app();
  /* Un onglet est déjà sous le pouce ; « Un acte » attend qu'on lui en
     désigne un, et y mener sans ça ouvrirait un écran vide. */
  A.equal(a.f.epinglePorte("actes"), false, "un onglet");
  A.equal(a.f.epinglePorte("reglages"), false, "le rouage est sur les quatre onglets");
  A.equal(a.f.epinglePorte("node"), false, "un écran qui attend un acte");
  A.equal(a.f.epinglePorte("pointer"), false, "déjà une ligne de cet écran-là");
  A.equal(a.f.portesEp().length, 0);
  /* Et ce qu'on propose de cocher est exactement ça. */
  const vs = Array.from(a.f.portables());
  A.ok(vs.indexOf("charger") !== -1);
  A.equal(vs.indexOf("actes"), -1);
  A.equal(vs.indexOf("node"), -1);
});

test("13.do — l'ordre se règle à la main : ce qu'on touche passe en premier", () => {
  const a = app();
  a.geste({ potog: "argent" });
  a.geste({ potog: "cahier" });
  a.geste({ potog: "charger" });
  A.deepStrictEqual(Array.from(a.f.portesEp()).map(function (p) { return p.v; }),
    ["argent", "cahier", "charger"], "d'abord l'ordre où on les a posées");

  a.geste({ go: "ordre" });
  A.match(a.Z.html, /Dans quel ordre|en premier/);
  a.geste({ pohaut: "charger" });
  A.deepStrictEqual(Array.from(a.f.portesEp()).map(function (p) { return p.v; }),
    ["argent", "cahier", "charger"].filter(function (v) { return v !== "charger"; })
      .reduce(function (o, v) { o.push(v); return o; }, ["charger"]),
    "la touchée passe devant, les autres gardent leur ordre");

  /* Et les rangs se suivent : c'est ce qui les réunit sans ambiguïté. */
  A.deepStrictEqual(Array.from(a.f.portesEp()).map(function (p) { return p.ep; }), [1, 2, 3]);

  /* La première ne bouge plus : elle n'a pas de ligne à toucher. */
  a.f.vOrdre();
  A.ok(!/data-pohaut="charger"/.test(a.Z.html));
});

test("13.do — l'ordre des activités se règle de la même main", () => {
  const a = app();
  a.db.taches = [
    { id: "a1", nom: "Prière", cat: "dieu", maj: 1 },
    { id: "a2", nom: "Lecture de la Parole", cat: "dieu", maj: 1 },
    { id: "a3", nom: "Sport", cat: "moi", maj: 1 }
  ];
  a.geste({ eptog: "a1" });
  a.geste({ eptog: "a2" });
  a.geste({ eptog: "a3" });
  A.deepStrictEqual(Array.from(a.f.epinglesTaches()).map(function (t) { return t.id; }),
    ["a1", "a2", "a3"]);

  a.geste({ ephaut: "a3" });
  A.deepStrictEqual(Array.from(a.f.epinglesTaches()).map(function (t) { return t.id; }),
    ["a3", "a1", "a2"]);
  /* Ce que l'écran du pouce montre suit, puisque c'est la même liste. */
  A.ok(sousLePouce(a).indexOf('data-ep="a3"') < sousLePouce(a).indexOf('data-ep="a1"'));

  /* Une épingle neuve arrive en dernier : l'ordre réglé ne se refait pas. */
  a.geste({ eptog: "a1" });   // décrochée
  a.geste({ eptog: "a1" });   // puis remise
  A.deepStrictEqual(Array.from(a.f.epinglesTaches()).map(function (t) { return t.id; }),
    ["a3", "a2", "a1"]);
});

test("13.do — à une seule épingle, il n'y a pas d'ordre à régler", () => {
  const a = app();
  a.geste({ potog: "argent" });
  a.f.vEpingles();
  A.ok(!/data-go="ordre"/.test(a.Z.html), "une épingle, aucun ordre");
  a.geste({ potog: "cahier" });
  a.f.vEpingles();
  A.match(a.Z.html, /data-go="ordre"/, "à deux, la question se pose");
});

test("13.do — le bilan propose ce qui vaut la peine, et rien d'autre", () => {
  const a = app();
  /* Trois gestes depuis un onglet : sous le pouce, il n'en coûterait que
     deux. Ça vaut la peine. */
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "argent" });
    a.geste({ go: "charger" });
    a.geste({ go: "devise" });
  }
  const b = a.f.soBilan();
  A.match(a.f.soPropose(b), /Mettre « Ma monnaie » sous le pouce/);
  /* Trois tapes réelles : l'onglet, puis deux. Sous le pouce : le bouton du
     milieu, puis la ligne. Les deux comptent leur tape de rail. */
  A.match(a.f.soPropose(b), /4 gestes aujourd'hui, 2 depuis n'importe où/);
  A.match(a.f.soPropose(b), /data-eppo="devise"/);

  /* Une fois épinglée, elle n'est plus proposée — et la suivante non plus,
     si elle ne coûte que deux gestes : promettre un gain de rien serait un
     chiffre faux. */
  a.geste({ eppo: "devise" });
  A.ok(a.f.porteEp("devise"), "le disciple épingle, l'application proposait");
  const b2 = a.f.soBilan();
  A.equal(b2.couts.filter(function (x) { return x.v === "argent"; }).length, 0,
    "Mon argent est déjà à un geste du rail : une épingle ne rendrait rien");
  /* Charger un relevé reste à deux gestes : c'est le suivant qu'on propose. */
  A.match(a.f.soPropose(b2), /Mettre « Charger un relevé » sous le pouce/);
  a.geste({ eppo: "charger" });
  A.equal(a.f.soPropose(a.f.soBilan()), "", "et quand tout est épinglé, plus rien");
});

test("13.do — revenir sur un écran n'est pas s'y rendre", () => {
  const a = app();
  /* Le chemin réel : l'onglet, Mon argent, Charger un relevé, puis retour.
     Le retour repasse par Mon argent — sans que ce soit un trajet vers lui. */
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "argent" });
    a.geste({ go: "charger" });
    a.geste({ back: "1" });
    a.geste({ back: "1" });
  }
  const b = a.f.soBilan();
  A.equal(b.couts.filter(function (c) { return c.v === "argent"; }).length, 0,
    "Mon argent est à un geste de l'onglet : il ne coûte rien");
  A.equal(b.couts.filter(function (c) { return c.v === "charger"; })[0].med, 2,
    "et Charger un relevé en coûte deux, pas davantage à chaque tour");
  A.match(a.f.soPropose(b), /Mettre « Charger un relevé » sous le pouce/,
    "c'est donc lui qu'on propose, pas celui par où l'on repasse");
});


/* ---------- 13.dp — un sujet exaucé doit traverser l'assistant ---------- */

test("13.dp — « Il y a répondu », par le chemin réel : le lien survit au premier écran", () => {
  const a = app();
  const s = registre(a);
  a.geste({ sujrep: s.m });
  A.equal(a.S.view, "note");
  /* Le premier écran demande qui a répondu, et cette tape refait le
     brouillon : c'est là que le lien tombait, à tous les coups. */
  a.geste({ qui: "dieu" });
  A.deepEqual(Array.from(a.S.draft.suj), [s.m], "le sujet traverse le choix de l'acteur");

  a.ecrit("nTxt", "Elle est sortie de l'hôpital");
  a.actions.suite();
  a.geste({ man: "delivre" });
  a.actions.suite();
  a.actions.saveNote();

  const n = a.db.nodes.filter(x => x.id !== "n1")[0];
  A.deepEqual(Array.from(n.suj), [s.m], "l'acte gardé exauce le sujet");
  A.equal(a.f.exaucesDe(s.m).length, 1);
  a.geste({ sjf: "exauces" });
  A.ok(listeCahier(a).indexOf(s.m) !== -1, "et la pastille « Exaucés » le montre");
});

test("13.dp — l'assistant dit à quoi il répond, à chaque écran", () => {
  const a = app();
  const s = registre(a);
  a.geste({ sujrep: s.m });
  a.f.vNote();
  A.equal(a.Z.titre, "Qui a répondu ?", "ce n'est pas une capture ordinaire");
  A.doesNotMatch(a.Z.html, /data-go="pointer"/,
    "et on ne lui propose pas de compter son temps : il est venu répondre");
  a.geste({ qui: "dieu" });
  a.f.vNote();
  A.match(a.Z.html, /La santé de maman/, "l'écran du texte le rappelle");
  a.ecrit("nTxt", "Elle est sortie");
  a.actions.suite();
  a.f.vNote();
  A.match(a.Z.html, /La santé de maman/, "celui de la manière aussi");
  a.actions.suite();
  a.f.vNote();
  A.match(a.Z.html, /La santé de maman/, "et le dernier, celui où il garde");
});

test("13.dp — un sujet coché est un lien, pas « rien »", () => {
  const a = app();
  const s = registre(a);
  /* L'autre chemin : on garde un acte, et à l'étape des causes on coche un
     sujet du cahier. Le bouton annonçait « en réponse à rien ». */
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  a.ecrit("nTxt", "Le contrat de Qualitas est signé");
  a.actions.suite();
  a.actions.suite();
  a.actions.suiteDate();
  A.equal(a.f.etapes(a.S.draft)[a.S.step], "par");
  a.geste({ sujp: s.q });
  a.f.vNote();
  A.doesNotMatch(a.Z.action, /en réponse à rien/,
    "un sujet porté puis exaucé est un chemin de deux pas");
  A.match(a.Z.action, /1 lien/, "et le bouton le compte");
});


/* ========================================================================
   13.dq — partir à plusieurs, en une fois
   ======================================================================== */

function troisActivites(a) {
  a.db.taches = [{ id: "t1", nom: "Marche", cat: "soi", maj: 1 },
                 { id: "t2", nom: "Prière", cat: "dieu", maj: 1 },
                 { id: "t3", nom: "Enseignement", cat: "dieu", maj: 1 }];
}

test("13.dq — trois activités partent ensemble, sans quitter l'écran", () => {
  const a = app();
  troisActivites(a);
  a.maintenant(j(9, 0));
  a.geste({ go: "pointer" });
  a.geste({ plus: "1" });
  a.geste({ tache: "t1" });
  a.geste({ tache: "t2" });
  a.geste({ tache: "t3" });
  A.equal(a.S.view, "pointer", "l'écran ne s'est pas refermé entre deux");
  A.ok(a.S.enPlus, "et l'interrupteur tient : c'est lui, le mode");
  A.equal(a.f.ouverts().length, 3, "les trois tournent");
  A.deepEqual(Array.from(a.f.ouverts(), b => b.t).sort(), ["t1", "t2", "t3"]);
});

test("13.dq — quand rien ne tourne, la première tape part sans question", () => {
  const a = app();
  troisActivites(a);
  a.maintenant(j(9, 0));
  a.geste({ go: "pointer" });
  a.geste({ tache: "t1" });
  A.equal(a.S.view, "today", "une tape qui ne peut rien coûter ne demande rien");
  A.equal(a.f.ouverts().length, 1);

  a.maintenant(j(9, 30));
  a.geste({ go: "pointer" });
  a.geste({ tache: "t2" });
  A.equal(a.f.ouverts()[0].t, "t1", "mais la suivante attend sa réponse (13.dt)");
  a.geste({ plus: "0" });
  A.equal(a.f.ouverts().length, 1);
  A.equal(a.f.ouverts()[0].t, "t2");
});

test("13.dt — l'écran ne porte plus d'interrupteur : la question vient à la tape", () => {
  const a = app();
  troisActivites(a);
  a.S.view = "pointer";
  a.f.vPointer();
  A.doesNotMatch(a.Z.html, /data-plus=/,
    "un interrupteur a une position par défaut, et celle-là arrêtait un compteur");
  a.geste({ tache: "t1" });
  a.S.view = "pointer";
  a.f.vPointer();
  A.doesNotMatch(a.Z.html, /data-plus=/, "pas davantage quand quelque chose tourne");
});

test("13.dq — reprendre un creux à plusieurs : un seul départ", () => {
  const a = app();
  a.db.taches = [{ id: "t0", nom: "Sommeil", cat: "soi", maj: 1 },
                 { id: "t1", nom: "Prière", cat: "dieu", maj: 1 },
                 { id: "t2", nom: "Marche", cat: "soi", maj: 1 }];
  a.db.temps = [{ id: "b1", t: "t0", deb: j(0, 30), maj: 1 }];
  a.maintenant(j(7, 23));
  a.f.arrete();
  a.maintenant(j(7, 30));
  a.geste({ go: "pointer" });
  a.geste({ plus: "1" });
  a.S.vifPrend = true;
  a.geste({ tache: "t1" });
  a.maintenant(j(7, 31));
  a.geste({ tache: "t2" });

  A.equal(a.db.temps.filter(x => x.t === "t1")[0].deb, j(7, 23));
  A.equal(a.db.temps.filter(x => x.t === "t2")[0].deb, j(7, 23),
    "« depuis 7 h 23 » valait pour la volée, pas pour la première touchée");
});

test("13.dq — une activité touchée par erreur s'enlève de la volée", () => {
  const a = app();
  troisActivites(a);
  a.maintenant(j(9, 0));
  a.geste({ go: "pointer" });
  a.geste({ plus: "1" });
  a.geste({ tache: "t1" });
  a.geste({ tache: "t2" });
  a.maintenant(j(9, 1));
  a.geste({ tache: "t2" });
  A.equal(a.f.ouverts().length, 1, "elle s'arrête, elle seule");
  A.equal(a.f.ouverts()[0].t, "t1", "l'autre continue");
});

/* Qu'un message en chasse un autre ne se vérifie pas ici : le bac à sable
   n'a pas de DOM réel, et deux bandeaux superposés au même point fixe n'y
   existent pas. Un test qui passerait par construction ne défendrait rien.
   C'est donc une vérification d'écran, faite à 375 px (13.dq). */


/* ========================================================================
   13.dr — un creux passé peut recevoir plusieurs activités
   ======================================================================== */

function creuxDeDeuxHeures(a) {
  a.db.taches = [{ id: "t1", nom: "Marche", cat: "moi", maj: 1 },
                 { id: "t2", nom: "Prière", cat: "dieu", maj: 1 },
                 { id: "t3", nom: "Enseignements de TA", cat: "dieu", maj: 1 }];
  a.db.temps = [bloc("b1", "t1", j(8, 0), j(9, 0))];
  return { deb: j(14, 0), fin: j(16, 0) };
}

test("13.dr — un creux reçoit deux activités, sans quitter l'écran", () => {
  const a = app();
  const c = creuxDeDeuxHeures(a);
  a.geste({ creux: c.deb + "|" + c.fin });
  A.equal(a.S.view, "pointer");
  a.geste({ plus: "1" });
  a.geste({ tache: "t2" });
  a.geste({ tache: "t3" });

  A.equal(a.S.view, "pointer", "l'écran ne s'est pas refermé entre deux");
  const dedans = (a.db.temps || []).filter(b => b.deb === c.deb && b.fin === c.fin);
  A.equal(dedans.length, 2, "les deux couvrent le même temps");
  A.deepEqual(Array.from(dedans, b => b.t).sort(), ["t2", "t3"]);
});

test("13.dr — l'écran ne dit plus « rien n'a été compté » une fois qu'on y a posé quelque chose", () => {
  const a = app();
  const c = creuxDeDeuxHeures(a);
  a.geste({ creux: c.deb + "|" + c.fin });
  a.f.vPointer();
  A.match(a.Z.html, /rien n'a été compté/, "au départ, c'est vrai");

  a.geste({ tache: "t2" });
  a.f.vPointer();
  A.doesNotMatch(a.Z.html, /rien n'a été compté/, "ce serait faux, maintenant");
  A.match(a.Z.html, /<b>Prière<\/b>/, "il dit ce qu'il tient déjà");
});

test("13.dr — toucher une activité posée la retire, et laisse sa pierre tombale", () => {
  const a = app();
  const c = creuxDeDeuxHeures(a);
  a.geste({ creux: c.deb + "|" + c.fin });
  a.geste({ plus: "1" });
  a.geste({ tache: "t2" });
  a.geste({ tache: "t3" });
  const pose = (a.db.temps || []).filter(b => b.t === "t3" && b.deb === c.deb)[0];

  a.geste({ tache: "t3" });
  A.equal((a.db.temps || []).filter(b => b.deb === c.deb).length, 1, "elle seule s'en va");
  A.equal((a.db.temps || []).filter(b => b.deb === c.deb)[0].t, "t2");
  A.ok(a.db.morts && a.db.morts[pose.id],
    "sinon la synchro la ressusciterait (13.be)");
});

test("13.dr — combler ne demande rien : rien ne tourne, rien ne peut être perdu", () => {
  const a = app();
  const c = creuxDeDeuxHeures(a);
  a.geste({ creux: c.deb + "|" + c.fin });
  a.geste({ tache: "t2" });
  A.equal(a.S.poseEn, null, "aucune question : il n'y a rien à arrêter");
  A.equal(a.S.view, "pointer", "et l'écran reste ouvert — il a pu y en avoir d'autres");
  A.deepEqual(etat(a), ["t1 8h00→9h00", "t2 14h00→16h00"]);

  a.geste({ back: "1" });
  A.equal(a.S.trou, null, "on s'en va quand on a fini");
});


/* ========================================================================
   13.ds — une action prévue peut n'avoir pas encore de date
   ======================================================================== */

function planifie(a, id, txt, date, prec) {
  const n = { id: id, act: "moi", dest: "dieu", kind: "acte", txt: txt, man: "",
              par: [], date: date, prec: prec || "j", etat: "prevu", ts: 1, maj: 1 };
  a.db.nodes.push(n);
  return n;
}

test("13.ds — sans date, ce n'est ni à venir ni en retard : c'est « Quand je pourrai »", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  planifie(a, "p2", "Appeler mon père", "2026-11-01");
  planifie(a, "p3", "Donner à l'œuvre", "2026-11-09", "?");
  a.S.view = "actes";
  a.f.vActes();

  const bloc1 = a.Z.html.indexOf("Quand je pourrai");
  A.ok(bloc1 > 0, "le groupe existe");
  A.match(a.Z.html, /Ce qui attend/, "et celui du retard aussi, pour p2");
  A.ok(a.Z.html.indexOf("Donner à l'œuvre") > bloc1,
    "le sans-date est rangé dessous, pas parmi les retards");
  A.ok(a.Z.html.indexOf("Appeler mon père") < bloc1,
    "et celui qui avait un jour dit reste dans « Ce qui attend »");
});

test("13.ds — l'app ne la réclame pas le lendemain", () => {
  const a = app();
  planifie(a, "p1", "Donner à l'œuvre", "2026-11-01", "?");
  A.equal(a.f.remontees().filter(c => c.type === "prevu").length, 0,
    "aucun jour n'a été dit : il n'y a rien à rappeler, et rien à reprocher");

  a.db.nodes[0].prec = "j";
  A.equal(a.f.remontees().filter(c => c.type === "prevu").length, 1,
    "mais un jour dit se rappelle, lui");
});

test("13.ds — elle n'affiche pas de date qu'il n'a pas choisie", () => {
  const a = app();
  const n = planifie(a, "p1", "Donner à l'œuvre", "2026-11-09", "?");
  A.equal(a.f.human(n), "", "rien à dire : il n'a pas dit de jour");
  n.prec = "j";
  A.equal(a.f.human(n), "9 novembre 2026");
});

test("13.ds — « Je ne sais pas encore » efface le calendrier, et le rend", () => {
  const a = app();
  a.geste({ go: "note" });
  a.geste({ qui: "moiPrevu" });
  a.S.draft.txt = "Donner à l'œuvre";
  a.S.step = a.f.etapes(a.S.draft).indexOf("quand");
  a.f.vNote();
  A.match(a.Z.html, /type="date"/, "au départ, le calendrier est là");
  A.match(a.Z.html, /data-sansdate/, "et la réponse manquante aussi");

  a.geste({ sansdate: "nDate" });
  A.equal(a.S.draft.prec, "?");
  a.f.vNote();
  A.doesNotMatch(a.Z.html, /type="date"/,
    "montrer un jour qu'il ne veut pas dire serait le lui faire dire");

  a.geste({ sansdate: "nDate" });
  A.equal(a.S.draft.prec, "j");
  a.f.vNote();
  A.match(a.Z.html, /type="date"/, "et il revient d'une tape");
});

test("13.ds — « je ne sais pas encore » n'est offert qu'à ce qui est prévu", () => {
  const a = app();
  A.match(a.f.blocQuand("nDate", "2026-11-09", "j", true, "prevu"), /data-sansdate/);
  A.doesNotMatch(a.f.blocQuand("nDate", "2026-11-09", "j", true, "fait"), /data-sansdate/,
    "un acte passé a eu lieu un jour, même oublié");
});

test("13.ds — dès que c'est fait, l'action prend le jour où il le dit", () => {
  const a = app();
  /* Écrit le 2 novembre, sans date. On est le 8 : c'est aujourd'hui qu'il
     le fait, pas le jour où il y avait pensé. */
  planifie(a, "p1", "Donner à l'œuvre", "2026-11-02", "?");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });
  A.equal(a.db.nodes[0].prec, "j",
    "un registre de faits ne garde pas de fait sans date");
  A.equal(a.f.human(a.db.nodes[0]), "8 novembre 2026",
    "ni une date fausse : une intention ancienne tenue aujourd'hui est d'aujourd'hui");
});


/* ========================================================================
   13.dt — pas de position par défaut : l'application demande
   ======================================================================== */

test("13.dt — tant qu'il n'a pas répondu, rien ne bouge", () => {
  const a = app();
  troisActivites(a);
  a.maintenant(j(9, 0));
  a.geste({ go: "pointer" });
  a.geste({ tache: "t1" });
  a.maintenant(j(9, 30));
  a.geste({ go: "pointer" });
  a.geste({ tache: "t2" });

  A.equal(a.f.ouverts().length, 1, "la marche tourne toujours");
  A.equal(a.f.ouverts()[0].t, "t1");
  A.equal(a.db.temps.filter(b => b.t === "t2").length, 0, "et rien n'est parti");
  A.equal(a.S.poseEn, "t2", "la tape attend sa réponse");
});

test("13.dt — « en plus » ne demande qu'une fois par visite", () => {
  const a = app();
  troisActivites(a);
  a.maintenant(j(9, 0));
  a.geste({ go: "pointer" });
  a.geste({ tache: "t1" });
  a.geste({ go: "pointer" });
  a.geste({ tache: "t2" });
  a.geste({ plus: "1" });
  A.equal(a.f.ouverts().length, 2, "les deux tournent");
  A.equal(a.S.poseEn, null);

  a.geste({ tache: "t3" });
  A.equal(a.f.ouverts().length, 3, "la troisième ne coûte qu'une tape");
  A.equal(a.S.poseEn, null, "il a déjà dit ce qu'il voulait");
});

test("13.dt — arrêter n'est jamais ambigu : aucune question", () => {
  const a = app();
  troisActivites(a);
  a.maintenant(j(9, 0));
  a.geste({ go: "pointer" });
  a.geste({ tache: "t1" });
  a.maintenant(j(9, 30));
  a.geste({ go: "pointer" });
  a.geste({ tache: "t1" });
  A.equal(a.S.poseEn, null, "toucher sa propre ligne cochée ne veut dire qu'une chose");
  A.equal(a.f.ouverts().length, 0, "elle s'arrête");
});

test("13.dt — la réponse ne décide que de cette visite", () => {
  const a = app();
  troisActivites(a);
  a.maintenant(j(9, 0));
  a.geste({ go: "pointer" });
  a.geste({ tache: "t1" });
  a.geste({ go: "pointer" });
  a.geste({ tache: "t2" });
  a.geste({ plus: "1" });
  A.equal(a.f.ouverts().length, 2);

  a.geste({ go: "today" });
  A.equal(a.S.enPlus, null, "l'application ne garde pas sa réponse d'hier");
  a.geste({ go: "pointer" });
  a.geste({ tache: "t3" });
  A.equal(a.f.ouverts().length, 2, "elle redemande, plutôt que de supposer");
  A.equal(a.S.poseEn, "t3");
});


/* ========================================================================
   13.du — une seule règle de datation à la sortie de « prévu »
   ======================================================================== */

test("13.du — les deux portes vers « c'est fait » donnent le même jour", () => {
  const a = app();
  /* Prévu pour le 20, tenu le 8. Une porte par la fiche, l'autre par le
     menu : le même acte, le même résultat. */
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  planifie(a, "p2", "Jeûner un jour", "2026-11-20");

  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });
  a.S.nodeId = "p2";
  a.geste({ fait: "p2" });

  const parLaFiche = a.f.node("p1"), parLeMenu = a.f.node("p2");
  A.equal(a.f.human(parLaFiche), "8 novembre 2026",
    "un registre de faits date du jour où la chose a eu lieu");
  A.equal(a.f.human(parLeMenu), a.f.human(parLaFiche),
    "deux portes vers le même état ne peuvent pas donner deux dates");
  A.equal(parLaFiche.prevuLe, "2026-11-20", "et le jour promis n'est pas perdu");
  A.equal(parLeMenu.prevuLe, parLaFiche.prevuLe);
});

test("13.du — commencer, c'est aussi quitter « prévu »", () => {
  const a = app();
  planifie(a, "p1", "Lire les Actes", "2026-11-20");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "encours" });
  A.equal(a.f.human(a.f.node("p1")), "8 novembre 2026",
    "ce qui a commencé a commencé aujourd'hui, pas le jour promis");
  A.equal(a.f.node("p1").prevuLe, "2026-11-20");
});

test("13.du — ce qui a déjà sa vraie date ne se fait pas re-dater", () => {
  const a = app();
  const n = planifie(a, "p1", "Lire les Actes", "2026-11-02");
  n.etat = "encours";
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });
  A.equal(a.f.human(a.f.node("p1")), "2 novembre 2026",
    "une lecture commencée le 2 est datée du 2 : achever n'efface pas le début");
  A.equal(a.f.node("p1").prevuLe, undefined, "et il n'y avait aucune promesse à garder");
});

test("13.du — la fiche dit le jour promis, et se tait quand c'est le même", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });
  a.f.vNode();
  A.match(a.Z.html, /Tu l'avais prévu pour le 20 novembre 2026/,
    "ce qui était promis et ce qui a été tenu se lisent ensemble");

  const b = app();
  planifie(b, "p2", "Appeler mon père", "2026-11-08");
  b.S.view = "node"; b.S.nodeId = "p2";
  b.geste({ netat: "fait" });
  b.f.vNode();
  A.doesNotMatch(b.Z.html, /Tu l'avais prévu/,
    "prévu pour aujourd'hui et fait aujourd'hui : le redire est du bruit");
});

test("13.du — tant que c'est prévu, la date reste un pour-quand", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.f.vNode();
  A.match(a.Z.html, /20 novembre 2026/, "une promesse se lit à son jour");
  A.doesNotMatch(a.Z.html, /Tu l'avais prévu/);
});

test("13.du — l'écran de correction propose le jour, il ne l'impose pas", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-15");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ act: "edit" });
  /* Il rectifie d'abord la promesse — c'était pour le 20 — puis dit
     qu'elle est tenue. */
  a.ecrit("eDate", "2026-11-20");
  a.geste({ etat: "fait" });
  A.equal(a.f.node("p1").prevuLe, "2026-11-20",
    "le jour promis est celui qu'il venait de taper, pas celui d'avant son geste");
  A.equal(a.f.node("p1").date, "2026-11-08", "et l'écran propose aujourd'hui");
  A.equal(a.S.ePrec, "j");

  /* Rien n'est encore gardé : c'est son dernier geste qui garde (P9). */
  a.ecrit("eDate", "2026-11-07");
  a.geste({ act: "saveEdit" });
  A.equal(a.f.node("p1").date, "2026-11-07", "il peut corriger la proposition");
  A.equal(a.f.node("p1").etat, "fait");
});

test("13.du — revenir à « prévu » ne laisse pas une promesse morte", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });
  A.equal(a.f.node("p1").prevuLe, "2026-11-20");
  a.geste({ netat: "prevu" });
  A.equal(a.f.node("p1").prevuLe, undefined,
    "ce n'est plus tenu : il n'y a plus rien à dire du jour où ça l'avait été");
});

test("13.du — sans date, le passage garde la règle de 13.ds", () => {
  const a = app();
  planifie(a, "p1", "Donner à l'œuvre", "2026-11-02", "?");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });
  A.equal(a.f.human(a.f.node("p1")), "8 novembre 2026");
  A.equal(a.f.node("p1").prevuLe, undefined,
    "il n'y avait aucun jour promis : en inventer un serait mentir");
});


/* ========================================================================
   13.dv — le jour promis se lit aussi dans les listes
   ======================================================================== */

test("13.dv — la ligne dit les deux jours : celui promis et celui tenu", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });

  const ligne = a.f.ligneActe(a.f.node("p1"), {});
  A.match(ligne, /8 novembre 2026/, "le jour où ça a eu lieu");
  A.match(ligne, /promis le 20 nov\./,
    "et le jour qui avait été promis, sans ouvrir la fiche");
});

test("13.dv — « promis », parce que « prévu » est déjà l'état", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "encours" });
  const ligne = a.f.ligneActe(a.f.node("p1"), {});
  A.match(ligne, /promis le 20 nov\./);
  A.match(ligne, /en cours/, "l'état se dit toujours");
  A.doesNotMatch(ligne, /prévu le/,
    "deux sens pour un mot dans la même ligne, c'est une ligne qui ment");
});

test("13.dv — tant que c'est prévu, la ligne ne dit qu'un jour", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  const ligne = a.f.ligneActe(a.f.node("p1"), {});
  A.match(ligne, /20 novembre 2026/);
  A.doesNotMatch(ligne, /promis/,
    "une promesse qui n'est pas encore tenue n'a rien à rappeler");
});

test("13.dv — rien à redire quand c'est le jour dit", () => {
  const a = app();
  planifie(a, "p1", "Appeler mon père", "2026-11-08");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });
  A.doesNotMatch(a.f.ligneActe(a.f.node("p1"), {}), /promis/,
    "promis pour aujourd'hui et fait aujourd'hui : le redire est du bruit");
});

test("13.dv — l'année ne se dit que si ce n'est pas celle-ci", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  planifie(a, "p2", "Rendre la visite promise", "2025-12-03");
  a.S.view = "node";
  a.S.nodeId = "p1"; a.geste({ netat: "fait" });
  a.S.nodeId = "p2"; a.geste({ netat: "fait" });

  A.equal(a.f.promisBref(a.f.node("p1")), "promis le 20 nov.",
    "redire l'année courante à chaque ligne est du bruit");
  A.equal(a.f.promisBref(a.f.node("p2")), "promis le 3 déc. 2025",
    "une promesse d'une autre année, elle, a besoin de son année");
});

test("13.dv — une seule porte : toutes les listes le disent du même coup", () => {
  const a = app();
  planifie(a, "p1", "Jeûner un jour", "2026-11-20");
  a.S.view = "node"; a.S.nodeId = "p1";
  a.geste({ netat: "fait" });

  a.S.view = "actes"; a.f.vActes();
  A.match(a.Z.html, /promis le 20 nov\./, "dans « Mes actes »");

  a.db.nodes.push({ id: "s1", act: "dieu", dest: "moi", kind: "acte",
    txt: "Il a répondu", man: "", par: ["p1"], suj: [], date: "2026-11-08",
    prec: "j", etat: "fait", ts: 2, maj: 2 });
  a.S.view = "node"; a.S.nodeId = "s1"; a.f.vNode();
  A.match(a.Z.html, /promis le 20 nov\./, "et sous « En réponse à »");
});
