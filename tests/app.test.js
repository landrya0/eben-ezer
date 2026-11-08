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
  a.f.poseTache("a3");
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

test("13.dd — par défaut, un raccourci arrête ce qui tourne", () => {
  const a = app();
  deuxEpinglees(a);
  a.maintenant(j(9, 30));
  a.geste({ ep: "t2" });

  const marche = a.db.temps.filter(b => b.t === "t1")[0];
  A.ok(marche.fin, "la marche s'est arrêtée");
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

test("13.dd — l'interrupteur ne vaut que pour le geste qu'on vient de faire", () => {
  const a = app();
  deuxEpinglees(a);
  a.db.taches.push({ id: "t3", nom: "Manger", cat: "soi", ep: 3000, maj: 1 });
  a.maintenant(j(9, 30));
  a.S.enPlus = true;
  a.geste({ ep: "t2" });
  A.equal(a.S.enPlus, false, "il retombe aussitôt");

  a.maintenant(j(10, 0));
  a.geste({ ep: "t3" });
  A.equal(a.f.ouverts().length, 1, "manger arrête les deux : on n'a rien demandé d'autre");
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
