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

/* 13.cx disait « à une touche » : la circonstance arrivait en tête, non
   cochée. Les sondes ont montré que cette touche n'arrivait jamais — zéro
   tape sur `data-pdt` en 296 gestes, pour six actes gardés. 13.ej l'a donc
   changée en supposition : l'app pose ce qu'elle lit, et une tape la
   dément. Le reste de 13.cx ne bouge pas, et ce test le défend encore. */
test("13.cx — toucher la circonstance la pose, la retoucher la retire", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Enseignements de TA", cat: "dieu", d: "litt", maj: 1 },
                 { id: "a2", nom: "Prière", cat: "dieu", d: "priere", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", j(11, 0), null), bloc("b2", "a2", j(11, 30), null)];

  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  A.equal(a.S.draft.pdt, null, "deux choses tournent : l'app ne tranche pas entre elles");

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
  a.S.vifPour = "suite";
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
  a.S.vifPour = "suite";
  a.f.poseTache("a2");
  A.equal(a.S.vifPour, "", "l'interrupteur retombe : il ne vaut pas pour la suite");

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
  A.match(a.f.sujetHist(s), /3 séances/);
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
  A.match(a.Z.html, /nommé dans 3 séances, depuis le 1er novembre/);
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
  a.geste({ go: "sync" });
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
  A.equal(a.f.soSauf("go", "sync"), "sync");
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
  A.equal(a.f.soSigne("Commencé : Jeûne"), "Commencé : …");
  A.equal(a.f.soSigne("« Prière » existe déjà — réunis les deux activités"),
    "«…» existe déjà — réunis les deux activités");
  A.equal(a.f.soSigne("2 blocs réunis."), "n blocs réunis.",
    "les chiffres se rangent ensemble");
});

test("13.dn — un refus se distingue d'une confirmation sans le déclarer", () => {
  const a = app();
  surOnglet(a);
  a.geste({ go: "perNeuf" });
  /* Commencer sans dire quelle routine : l'app parle, et rien ne s'écrit. */
  a.geste({ act: "perCommencer" });
  const x = Array.from(a.SO.g).pop();
  A.equal(x.r, "Choisis la routine", "la parole est gardée");
  A.equal(x.s, undefined, "et rien n'a été écrit : c'est un refus");

  /* Un vrai enregistrement, lui, porte la marque de l'écriture. */
  a.ctx.document.getElementById("pdDisc").value = "jeune";
  a.poseHeure("pdDeb", MIDI - H);
  a.geste({ act: "perCommencer" });
  const y = Array.from(a.SO.g).pop();
  A.equal(y.s, 1, "une écriture a eu lieu");
  A.equal(a.f.soBilan().refus.length, 1, "la confirmation ne compte pas pour un refus");
});

test("13.dn — le bilan nomme la porte qui coûte, et mène à elle", () => {
  const a = app();
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "sync" });
    a.geste({ go: "data" });
  }
  const b = a.f.soBilan();
  const c = b.couts.filter(function (x) { return x.v === "data"; })[0];
  A.ok(c, "l'écran atteint le plus loin est là");
  A.equal(c.n, 3, "trois visites");
  A.equal(c.med, 2, "deux gestes chaque fois");
  A.equal(c.poids, 3, "trois gestes qu'un raccourci lui aurait rendus");
  A.equal(b.couts[0].v, "data", "et il passe devant, parce qu'il coûte plus");

  /* Un chiffre qui accuse doit mener quelque part (13.cb). */
  a.f.vSondes();
  A.match(a.Z.html, /data-go="data"/);
  A.match(a.Z.html, /Mes données/);
});

test("13.dn — le demi-tour dit où il voulait aller", () => {
  const a = app();
  for (let i = 0; i < 2; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "sync" });   // la mauvaise porte
    a.geste({ back: "1" });      // reparti aussitôt, sans rien écrire
    a.geste({ go: "temps" });    // ce qu'il cherchait
    a.geste({ go: "actes" });
  }
  const b = a.f.soBilan();
  const t = b.tours.filter(function (x) { return x.v === "sync"; })[0];
  A.ok(t, "le demi-tour est vu");
  A.equal(t.n, 2);
  A.equal(t.suite[0].v, "temps", "et l'écran suivant dit ce qu'il cherchait");
  a.f.vSondes();
  A.match(a.Z.html, /tu allais à Mon temps/);
});

test("13.dn — un écran où il écrit n'est pas un demi-tour", () => {
  const a = app();
  a.db.periodes = [{ id: "pr1", d: "jeune", deb: MIDI - H, fin: MIDI, maj: 1 }];
  a.geste({ go: "actes" });
  a.geste({ go: "temps" });
  a.geste({ prd: "pr1" });
  a.geste({ act: "perEffacer" });      // il a fait ce qu'il venait faire
  a.geste({ back: "1" });
  A.equal(a.f.soBilan().tours.length, 0,
    "être reparti après avoir écrit, c'est avoir réussi");
});

test("13.dn — les refus se regroupent par écran", () => {
  const a = app();
  a.geste({ go: "perNeuf" });
  a.geste({ act: "perCommencer" });
  a.geste({ act: "perCommencer" });
  a.geste({ act: "perCommencer" });
  const b = a.f.soBilan();
  A.equal(b.refus[0].n, 3, "trois fois le même refus");
  A.equal(b.refus[0].r, "Choisis la routine");
  A.equal(b.refus[0].w, "perNeuf", "et l'écran qui demande mal est nommé");
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
    a.geste({ go: "sync" });
    a.geste({ go: "data" });
  }
  A.match(a.f.soEtat(), /3 gestes de trop sur « Mes données »/);
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
  for (let i = 0; i < 6; i++) { a.geste({ go: "actes" }); a.geste({ go: "sync" }); }
  const b = a.f.soBilan();
  A.equal(b.couts.filter(function (c) { return c.v === "sync"; }).length, 0,
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
    a.geste({ go: "sync" });
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
    a.geste({ go: "sync" });
    a.geste({ go: "data" });
    a.geste({ back: "1" });
  }
  const c = a.f.soBilan().chemins[0];
  A.ok(c, "le trajet repris trois fois est là");
  A.equal(c.suite, "Synchronisation → Mes données → Retour",
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

  a.geste({ potog: "data" });
  const h = sousLePouce(a);
  A.match(h, /Aller tout de suite/);
  A.match(h, /data-go="data"/, "la ligne mène à l'écran");
  A.match(h, /Mes données/);
  A.equal(a.f.portesEp().length, 1);
});

test("13.do — une porte et un raccourci ne portent pas la même forme", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Prière", cat: "dieu", ep: 1, maj: 1 }];
  a.geste({ potog: "sync" });
  const h = sousLePouce(a);
  /* Un raccourci d'activité fait partir le compteur ; une porte ouvre un
     écran. Deux blocs, deux titres : les mêler ferait démarrer un compteur
     à qui voulait seulement regarder (13.cu). */
  A.match(h, /data-ep="a1"/, "le raccourci d'activité est là");
  A.match(h, /Le compteur part/, "et il dit ce qu'il fait");
  A.match(h, /data-go="sync"/, "la porte aussi");
  A.ok(a.Z.html.indexOf("Le compteur part") < a.Z.html.indexOf("Aller tout de suite"),
    "chacune dans son bloc, et le compteur d'abord");
  A.ok(!/data-ep="sync"/.test(h), "une porte ne démarre rien");
});

test("13.do — décrocher laisse une pierre tombale", () => {
  const a = app();
  a.geste({ potog: "sync" });
  const id = a.f.portesEp()[0].id;
  a.geste({ potog: "sync" });
  A.equal(a.f.portesEp().length, 0, "la seconde tape décroche");
  A.ok(a.db.morts[id], "et laisse sa pierre (13.be)");

  /* Sans elle, l'autre appareil la remettrait à la synchronisation. */
  const B = JSON.parse(JSON.stringify(a.db));
  B.morts = {};
  B.portes = [{ id: id, v: "sync", ep: 1, maj: 1 }];
  const d = a.f.fusionne(JSON.parse(JSON.stringify(a.db)), B);
  A.equal(Array.from(d.portes).length, 0, "elle ne ressuscite pas");
});

test("13.do — les portes voyagent à la synchronisation", () => {
  const a = app();
  a.geste({ potog: "sync" });
  const B = a.f.sane({ portes: [{ id: "po9-zz", v: "cahier", ep: 1, maj: 2 }] });
  const d = a.f.fusionne(JSON.parse(JSON.stringify(a.db)), B);
  const vs = Array.from(d.portes).map(function (p) { return p.v; }).sort();
  A.deepStrictEqual(vs, ["cahier", "sync"], "les deux appareils se réunissent");
});

test("13.do — deux fois la même porte n'est pas deux raccourcis", () => {
  const a = app();
  /* Deux appareils peuvent l'avoir épinglée chacun de son côté. */
  const d = a.f.sane({ portes: [
    { id: "po1-aa", v: "sync", ep: 1, maj: 1 },
    { id: "po2-bb", v: "sync", ep: 2, maj: 1 },
    { id: "po3-cc", v: "cahier", ep: 3, maj: 1 }
  ] });
  A.equal(Array.from(d.portes).length, 2);
  A.equal(Array.from(d.portes)[0].v, "sync");

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
  A.ok(vs.indexOf("data") !== -1);
  A.equal(vs.indexOf("actes"), -1);
  A.equal(vs.indexOf("node"), -1);
});

test("13.do — l'ordre se règle à la main : ce qu'on touche passe en premier", () => {
  const a = app();
  a.geste({ potog: "sync" });
  a.geste({ potog: "cahier" });
  a.geste({ potog: "data" });
  A.deepStrictEqual(Array.from(a.f.portesEp()).map(function (p) { return p.v; }),
    ["sync", "cahier", "data"], "d'abord l'ordre où on les a posées");

  a.geste({ go: "ordre" });
  A.match(a.Z.html, /Dans quel ordre|en premier/);
  a.geste({ pohaut: "data" });
  A.deepStrictEqual(Array.from(a.f.portesEp()).map(function (p) { return p.v; }),
    ["sync", "cahier", "data"].filter(function (v) { return v !== "data"; })
      .reduce(function (o, v) { o.push(v); return o; }, ["data"]),
    "la touchée passe devant, les autres gardent leur ordre");

  /* Et les rangs se suivent : c'est ce qui les réunit sans ambiguïté. */
  A.deepStrictEqual(Array.from(a.f.portesEp()).map(function (p) { return p.ep; }), [1, 2, 3]);

  /* La première ne bouge plus : elle n'a pas de ligne à toucher. */
  a.f.vOrdre();
  A.ok(!/data-pohaut="data"/.test(a.Z.html));
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
  a.geste({ potog: "sync" });
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
    a.geste({ go: "sync" });
    a.geste({ go: "data" });
    a.geste({ go: "sondes" });
  }
  const b = a.f.soBilan();
  A.match(a.f.soPropose(b), /Mettre « Comment je m'en sers » sous le pouce/);
  /* Trois tapes réelles : l'onglet, puis deux. Sous le pouce : le bouton du
     milieu, puis la ligne. Les deux comptent leur tape de rail. */
  A.match(a.f.soPropose(b), /4 gestes aujourd'hui, 2 depuis n'importe où/);
  A.match(a.f.soPropose(b), /data-eppo="sondes"/);

  /* Une fois épinglée, elle n'est plus proposée — et la suivante non plus,
     si elle ne coûte que deux gestes : promettre un gain de rien serait un
     chiffre faux. */
  a.geste({ eppo: "sondes" });
  A.ok(a.f.porteEp("sondes"), "le disciple épingle, l'application proposait");
  const b2 = a.f.soBilan();
  A.equal(b2.couts.filter(function (x) { return x.v === "sync"; }).length, 0,
    "Synchronisation est déjà à un geste du rail : une épingle ne rendrait rien");
  /* Mes données reste à deux gestes : c'est le suivant qu'on propose. */
  A.match(a.f.soPropose(b2), /Mettre « Mes données » sous le pouce/);
  a.geste({ eppo: "data" });
  A.equal(a.f.soPropose(a.f.soBilan()), "", "et quand tout est épinglé, plus rien");
});

test("13.do — revenir sur un écran n'est pas s'y rendre", () => {
  const a = app();
  /* Le chemin réel : l'onglet, Synchronisation, Mes données, puis retour.
     Le retour repasse par Synchronisation — sans que ce soit un trajet vers lui. */
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "sync" });
    a.geste({ go: "data" });
    a.geste({ back: "1" });
    a.geste({ back: "1" });
  }
  const b = a.f.soBilan();
  A.equal(b.couts.filter(function (c) { return c.v === "sync"; }).length, 0,
    "Synchronisation est à un geste de l'onglet : il ne coûte rien");
  A.equal(b.couts.filter(function (c) { return c.v === "data"; })[0].med, 2,
    "et Mes données en coûte deux, pas davantage à chaque tour");
  A.match(a.f.soPropose(b), /Mettre « Mes données » sous le pouce/,
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
  a.S.vifPour = "suite";
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

  /* Un acte achevé se lit derrière la porte « Ce que j'ai fait » (13.dy) —
     c'est le même `ligneActe`, donc le même pied. */
  a.S.view = "accomplis"; a.f.vAccomplis();
  A.match(a.Z.html, /promis le 20 nov\./, "dans « Ce que j'ai fait »");

  a.db.nodes.push({ id: "s1", act: "dieu", dest: "moi", kind: "acte",
    txt: "Il a répondu", man: "", par: ["p1"], suj: [], date: "2026-11-08",
    prec: "j", etat: "fait", ts: 2, maj: 2 });
  a.S.view = "node"; a.S.nodeId = "s1"; a.f.vNode();
  A.match(a.Z.html, /promis le 20 nov\./, "et sous « En réponse à »");
});


/* ========================================================================
   13.dx — un écran ne se justifie que par une question
   ======================================================================== */

/* Noter une parole de Lui, par le chemin réel, jusqu'au dernier écran. */
function paroleDeLui(a) {
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  a.ecrit("nTxt", "Je ne te laisserai point");
  a.actions.suite();
  a.geste({ man: "parle" });
  a.actions.suite();
  a.f.vNote();
  return a.S.draft;
}

test("13.dx — ce qui vient de Lui n'a plus d'écran pour le jour", () => {
  const a = app();
  const lui = { act: "dieu", par: [], suj: [], date: a.f.today(), prec: "j", fige: false };
  const moi = { act: "moi", dest: "dieu", par: [], suj: [], date: a.f.today(), prec: "j", fige: false };
  A.equal(Array.from(a.f.etapes(lui)).indexOf("quand"), -1,
    "il ne demandait qu'une date que l'app connaît déjà");
  A.ok(Array.from(a.f.etapes(moi)).indexOf("quand") !== -1,
    "pour un acte à moi, ce même écran porte une vraie question : où ça en est");
  A.equal(Array.from(a.f.etapes(lui)).length,
          Array.from(a.f.etapes(moi)).length - 1, "un écran de moins");
});

test("13.dx — le jour se dit quand même, sur l'écran où l'on garde", () => {
  const a = app();
  const d = paroleDeLui(a);
  A.equal(a.S.step, a.f.etapes(d).length - 1, "c'est bien le dernier écran");
  A.match(a.Z.html, /Aujourd'hui/, "la supposition de l'app se voit avant de garder");
  A.match(a.Z.html, /data-qouv/, "et une tape la défait");
  A.match(a.Z.action, /Garder/);
});

test("13.dx — gardé sans rien toucher, l'acte porte le jour même", () => {
  const a = app();
  paroleDeLui(a);
  a.actions.saveNote();
  const n = a.db.nodes[a.db.nodes.length - 1];
  A.equal(n.date, a.f.today());
  A.equal(n.prec, "j");
});

test("13.dx — une tape déplie le calendrier, et le jour choisi est gardé", () => {
  const a = app();
  paroleDeLui(a);
  a.geste({ qouv: "1" });
  A.ok(a.S.qOuv);
  A.match(a.Z.html, /id="nDate"/, "le calendrier est là, sans changer d'écran");
  A.doesNotMatch(a.Z.html, /Où ça en est/,
    "et il ne pose pas la question qui n'est pas la sienne");

  a.ecrit("nDate", "2026-11-03");
  a.actions.saveNote();
  const n = a.db.nodes[a.db.nodes.length - 1];
  A.equal(n.date, "2026-11-03", "c'est son jour, pas celui que l'app supposait");
});

test("13.dx — on ne replie jamais à sa place", () => {
  const a = app();
  const d = paroleDeLui(a);
  /* Un jour déjà choisi : le replier cacherait ce qu'il vient de dire. */
  d.date = "2026-11-03";
  a.f.vNote();
  A.match(a.Z.html, /id="nDate"/, "le calendrier s'ouvre de lui-même");
  A.doesNotMatch(a.Z.html, /data-qouv/, "il n'y a plus rien à déplier");
});

test("13.dx — le calendrier déplié ne survit pas à la capture", () => {
  const a = app();
  paroleDeLui(a);
  a.geste({ qouv: "1" });
  a.actions.saveNote();
  A.equal(a.S.qOuv, false,
    "la note suivante ne rouvre pas une question qui ne se posait pas");
});

test("13.dx — rien sur l'écran qui garde un autre acte", () => {
  const a = app();
  paroleDeLui(a);
  a.S.cNeuf = true;
  a.f.vNote();
  A.doesNotMatch(a.Z.html, /data-qouv/,
    "« ajouter ce qui a précédé » date l'acte d'avant, pas celui-ci");
});


/* ========================================================================
   13.dy — « Mes actes » dit ce qui m'attend ; le reste a sa porte
   ======================================================================== */

function vingtCinqFaits(a) {
  for (let i = 1; i <= 25; i++)
    a.db.nodes.push({ id: "f" + i, act: "moi", dest: "dieu", kind: "acte",
      txt: "Acte accompli numéro " + i, man: "", par: [], suj: [],
      date: "2026-10-" + String(i).padStart(2, "0"), prec: "j",
      etat: "fait", ts: i, maj: 1 });
  return a.db.nodes.filter(n => n.etat === "fait");
}

test("13.dy — tout ce qui est fait est atteignable, pas seulement douze", () => {
  const a = app();
  vingtCinqFaits(a);
  a.S.view = "accomplis"; a.f.vAccomplis();
  for (const n of ["Acte accompli numéro 1", "Acte accompli numéro 13",
                   "Acte accompli numéro 25"])
    A.match(a.Z.html, new RegExp(n.replace(/ /g, " ")),
      "une archive qu'on ne peut pas relire n'est pas une archive");
});

test("13.dy — « Mes actes » n'en porte plus la liste, mais la porte", () => {
  const a = app();
  vingtCinqFaits(a);
  a.S.view = "actes"; a.f.vActes();
  A.match(a.Z.html, /data-go="accomplis"/, "la porte est là");
  A.match(a.Z.html, /25 actes/, "et elle dit combien elle garde");
  A.doesNotMatch(a.Z.html, /Acte accompli numéro 1</,
    "l'écran ne répond plus qu'à une question : qu'est-ce qui m'attend");
  A.doesNotMatch(a.Z.html, /et 13 autres/,
    "et il n'annonce plus un reste qui ne menait nulle part");
});

test("13.dy — la porte dit le dernier, pour que le geste ait un écho", () => {
  const a = app();
  vingtCinqFaits(a);
  a.S.view = "actes"; a.f.vActes();
  A.match(a.Z.html, /le dernier 25 octobre 2026/,
    "ce qu'on vient d'achever se voit sans ouvrir");
});

test("13.dy — rien de fait : pas de porte vers une pièce vide", () => {
  const a = app();
  a.S.view = "actes"; a.f.vActes();
  A.doesNotMatch(a.Z.html, /data-go="accomplis"/,
    "une porte qui ne mène nulle part n'est pas une porte");
  A.match(a.Z.html, /Ce que tu auras fait passera ici/,
    "un bloc vide dit comment il se remplit");
});

test("13.dy — l'écran range par mois, comme « Ses œuvres » range les Siennes", () => {
  const a = app();
  vingtCinqFaits(a);
  a.db.nodes.push({ id: "f99", act: "moi", dest: "dieu", kind: "acte",
    txt: "Un acte de novembre", man: "", par: [], suj: [], date: "2026-11-02",
    prec: "j", etat: "fait", ts: 99, maj: 1 });
  a.S.view = "accomplis"; a.f.vAccomplis();
  A.match(a.Z.html, /novembre 2026/);
  A.match(a.Z.html, /octobre 2026/);
  A.ok(a.Z.html.indexOf("novembre 2026") < a.Z.html.indexOf("octobre 2026"),
    "le plus récent en haut : c'est le sens où l'on relit");
});

test("13.dy — ce qui m'attend ne passe pas derrière la porte", () => {
  const a = app();
  vingtCinqFaits(a);
  planifie(a, "p1", "Visiter la sœur Mbarga", "2026-11-14");
  a.db.nodes.push({ id: "e1", act: "moi", dest: "dieu", kind: "acte",
    txt: "Lire les Actes en entier", man: "", par: [], suj: [],
    date: "2026-11-02", prec: "j", etat: "encours", ts: 1, maj: 1 });
  a.S.view = "actes"; a.f.vActes();
  A.match(a.Z.html, /Lire les Actes en entier/, "ce qui dure reste sous les yeux");
  A.match(a.Z.html, /Visiter la sœur Mbarga/, "ce qui vient aussi");

  a.S.view = "accomplis"; a.f.vAccomplis();
  A.doesNotMatch(a.Z.html, /Lire les Actes en entier/,
    "et ce qui n'est pas fait n'a rien à faire dans ce qui est fait");
  A.doesNotMatch(a.Z.html, /Visiter la sœur Mbarga/);
});

test("13.dy — la porte s'épingle, comme toute porte qui tient debout seule", () => {
  const a = app();
  A.ok(Array.from(a.f.portables()).indexOf("accomplis") !== -1);
  a.geste({ potog: "accomplis" });
  A.ok(a.f.porteEp("accomplis"), "sous le pouce si c'est là qu'il relit");
});

test("13.dy — un écran dont on ne sort pas n'est pas un écran", () => {
  const a = app();
  vingtCinqFaits(a);
  a.S.pile = []; a.S.view = "actes";
  a.geste({ go: "accomplis" });
  A.equal(a.S.view, "accomplis");
  /* Un `haut` sans `file` remplace la barre par le titre, et emporte le
     bouton Retour avec elle. */
  A.ok(a.Z.retour, "la barre garde son retour");
  A.ok(a.Z.file, "le titre descend dans la page plutôt que de prendre la barre");
  a.geste({ back: "1" });
  A.equal(a.S.view, "actes", "et il ramène d'où l'on vient");
});


/* ========================================================================
   13.dz — le résumé dit ce qu'on a lu, pas seulement combien
   ======================================================================== */

/* « dans les routines, dans le resumé il faut qu'on voit ce que j'ai lu,
   pas juste le nombre. » */
function li(a, nom) {
  for (let i = 0; i < 66; i++) if (a.f.nomLivre(i) === nom) return i;
  throw new Error("livre introuvable : " + nom);
}
function lisant(a) {
  a.db.taches = [
    { id: "a1", nom: "Lecture de la Parole", cat: "dieu", d: "parole", maj: 1 },
    { id: "a2", nom: "Lecture d'un livre", cat: "dieu", d: "litt", maj: 1 }
  ];
  a.db.temps = [];
  return { gen: li(a, "Genèse"), ex: li(a, "Exode"), ps: li(a, "Psaumes") };
}
function lit(a, id, h, refs) {
  a.db.temps.push(bloc(id, "a1", j(h, 0), j(h + 1, 0), { lu: refs }));
}

test("13.dz — le résumé nomme les passages", () => {
  const a = app();
  const L = lisant(a);
  lit(a, "b1", 8, [[L.ps, 23, 23]]);
  lit(a, "b2", 10, [[L.gen, 1, 3]]);
  const rs = Array.from(a.f.chapitresFen(j(0, 0), j(23, 59)));
  A.equal(a.f.resumeLus(rs, a.f.nomPassage), "Genèse 1 à 3 · Psaumes 23",
    "« j'ai lu Jean » se retient, « j'ai lu 7 » ne se retient pas");
  A.equal(a.f.chapFen(j(0, 0), j(23, 59)).ch, 4, "et le nombre reste, il dit la fidélité");
});

test("13.dz — ce qui se touche se réunit, même d'un jour à l'autre", () => {
  const a = app();
  const L = lisant(a);
  a.db.temps.push(bloc("b1", "a1", jour(3, 8, 0), jour(3, 9, 0), { lu: [[L.gen, 1, 3]] }));
  a.db.temps.push(bloc("b2", "a1", jour(2, 8, 0), jour(2, 9, 0), { lu: [[L.gen, 4, 6]] }));
  a.db.temps.push(bloc("b3", "a1", jour(1, 8, 0), jour(1, 9, 0), { lu: [[L.gen, 7, 9]] }));
  const rs = Array.from(a.f.chapitresFen(jour(1, 0, 0), MIDI));
  A.equal(a.f.resumeLus(rs, a.f.nomPassage), "Genèse 1 à 9",
    "un mois de fidélité continue est un passage, pas trente lignes");
});

test("13.dz — la réunion ignore la frontière des livres, et la dit quand même", () => {
  const a = app();
  const L = lisant(a);
  lit(a, "b1", 8, [[L.gen, 49, 50]]);
  lit(a, "b2", 10, [[L.ex, 1, 2]]);
  const rs = Array.from(a.f.chapitresFen(j(0, 0), j(23, 59)));
  A.equal(a.f.resumeLus(rs, a.f.nomPassage), "Genèse 49 à 50 · Exode 1 à 2",
    "une lecture continue ne s'arrête pas à Genèse 50, mais elle se nomme par livre");
});

test("13.dz — ce qui est hors de la fenêtre n'entre pas dans le résumé", () => {
  const a = app();
  const L = lisant(a);
  a.db.temps.push(bloc("b1", "a1", jour(2, 8, 0), jour(2, 9, 0), { lu: [[L.ex, 1, 5]] }));
  lit(a, "b2", 8, [[L.gen, 1, 2]]);
  const rs = Array.from(a.f.chapitresFen(j(0, 0), j(23, 59)));
  A.equal(a.f.resumeLus(rs, a.f.nomPassage), "Genèse 1 à 2",
    "le résumé est celui de la fenêtre, pas de toute la vie");
});

test("13.dz — les pages se réunissent par livre, et deux livres ne se confondent pas", () => {
  const a = app();
  lisant(a);
  a.db.livres = [{ id: "l1", nom: "Une voix pour le réveil", pages: 200, maj: 1 },
                 { id: "l2", nom: "Le disciple", pages: 120, maj: 1 }];
  a.db.temps.push(bloc("b1", "a2", j(8, 0), j(9, 0), { pg: [["l1", 10, 20]] }));
  a.db.temps.push(bloc("b2", "a2", j(10, 0), j(11, 0), { pg: [["l1", 21, 30]] }));
  a.db.temps.push(bloc("b3", "a2", j(14, 0), j(15, 0), { pg: [["l2", 3, 5]] }));
  const rs = Array.from(a.f.pagesFenPar(j(0, 0), j(23, 59)));
  A.equal(a.f.resumeLus(rs, a.f.nomPassagePg),
    "Une voix pour le réveil, pages 10 à 30 · Le disciple, pages 3 à 5");
  A.equal(a.f.pagesFen(j(0, 0), j(23, 59)).pg, 24);
});

test("13.dz — au-delà de huit passages, la ligne cesse d'être un résumé", () => {
  const a = app();
  const L = lisant(a);
  /* Dix passages épars : un chapitre sur deux, rien ne se touche. */
  for (let k = 0; k < 10; k++) lit(a, "b" + k, 6 + k, [[L.ps, 1 + k * 2, 1 + k * 2]]);
  const rs = Array.from(a.f.chapitresFen(j(0, 0), j(23, 59)));
  A.equal(rs.length, 10);
  const t = a.f.resumeLus(rs, a.f.nomPassage);
  A.match(t, /…et 2 de plus$/, "le reste se dit");
  A.equal(t.split(" · ").length, 9, "huit passages, et la mention");
});

test("13.dz — rien de lu : la phrase d'avant tient", () => {
  const a = app();
  lisant(a);
  A.equal(a.f.resumeLus(Array.from(a.f.chapitresFen(j(0, 0), j(23, 59))), a.f.nomPassage), "",
    "et c'est l'écran qui dit « Rien de lu »");
});


/* ========================================================================
   13.ea — une borne qui n'est pas encore arrivée n'est pas une borne
   ======================================================================== */

/* « le bug c'est le compteur stoppé. » Le rail disait « Rien de compté ·
   0 s » à 13 h 10 pendant que « Mon temps » disait « 12 h 39 compté
   aujourd'hui » — c'est-à-dire depuis 0 h 31, sans un creux. Les deux
   lisaient le même bloc : une fin posée plus loin que maintenant. */

test("13.ea — une fin qui n'est pas encore arrivée est refusée", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", j(0, 31), j(11, 0))];
  a.f.save();
  a.ouvreBloc(a.db.temps[0]);
  a.poseHeure("bFin", j(23, 0));
  a.actions.majBloc();
  A.equal(a.db.temps[0].fin, j(11, 0),
    "on ne déclare pas un temps qu'on n'a pas encore vécu");
  A.match(a.dernierToast(), /pas encore/, "et l'app dit pourquoi elle n'a rien gardé");
});

test("13.ea — un temps mis à part ne se referme pas non plus dans l'avenir", () => {
  const a = app();
  a.db.periodes = [{ id: "p1", d: "jeune", deb: j(6, 0), fin: j(10, 0), maj: 1 }];
  a.f.save();
  a.ouvrePeriode(a.db.periodes[0]);
  a.poseHeure("pdFin", j(20, 0));
  a.actions.perGarder();
  A.equal(a.db.periodes[0].fin, j(10, 0), "la même règle vaut pour les deux bornes");
});

test("13.ea — une fin déjà dans l'archive se lit à maintenant", () => {
  const a = app();
  deuxActivites(a);
  /* Ce que l'app a laissé passer avant la règle, et qui reste sur
     l'appareil : elle doit pouvoir s'en relever toute seule. */
  a.ctx.localStorage.setItem(a.c.KEY, JSON.stringify({
    taches: [{ id: "a1", nom: "Travailler", maj: 1 }],
    temps: [{ id: "b1", t: "a1", deb: j(0, 31), fin: j(23, 0), maj: 1 }], seq: 9
  }));
  a.f.load();
  A.equal(a.db.temps[0].fin, MIDI, "une borne ne dépasse pas l'instant où on la lit");
});

test("13.ea — et le rail cesse alors de dire 0 s", () => {
  const a = app();
  deuxActivites(a);
  a.ctx.localStorage.setItem(a.c.KEY, JSON.stringify({
    taches: [{ id: "a1", nom: "Travailler", maj: 1 }],
    temps: [{ id: "b1", t: "a1", deb: j(0, 31), fin: j(10, 0), maj: 1 },
            { id: "b2", t: "a1", deb: j(10, 30), fin: j(23, 0), maj: 1 }], seq: 9
  }));
  a.f.load();
  const vif = a.f.creuxVif();
  A.ok(vif && vif.deb <= MIDI, "le creux ne commence jamais après l'heure qu'il est");
});

test("13.ea — rien ne se perd : la borne redressée ne tombe pas sous son début", () => {
  const a = app();
  a.ctx.localStorage.setItem(a.c.KEY, JSON.stringify({
    taches: [{ id: "a1", nom: "Travailler", maj: 1 }],
    temps: [{ id: "b1", t: "a1", deb: j(14, 0), fin: j(15, 0), maj: 1 }], seq: 9
  }));
  a.f.load();
  const b = a.db.temps[0];
  A.ok(b, "le bloc est toujours là");
  A.ok(b.fin > b.deb, "un bloc dont la fin passerait avant le début serait effacé par la réunion");
});

test("13.ea — une fin passée reste intacte", () => {
  const a = app();
  deuxActivites(a);
  a.db.temps = [bloc("b1", "a1", j(8, 0), j(9, 30))];
  a.f.save();
  a.ouvreBloc(a.db.temps[0]);
  a.poseHeure("bFin", j(10, 0));
  a.actions.majBloc();
  A.equal(a.db.temps[0].fin, j(10, 0), "corriger ce qui a eu lieu reste possible");
});

test("13.ea — un bloc en cours n'est pas une fin dans l'avenir", () => {
  const a = app();
  a.ctx.localStorage.setItem(a.c.KEY, JSON.stringify({
    taches: [{ id: "a1", nom: "Travailler", maj: 1 }],
    temps: [{ id: "b1", t: "a1", deb: j(0, 31), maj: 1 }], seq: 9
  }));
  a.f.load();
  A.equal(a.db.temps[0].fin, undefined, "personne ne ferme un compteur à la place du disciple");
});


/* ========================================================================
   Les balayages — ce qu'un test écran par écran ne voit pas
   ========================================================================

   Le harnais donne à l'application un navigateur de carton : `querySelector`
   rend toujours `null`, et aucune boîte n'a de dimensions. Toute une classe
   de fautes lui est donc invisible — une mise en page cassée, un bouton
   Retour emporté avec la barre, un attribut oublié dans le sélecteur du
   délégué. Ces fautes-là ne se rattrapent pas en écrivant un test de plus
   par écran : elles se rattrapent en passant TOUS les écrans au même crible,
   une fois, et en laissant la liste des écrans se découvrir elle-même. Un
   écran neuf entre dans le balayage sans qu'on y pense ; c'est tout
   l'intérêt.

   v100 a failli livrer « Ce que j'ai fait » sans porte de sortie ; v102 a
   demandé dix minutes de fausses pistes qu'un de ces balayages a coupées
   net. Ils vivent donc ici. */

const fs = require("node:fs");
const path = require("node:path");

/* Les écrans qui se tiennent seuls, et ceux qui veulent un contexte. */
const AVEC_CONTEXTE = ["node", "edit", "lier", "bloc", "tache", "livre",
  "auteur", "sujet", "promesse", "periode", "chemin", "frise", "quand", "note"];

/* Une archive ordinaire : de quoi que chaque écran ait quelque chose à dire.
   Sans elle, un écran vide passerait pour un écran sain. */
function archiveOrdinaire(a) {
  a.db.taches = [
    { id: "a1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 },
    { id: "a2", nom: "Lecture de la Parole", cat: "dieu", d: "parole", maj: 1 }
  ];
  a.db.temps = [bloc("b1", "a1", j(8, 0), j(9, 0)),
                bloc("b2", "a2", j(10, 0), j(11, 0), { lu: [[42, 1, 3]] }),
                /* Une séance qu'on vient de quitter : sans elle, tout ce que
                   l'app montre dans la demi-heure qui suit un arrêt échappe
                   aux balayages (13.ei). */
                bloc("b3", "a1", j(11, 30), j(11, 50))];
  a.db.livres = [{ id: "l1", nom: "Un livre", pages: 100, maj: 1 }];
  a.db.auteurs = [{ id: "au1", nom: "Théodore Andoseh", maj: 1 }];
  a.db.sujets = [{ id: "s1", txt: "La santé de ma mère", pr: "n:n5", maj: 1 }];
  a.db.periodes = [{ id: "pr1", d: "jeune", deb: j(6, 0), fin: j(7, 0), maj: 1 }];
  a.db.portes = [{ id: "po1", v: "sondes", ep: 1, maj: 1 }];
  a.db.nodes = [
    { id: "n1", act: "dieu", kind: "acte", txt: "Il a guéri", man: "guerit", par: [], suj: [], date: "2026-11-05", prec: "j", etat: "fait", ts: 1, maj: 1 },
    { id: "n2", act: "moi", dest: "dieu", kind: "acte", txt: "J'ai jeûné", man: "", par: ["n1"], suj: ["s1"], date: "2026-11-06", prec: "j", etat: "fait", ts: 2, maj: 1 },
    { id: "n3", act: "moi", dest: "dieu", kind: "acte", txt: "Visiter", man: "", par: [], suj: [], date: "2026-11-20", prec: "j", etat: "prevu", ts: 3, maj: 1 },
    { id: "n4", act: "gens", gid: null, kind: "acte", txt: "Il a prêté", man: "pourvu", par: [], suj: [], date: "2026-11-01", prec: "j", etat: "fait", ts: 4, maj: 1 },
    /* Une parole reçue, et un sujet qui s'appuie dessus. Sans elles, tout ce
       que l'app ne montre QUE sur une parole — ce qu'Il en a fait (13.en),
       ce qu'on demande là-dessus et la liste où l'on choisit (13.ew) —
       échappait aux balayages : une branche entière, invisible. */
    { id: "n5", act: "dieu", kind: "rhema", txt: "Je serai avec toi", man: "parle", ref: "", par: [], suj: [], date: "2026-11-04", prec: "j", etat: "fait", ts: 5, maj: 1 }
  ];
  a.f.save();
  return a;
}
/* Poser un écran avec ce qu'il lui faut sous les pieds.
   `nu` laisse de côté le bloc désigné : on arrive au pointage pour dire à
   quoi l'on est, pas toujours pour corriger. Le même écran, deux intentions,
   et ce n'est pas le même code qui s'exécute. */
function pose(a, v, nu) {
  a.S.pile = []; a.S.view = v;
  a.S.nodeId = "n2"; a.S.blocId = nu ? null : "b1"; a.S.tchId = "a1"; a.S.lvId = "l1";
  a.S.auId = "au1"; a.S.sujId = "s1"; a.S.perId = "pr1"; a.S.cheminId = "n1";
  if (v === "note") {
    a.S.draft = { act: "dieu", dest: "dieu", txt: "", man: "", par: [], suj: [],
                  pdt: null, etat: "fait", date: "2026-11-08", prec: "j", fige: false };
    a.S.step = 0;
  }
}
function tousLesEcrans(a) { return a.c.SEULES.concat(AVEC_CONTEXTE); }
function corps(a) {
  return String(a.Z.html || "") + String(a.Z.haut || "") + String(a.Z.action || "");
}

test("balayage — aucun écran ne jette, aucun écran n'est vide", () => {
  const a = app();
  archiveOrdinaire(a);
  const jettent = [], vides = [];
  for (const v of tousLesEcrans(a)) {
    pose(a, v);
    try { a.f.render(); }
    catch (e) { jettent.push(v + " → " + e.message); continue; }
    if (!corps(a).trim()) vides.push(v + " (on est reparti sur : " + a.S.view + ")");
  }
  A.deepEqual(jettent, [], "un écran qui jette n'est pas un écran");
  A.deepEqual(vides, [], "un écran qui n'a rien à dire ne répond à aucune question (13.cs)");
});

test("balayage — tout ce qui s'affiche est écouté", () => {
  /* Le délégué n'écoute qu'une liste de `data-…` tenue à la main. Un attribut
     neuf qu'on oublie d'y ajouter donne un bouton qui ne répond pas, sans un
     mot, sur un écran que personne ne rouvrira peut-être avant des semaines. */
  const src = fs.readdirSync(path.join(__dirname, "..", "src"))
    .filter(f => f.endsWith(".js"))
    .map(f => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8")).join("\n");
  const sel = src.match(/ev\.target\.closest\("([^"]+)"\)/);
  A.ok(sel, "le délégué des gestes a changé de forme : ce balayage ne sait plus le lire");
  const ecoutes = new Set(sel[1].match(/\[data-([a-z0-9]+)\]/g).map(x => x.slice(6, -1)));

  const a = app();
  archiveOrdinaire(a);
  const morts = [];
  /* Deux passages, parce qu'un écran peut répondre à deux intentions : au
     pointage, corriger un bloc ou dire à quoi l'on est maintenant. Le second
     cas ne s'affichait jamais ici, et tout ce qu'il montre — le creux, ses
     trois réponses, la porte de la séance — passait au travers (13.ei). */
  for (const nu of [false, true]) {
    for (const v of tousLesEcrans(a)) {
      pose(a, v, nu);
      try { a.f.render(); } catch (e) { continue; }
      if (nu && a.S.view !== v) continue;
      for (const m of corps(a).matchAll(/<[a-z]+\b[^>]*>/g)) {
        const attrs = [...m[0].matchAll(/data-([a-z0-9]+)=/g)].map(x => x[1]);
        if (attrs.length && !attrs.some(x => ecoutes.has(x)))
          morts.push(v + (nu ? " (sans bloc)" : "") + " : data-" + attrs.join(", data-"));
      }
    }
  }
  A.deepEqual(morts, [], "un bouton qu'on ne peut pas toucher n'est pas un bouton");
});

test("balayage — aucune aide de test n'en masque une autre", () => {
  /* Neuvième balayage, et le seul qui surveille les balayages eux-mêmes.
     `function pose(...)` écrit une seconde fois en bas du fichier : la
     dernière déclaration gagne, et les huit balayages se sont mis à poser
     n'importe quoi sur chaque écran — 432 tests au vert sur un crible
     désarmé. La faute est invisible par construction, puisque c'est
     l'outil de détection qu'elle éteint. */
  const src = fs.readFileSync(__filename, "utf8");
  const noms = [...src.matchAll(/^function ([A-Za-z0-9_$]+)\s*\(/gm)].map(m => m[1]);
  const vus = {}, doubles = [];
  noms.forEach(n => { if (vus[n]) doubles.push(n); vus[n] = 1; });
  /* Et la preuve que le crible mord : on lui donne un doublon pour voir. */
  const faux = noms.concat(noms[0]), vf = {}, df = [];
  faux.forEach(n => { if (vf[n]) df.push(n); vf[n] = 1; });
  A.deepEqual(df, [noms[0]], "un balayage qui ne peut pas tomber ne défend rien");
  A.ok(noms.length > 20, "les aides ont changé de forme : ce balayage ne sait plus les lire");
  A.deepEqual(doubles, [], "deux aides du même nom : la dernière gagne, et elle gagne en silence");
});

test("balayage — tout rappel de l'écran d'ouverture est posé quelque part", () => {
  /* Huitième balayage. Écrire un `rappelX()` juste et oublier de l'appeler
     donne une fonctionnalité entière qui ne s'affiche nulle part, et tous ses
     tests au vert — ils appellent la fonction, l'écran ne l'appelle pas.
     13.eu a été livré ainsi en répétition : deux mutations ont survécu, et
     c'était exactement ce trou. La faute peut se produire à chaque nouveau
     rappel, donc elle se garde ici et non écran par écran. */
  const src = fs.readdirSync(path.join(__dirname, "..", "src"))
    .filter(f => f.endsWith(".js"))
    .map(f => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8")).join("\n");
  const noms = [...src.matchAll(/function (rappel[A-Za-z]+)\s*\(/g)].map(m => m[1]);
  A.ok(noms.length >= 6, "les rappels ont changé de forme : ce balayage ne sait plus les lire");
  /* Un rappel peut prendre un argument — rappelSuj(ss) — donc on compte les
     appels, déclaration déduite, et non les parenthèses vides. */
  const morts = noms.filter(n => {
    const tous = [...src.matchAll(new RegExp("\\b" + n + "\\s*\\(", "g"))].length;
    const decl = [...src.matchAll(new RegExp("function\\s+" + n + "\\s*\\(", "g"))].length;
    return tous - decl < 1;
  });
  A.deepEqual(morts, [], "un rappel que personne n'appelle ne prévient de rien");
});

test("balayage — aucun écran dont on ne sort pas", () => {
  /* `Z.haut` sans `Z.file` remplace la barre par le titre, et emporte le
     bouton Retour avec elle. Sur un onglet il reste la barre du bas ;
     partout ailleurs, c'est un écran sans porte. v100 l'a livré de
     justesse. */
  const a = app();
  archiveOrdinaire(a);
  const onglets = new Set(a.c.ONGLETS.map(o => o[0]));
  const sansPorte = [];
  for (const v of tousLesEcrans(a)) {
    pose(a, v);
    try { a.f.render(); } catch (e) { continue; }
    if (a.Z.haut && !a.Z.file && !onglets.has(a.S.view)) sansPorte.push(v);
  }
  A.deepEqual(sansPorte, [], "un écran dont on ne sort pas n'est pas un écran");
});

test("balayage — aucun geste n'arrête un compteur sans le dire", () => {
  /* 13.dt : une position par défaut qui PREND se rattrape mal. Rien ne doit
     fermer un compteur en silence — et ce qui le ferme doit l'avoir dit. */
  const a0 = app();
  archiveOrdinaire(a0);
  /* Tous les `data-…` que les écrans proposent vraiment, avec leur valeur. */
  const gestes = new Map();
  for (const nu of [false, true]) for (const v of tousLesEcrans(a0)) {
    pose(a0, v, nu);
    try { a0.f.render(); } catch (e) { continue; }
    for (const m of corps(a0).matchAll(/data-([a-z0-9]+)="([^"]*)"/g))
      gestes.set(v + nu + "\u0000" + m[1] + "\u0000" + m[2], [v, nu, m[1], m[2]]);
  }
  A.ok(gestes.size > 80, "le balayage ne voit presque rien : la fixture a dû se tarir");

  const muets = [];
  for (const [, [v, nu, cle, val]] of gestes) {
    const a = app();
    archiveOrdinaire(a);
    a.db.temps.push(bloc("b9", "a1", j(11, 30), null));
    a.f.save();
    pose(a, v, nu);
    try { a.f.render(); } catch (e) { continue; }
    const d = {}; d[cle] = val;
    try { a.geste(d); } catch (e) { continue; }
    /* Le bloc qui tournait tourne-t-il encore ? Compter les compteurs
       ouverts ne suffit pas : une tape qui arrête l'un en ouvre un autre,
       et le total ne bouge pas. C'est CE bloc-là qu'on suit. */
    const b9 = (a.db.temps || []).filter(b => b.id === "b9")[0];
    if (b9 && !b9.fin) continue;
    /* Il l'a fermé — ou effacé : qu'il l'ait dit. */
    if (!/arrêté|effacé|exemple/i.test(a.dernierToast() || ""))
      muets.push(v + (nu ? " (sans bloc désigné)" : "") + " : data-" + cle
        + '="' + val + '" → ' + (a.dernierToast() || "(rien dit)"));
  }
  A.deepEqual(muets, [], "personne n'arrête un compteur à la place du disciple (13.dt)");
});

test("balayage — la réunion de deux appareils ne ferme pas un compteur", () => {
  /* La synchro est le seul acteur qui touche l'archive sans que le disciple
     ait rien demandé. Elle réunit, elle ne tranche pas (13.cf, 13.bd) : seule
     une parole plus récente de l'autre appareil peut fermer ce qui tourne. */
  const a = app();
  const taches = [{ id: "a1", nom: "Travailler", maj: 1 }];
  const arch = (temps, morts) => a.f.sane({ taches, temps, morts: morts || {}, maj: 1 });
  const ici = () => arch([bloc("b1", "a1", j(8, 0), null)]);
  const ouverts = r => (r.temps || []).filter(b => !b.fin).length;

  A.equal(ouverts(a.f.fusionne(ici(), arch([]))), 1,
    "l'autre appareil ne sait rien de ce bloc : il ne le ferme pas");
  A.equal(ouverts(a.f.fusionne(ici(), arch([bloc("b2", "a1", j(10, 0), j(11, 0))]))), 1,
    "un bloc fermé plus tard, de la même activité, ne referme pas celui qui tourne");
  A.equal(ouverts(a.f.fusionne(ici(), arch([bloc("b2", "a2", j(10, 0), j(11, 0))]))), 1,
    "ni un bloc d'une autre activité (13.by)");
  A.equal(ouverts(a.f.fusionne(ici(),
    arch([Object.assign(bloc("b1", "a1", j(8, 0), j(9, 0)), { maj: j(9, 0) })]))), 0,
    "mais l'autre appareil l'a vraiment arrêté, et c'est lui qui a parlé en dernier");
});


/* ========================================================================
   13.eb — l'application se vérifie, elle ne se répare pas
   ======================================================================== */

/* Le compteur figé de v102 a été trouvé à l'œil, par le disciple, parce que
   deux écrans ne disaient pas la même chose. Une valeur impossible ne fait
   pas tomber l'application : elle la fait mentir doucement, et elle peut
   rester là des semaines. */

function abimee(a) {
  a.db.taches = [{ id: "a1", nom: "Prière", cat: "dieu", maj: 1 }];
  a.db.sujets = [{ id: "s1", txt: "La santé de ma mère", maj: 1 }];
  a.db.nodes = [{ id: "n1", act: "dieu", kind: "acte", txt: "Il a guéri", man: "guerit",
                  par: [], suj: [], date: "2026-11-05", prec: "j", etat: "fait", ts: 1, maj: 1 }];
  a.db.temps = [];
  a.db.periodes = [];
  a.db.morts = {};
  return a;
}
/* Les tableaux qui sortent du bac à sable ne sont pas ceux d'ici : on les
   rapatrie avant de les comparer. */
function signale(a) {
  return Array.from(a.f.verifArchive()).map(v => v.titre);
}

test("13.eb — un début qui n'est pas encore arrivé est signalé", () => {
  const a = app();
  abimee(a);
  a.db.temps = [bloc("b1", "a1", j(18, 0), null)];
  A.match(signale(a).join(" | "), /pas encore arrivée/,
    "un temps qu'on n'a pas vécu ne se déclare pas (13.ea)");
});

test("13.eb — une fin avant son début est signalée", () => {
  const a = app();
  abimee(a);
  a.db.temps = [bloc("b1", "a1", j(10, 0), j(9, 0))];
  A.match(signale(a).join(" | "), /fin avant son début/,
    "ce bloc ne pèse rien, et la prochaine réunion le laisse tomber");
});

test("13.eb — un bloc dont l'activité a disparu est signalé", () => {
  const a = app();
  abimee(a);
  a.db.temps = [bloc("b1", "aDisparue", j(8, 0), j(9, 0))];
  A.match(signale(a).join(" | "), /activité a disparu/,
    "le temps est compté mais ne va plus à rien de nommé");
});

test("13.eb — un acte qui répond à un acte effacé est signalé", () => {
  const a = app();
  abimee(a);
  a.db.nodes.push({ id: "n2", act: "moi", dest: "dieu", kind: "acte", txt: "J'ai jeûné",
                    par: ["nEfface"], suj: [], date: "2026-11-06", prec: "j",
                    etat: "fait", ts: 2, maj: 1 });
  A.match(signale(a).join(" | "), /acte effacé/, "c'est le fil du mémorial qui est coupé");
});

test("13.eb — une fiche que sa pierre tombale va emporter est signalée", () => {
  const a = app();
  abimee(a);
  /* Tout est à sa place à l'écran, et la prochaine synchro l'emporte (13.be).
     C'est la seule faute qu'on ne peut pas voir autrement. */
  a.db.morts = { n1: j(11, 0) };
  A.match(signale(a).join(" | "), /pierre tombale/,
    "elle est là, et elle porte sa propre pierre tombale");
});

test("13.eb — quand tout se tient, l'écran le dit et Aujourd'hui se tait", () => {
  const a = app();
  abimee(a);
  a.db.temps = [bloc("b1", "a1", j(8, 0), j(9, 0))];
  A.deepEqual(signale(a), [], "rien à signaler");
  A.equal(a.f.rappelVerif(), "",
    "une porte « tout va bien » qu'on ouvre tous les jours n'apprend plus rien (13.cb)");
  a.S.pile = []; a.S.view = "verif"; a.f.render();
  A.match(a.Z.html, /Tout se tient/, "mais derrière le rouage, on vient pour savoir");
  A.equal(a.f.verifDit(), "Tout se tient", "et la porte le dit avant qu'on la pousse");
});

test("13.eb — Aujourd'hui parle quand l'archive ne se tient pas", () => {
  const a = app();
  abimee(a);
  a.db.temps = [bloc("b1", "aDisparue", j(8, 0), j(9, 0))];
  A.match(a.f.rappelVerif(), /data-go="verif"/,
    "jamais un reproche sans porte (13.cb)");
  A.match(a.f.verifDit(), /1 chose à regarder/, "et le rouage dit combien");
});

test("13.eb — chaque ligne mène quelque part", () => {
  const a = app();
  abimee(a);
  a.db.temps = [bloc("b1", "aDisparue", j(8, 0), j(9, 0)),
                bloc("b2", "a1", j(10, 0), j(9, 0))];
  a.db.periodes = [{ id: "p1", d: "routineDisparue", deb: j(6, 0), fin: j(7, 0), maj: 1 }];
  a.db.nodes.push({ id: "n2", act: "moi", dest: "dieu", kind: "acte", txt: "J'ai jeûné",
                    par: ["nEfface"], suj: ["sEfface"], date: "2026-11-06", prec: "j",
                    etat: "fait", ts: 2, maj: 1 });
  const sansPorte = [];
  for (const v of Array.from(a.f.verifArchive()))
    for (const x of Array.from(v.items))
      if (!/data-(vbloc|prd|node)="/.test(x.attr || "")) sansPorte.push(v.titre);
  A.deepEqual(sansPorte, [], "un chiffre qui accuse doit mener quelque part (13.cb)");
});

test("13.eb — vérifier ne répare rien", () => {
  const a = app();
  abimee(a);
  a.db.temps = [bloc("b1", "a1", j(18, 0), null)];
  const avant = JSON.stringify(a.db);
  a.S.pile = []; a.S.view = "verif"; a.f.render();
  a.f.verifArchive(); a.f.verifCompte(); a.f.rappelVerif();
  A.equal(JSON.stringify(a.db), avant,
    "l'app prépare et prévient ; elle ne corrige pas à sa place (P9, 13.cf)");
});


/* ========================================================================
   13.ec — le fichier est un courrier, pas un contenant
   ======================================================================== */

/* « fais voyager dans l'archive stp pour que je puisse l'envoyer
   simplement. » Les sondes ne vivent pas dans l'archive (13.dn) et n'y
   entrent toujours pas : elles ne se synchronisent pas, ne poussent pas
   `db.maj`, et s'effacent sans toucher une ligne du mémorial. Mais elles
   doivent pouvoir SORTIR, sinon ce que l'application mesure d'elle-même ne
   quitte jamais le téléphone. */

test("13.ec — le fichier emporte ce que l'app mesure d'elle-même", () => {
  const a = app();
  a.geste({ go: "temps" });
  a.geste({ go: "today" });
  const f = a.f.archivePartante(null);
  A.ok(f.sondes, "le fichier porte les sondes");
  A.ok(f.sondes.g.length >= 2, "et les gestes qu'elles ont vus");
  A.ok(Array.isArray(f.nodes), "sans cesser d'être une sauvegarde");
});

test("13.ec — mais l'archive, elle, n'en porte rien", () => {
  const a = app();
  a.geste({ go: "temps" });
  a.f.save();
  A.equal(a.db.sondes, undefined, "`db` ne les connaît pas (13.dn)");
  A.ok(!/"sondes"/.test(a.stocke(a.c.KEY) || ""),
    "ni ce qui est gardé sous la clé de l'archive : sinon elles se synchronisent");
});

test("13.ec — reprendre un fichier ne ramène jamais les sondes d'un autre appareil", () => {
  const a = app();
  a.geste({ go: "temps" }); a.geste({ go: "today" }); a.geste({ go: "actes" });
  const ici = a.SO.g.length;
  /* Le fichier d'un portable, avec ses propres frictions. */
  const venu = a.f.sane({ nodes: [], sondes: { on: true, de: 1, g: [{ t: 1, k: "go" }], e: [] } });
  A.equal(venu.sondes, undefined,
    "les frictions d'un téléphone ne sont pas celles d'un portable");
  A.equal(a.SO.g.length, ici, "et la mesure de CET appareil-ci n'a pas bougé");
});

test("13.ec — l'écran dit ce que le fichier emporte", () => {
  const a = app();
  for (let i = 0; i < 40; i++) a.geste({ go: i % 2 ? "temps" : "today" });
  A.ok(a.f.sondesPoids() > 200, "il y a de quoi peser");
  a.S.pile = []; a.S.view = "data"; a.f.render();
  A.match(a.Z.html, /comment je m'en sers/,
    "un fichier qui emporte plus qu'on ne croit ne s'envoie pas tranquillement");
});

test("13.ec — rien de ce qu'il écrit ne part avec elles", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Prière avec Hermine", cat: "dieu", maj: 1 }];
  a.f.save();
  a.geste({ tache: "a1" });
  const txt = JSON.stringify(a.f.archivePartante(null).sondes);
  A.ok(!/Hermine/.test(txt), "ni les noms qu'il a écrits (13.dn)");
  A.ok(!/a1/.test(txt), "ni les identifiants de ses fiches");
});

/* ----------------------------------------------------------------------------
   13.ed — une mesure qui ne mesure pas ce qu'elle promet

   Les sondes, à leur deuxième jour, ont trouvé un vrai raté — et se sont
   trompées elles-mêmes. Sa lecture du fichier : « +55 gestes de trop sur
   « Un acte » », en tête de l'écran dont le seul métier est de dire vrai.
   Un chiffre faux est pire que pas de chiffre (13.ch).
---------------------------------------------------------------------------- */

test("13.ed — un geste qui ne change pas d'écran n'est pas un pas", () => {
  const a = app();
  a.geste({ go: "today" });
  a.geste({ go: "temps" });
  A.equal(Array.from(a.SO.g).pop().d, 1, "un geste depuis l'onglet");

  /* Basculer la vue, c'est travailler DANS l'écran : le chemin pour y venir
     était déjà parcouru. Compté comme un pas, il faisait de « Un acte » —
     où l'on atterrit en sauvegardant une fiche — une porte à dix-huit
     gestes de l'onglet, alors qu'elle en est à deux. */
  a.geste({ vue: "blocs" });
  const x = Array.from(a.SO.g).pop();
  A.equal(x.w, "temps", "on part de Mon temps");
  A.equal(x.a, "temps", "et on y reste");
  A.equal(x.d, 1, "rester sur place n'avance pas d'un pas");
  a.geste({ vue: "routines" });
  A.equal(Array.from(a.SO.g).pop().d, 1, "ni au deuxième");

  /* Et le pas suivant repart bien de là où l'on était. */
  a.geste({ go: "cahier" });
  A.equal(Array.from(a.SO.g).pop().d, 2, "deux écrans depuis l'onglet, pas quatre");
});

test("13.ed — le bilan ne chiffre que les portes qu'une épingle peut rapprocher", () => {
  const a = app();
  a.db.nodes = [{ id: "n1", txt: "Il a répondu", qui: "dieu", quand: MIDI, maj: 1 }];
  a.f.save();
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "sync" });
    a.geste({ node: "n1" });
  }
  const b = a.f.soBilan();
  A.equal(Array.from(b.couts).filter(c => c.v === "node").length, 0,
    "une fiche attend qu'on la lui désigne : aucun raccourci n'y mène");

  /* Ce qui reste est tout entier épinglable : chaque chiffre a sa porte. */
  const por = Array.from(a.f.portables());
  A.deepEqual(Array.from(b.couts).filter(c => por.indexOf(c.v) === -1).map(c => c.v), [],
    "un chiffre qui accuse doit mener quelque part (13.cb)");
});

test("13.ed — chaque ligne de ce qui coûte répond à la tape", () => {
  const a = app();
  for (let i = 0; i < 3; i++) {
    a.geste({ go: "actes" });
    a.geste({ go: "sync" });
    a.geste({ go: "data" });
  }
  const b = a.f.soBilan();
  A.ok(b.couts.length, "il y a bien quelque chose à lister");
  a.S.pile = []; a.S.view = "sondes"; a.f.render();
  /* L'écran invite à toucher une ligne pour y aller tout de suite : une ligne
     muette fait de cette phrase un mensonge. */
  for (const c of Array.from(b.couts)) {
    A.match(a.Z.html, new RegExp('data-go="' + c.v + '"'),
      "« " + c.v + " » est chiffré, donc il doit s'ouvrir d'ici");
  }
});

test("13.ed — une adresse reste cherchable dans un raté", () => {
  const a = app();
  const m = a.f.soSigne("Script https://landrya0.github.io/eben-ezer/sw.js load failed");
  A.match(m, /landrya0\.github\.io/,
    "masquée, l'adresse devenait « landryan.github.io » : introuvable partout");
  A.match(m, /sw\.js/, "et le fichier qui a manqué se nomme encore");

  /* Les chiffres qui sont à lui partent toujours. */
  A.equal(a.f.soSigne("Genèse 3 à 5"), "Genèse n à n");
  /* Et rien ne part en clair : une adresse n'est pas un laissez-passer. */
  A.ok(!/Hermine/.test(a.f.soSigne("Échec https://x.io/a?qui=Hermine")),
    "ce qui suit un « ? » tombe (13.bh)");
});

test("13.ed — aucune vérification de mise à jour ne remonte en raté", () => {
  /* `register(…).catch(…)` n'attrape pas le refus de `reg.update()` : c'est
     une autre promesse. Un `try` synchrone non plus. Les deux ratés du
     fichier du 10 novembre venaient de là, à la même milliseconde. */
  /* Les commentaires partent d'abord : celui qui explique ce raté le cite
     mot pour mot, et un balayage qui lit la prose se croit en faute. */
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "13-gestes.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const nus = [];
  for (const m of src.matchAll(/(await\s+)?reg\.update\(\)(\.catch\()?/g)) {
    if (!m[1] && !m[2]) nus.push(m[0]);
  }
  A.deepEqual(nus, [],
    "une promesse que personne n'attend remonte en « unhandledrejection »");
});

/* ----------------------------------------------------------------------------
   13.ee — la vue choisie est la vue

   Les sondes, sur deux jours : onze arrivées sur dix-sept sur « Mon temps »
   commençaient par une tape pour changer de vue. La remise à zéro portait
   deux choses différentes — la fenêtre et la vue — et n'en justifiait qu'une.
---------------------------------------------------------------------------- */

test("13.ee — la vue choisie survit au passage par un onglet", () => {
  const a = app();
  a.geste({ go: "temps" });
  A.match(a.Z.html, /data-vue="parts" aria-selected="true"/,
    "la première fois, on ouvre sur celle qui va de soi");
  a.geste({ vue: "blocs" });
  A.match(a.Z.html, /data-vue="blocs" aria-selected="true"/, "et on en change d'une tape");

  /* Un détour par un onglet ramenait aux parts : il fallait retaper. */
  a.geste({ go: "actes" });
  a.geste({ go: "temps" });
  A.match(a.Z.html, /data-vue="blocs" aria-selected="true"/,
    "on revient sur celle qu'on regardait, pas sur la première");
});

test("13.ee — la fenêtre revient au présent, la vue reste", () => {
  const a = app();
  a.geste({ go: "temps" });
  a.geste({ vue: "routines" });
  /* Deux ordres de choses : la fenêtre dit QUAND on regarde, la vue COMMENT. */
  a.S.anc = MIDI - 7 * 24 * H;
  a.geste({ go: "actes" });
  A.equal(a.S.anc, null, "on ne rouvre jamais l'application sur une fenêtre passée");
  a.geste({ go: "temps" });
  A.match(a.Z.html, /data-vue="routines" aria-selected="true"/,
    "seul le quand revient au présent");
});

test("13.ee — la vue est gardée sur l'appareil, jamais dans l'archive", () => {
  const a = app();
  a.geste({ go: "temps" });
  const maj = a.db.maj;
  a.geste({ vue: "blocs" });
  A.match(String(a.stocke("ebenezer.vues")), /"temps":"blocs"/, "l'appareil s'en souvient");
  A.equal(a.db.maj, maj,
    "sans quoi chaque tape sur une vue déclencherait une synchronisation (13.dn)");
  A.equal(a.db.vues, undefined, "le mémorial garde ce que Dieu a fait, pas mes onglets");
});

test("13.ee — une vue qui n'existe plus retombe sur celle qui va de soi", () => {
  const a = app();
  a.f.vueGarde("temps", "pastilles");   // une vue retirée depuis
  a.geste({ go: "temps" });
  A.match(a.Z.html, /data-vue="parts" aria-selected="true"/,
    "une valeur devenue inconnue ne doit pas dessiner un écran vide");
});

test("13.ee — une vue appartient à l'écran qui la pose", () => {
  const a = app();
  const permis = ["parts", "routines", "blocs"];
  a.f.vueGarde("temps", "blocs");
  a.f.vueGarde("ailleurs", "routines");
  A.equal(a.f.vueDe("temps", permis, "parts"), "blocs");
  A.equal(a.f.vueDe("ailleurs", permis, "parts"), "routines");
  A.equal(a.f.vueDe("neuf", permis, "parts"), "parts",
    "un deuxième écran à vues n'hérite pas du choix du premier");
});

/* ----------------------------------------------------------------------------
   13.ef — arrêter est un geste, pas un trajet

   Les sondes, sur deux jours : onze arrêts, tous précédés d'une ouverture du
   pointage. C'était l'écriture la plus fréquente de toutes — onze des
   quarante-trois — et le rail disait déjà, sur tous les écrans, ce qui
   tournait. Il lui manquait seulement de quoi le poser.
---------------------------------------------------------------------------- */

function rail(a) { return a.ctx.document.getElementById("rail").innerHTML; }
function arretDuRail(a) {
  a.f.majChrono();
  return (rail(a).match(/data-stop="([^"]+)"/) || [])[1];
}

test("13.ef — le rail porte de quoi arrêter ce qu'il nomme", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Prière", cat: "dieu", maj: 1 }];
  a.f.pointe("a1", false, MIDI - H);
  a.f.majChrono();
  A.match(rail(a), /Prière/, "il nomme ce qui tourne");
  A.match(rail(a), /data-go="pointer"/, "et mène au pointage, comme avant");
  A.equal(arretDuRail(a), a.f.ouvert().id, "et il porte de quoi l'arrêter sur place");
});

test("13.ef — il arrête ce que le rail nomme, et pas ce qui tourne à côté", () => {
  const a = app();
  a.db.taches = [
    { id: "a1", nom: "Travail", cat: "moi", maj: 1 },
    { id: "a2", nom: "Prière", cat: "dieu", maj: 1 }
  ];
  a.f.pointe("a1", false, MIDI - 3 * H);
  a.f.pointe("a2", true, MIDI - H);
  A.equal(Array.from(a.f.ouverts()).length, 2, "deux choses de front couvrent la journée (13.by)");

  const id = arretDuRail(a);
  const nom = a.f.tacheNom(a.f.blocT(id).t);
  a.geste({ stop: id });
  const reste = Array.from(a.f.ouverts());
  A.equal(reste.length, 1,
    "« tout arrêter » reste un geste de plus, en clair, au pointage");
  A.ok(reste[0].id !== id, "et c'est bien celui que le rail nommait qui s'est arrêté");
  A.match(a.dernierToast(), new RegExp("Arrêté"), "aucun geste n'arrête un compteur sans le dire");
  A.match(a.dernierToast(), new RegExp(nom), "et il dit lequel");
});

test("13.ef — le rail reste, et nomme le suivant", () => {
  const a = app();
  a.db.taches = [
    { id: "a1", nom: "Travail", cat: "moi", maj: 1 },
    { id: "a2", nom: "Prière", cat: "dieu", maj: 1 }
  ];
  a.f.pointe("a1", false, MIDI - 3 * H);
  a.f.pointe("a2", true, MIDI - H);
  const id = arretDuRail(a);
  a.geste({ stop: id });
  a.f.majChrono();
  const encore = a.f.ouvert();
  A.ok(encore, "quelque chose tourne encore");
  A.match(rail(a), new RegExp(a.f.tacheNom(encore.t)),
    "le rail ne s'en va pas : il dit ce qui reste, et c'est le reçu du geste");
});

test("13.ef — arrêter depuis le rail pose la question que la routine demande", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Lecture de la Parole", cat: "dieu", d: "parole", maj: 1 }];
  a.f.pointe("a1", false, MIDI - H);
  const id = arretDuRail(a);
  a.geste({ stop: id });
  A.equal(a.S.view, "lecture",
    "on vient de fermer la lecture, on sait jusqu'où on est allé (13.dt)");
});

test("13.ef — un seul compteur : le rail l'arrête tout entier", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Prière", cat: "dieu", maj: 1 }];
  a.f.pointe("a1", false, MIDI - H);
  a.geste({ stop: arretDuRail(a) });
  A.equal(Array.from(a.f.ouverts()).length, 0, "plus rien ne tourne");
  a.f.majChrono();
  A.ok(!/data-stop/.test(rail(a)), "et il n'y a plus rien à arrêter");
});

test("balayage — tout ce que le rail affiche est écouté", () => {
  /* Le rail n'est pas un écran : le balayage des écrans ne le voit pas. Un
     `data-…` posé là serait muet sans qu'une ligne de la batterie bouge —
     et le rail est le seul objet présent sur TOUS les écrans. */
  const src = fs.readdirSync(path.join(__dirname, "..", "src"))
    .filter(f => f.endsWith(".js"))
    .map(f => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8")).join("\n");
  const sel = src.match(/ev\.target\.closest\("([^"]+)"\)/);
  A.ok(sel, "le délégué des gestes a changé de forme : ce balayage ne sait plus le lire");
  const ecoutes = new Set(sel[1].match(/\[data-([a-z0-9]+)\]/g).map(x => x.slice(6, -1)));

  const a = app();
  a.db.taches = [
    { id: "a1", nom: "Travail", cat: "moi", maj: 1 },
    { id: "a2", nom: "Prière", cat: "dieu", maj: 1 }
  ];
  const etats = [];
  /* Les trois états du rail : un compteur, plusieurs, et le creux. */
  a.f.pointe("a1", false, MIDI - 3 * H); a.f.majChrono(); etats.push(rail(a));
  a.f.pointe("a2", true, MIDI - H);      a.f.majChrono(); etats.push(rail(a));
  a.f.arrete();
  a.maintenant(MIDI + 10 * MIN);         a.f.majChrono(); etats.push(rail(a));

  const morts = [];
  for (const h of etats) {
    for (const m of h.matchAll(/\sdata-([a-z0-9]+)=/g)) {
      if (!ecoutes.has(m[1]) && morts.indexOf(m[1]) === -1) morts.push(m[1]);
    }
  }
  A.deepEqual(morts, [], "un bouton du rail que personne n'écoute est muet partout");
  A.ok(etats[0].includes("data-stop") && etats[2].includes("data-act"),
    "le balayage a bien vu les états qu'il croit balayer");
});

/* ----------------------------------------------------------------------------
   13.eg — un creux a trois réponses, pas deux

   Les sondes, sur deux jours : douze tapes sur « Rien de compté », et pas une
   seule qui ait abouti du premier coup. Quatre tombaient sur un creux de
   quelques secondes, que l'écran ouvert derrière ne regardait même pas. Et
   pour dire ce qu'avaient été quarante-six minutes passées, il fallait
   reprendre depuis l'arrêt, toucher l'activité, revenir, puis l'arrêter.
---------------------------------------------------------------------------- */

/* Un arrêt, puis un vide de la durée qu'on veut. */
function creuxDe_(a, minutes) {
  a.db.taches = [{ id: "a1", nom: "Sommeil", cat: "soi", maj: 1 },
                 { id: "a2", nom: "Prière", cat: "dieu", maj: 1 },
                 { id: "a3", nom: "Marche", cat: "soi", maj: 1 }];
  a.db.temps = [{ id: "b1", t: "a1", deb: MIDI - 2 * H, maj: 1 }];
  a.maintenant(MIDI);
  a.f.arrete();
  a.maintenant(MIDI + minutes * MIN);
  return a;
}

test("13.eg — le rail ne montre pas un creux que l'écran ignore", () => {
  const a = app();
  creuxDe_(a, 0);
  a.maintenant(MIDI + 30 * 1000);
  a.f.majChrono();
  A.ok(!/Rien de compté/.test(rail(a)),
    "trente secondes ne sont pas un vide : quatre tapes sur douze y tombaient");

  a.maintenant(MIDI + 2 * MIN);
  a.f.majChrono();
  A.match(rail(a), /Rien de compté/, "deux minutes en sont un");
  A.match(rail(a), /data-act="comblerVif"/, "et il mène à l'écran qui en parle");
});

test("13.eg — « c'était ça » comble en une tape, et rien ne se met à tourner", () => {
  const a = app();
  creuxDe_(a, 46);
  a.actions.comblerVif();
  A.match(a.Z.html, /data-vif="clos"/, "la réponse est là, sur le même rang que les deux autres");

  a.geste({ vif: "clos" });
  a.geste({ tache: "a2" });

  const b = a.db.temps.filter(x => x.t === "a2")[0];
  A.ok(b, "le bloc est posé");
  A.equal(b.deb, MIDI, "il couvre le creux depuis l'arrêt");
  A.equal(b.fin, MIDI + 46 * MIN, "jusqu'à la tape sur le rail");
  A.equal(Array.from(a.f.ouverts()).length, 0, "et rien ne tourne : c'était fini");
});

test("13.eg — on en pose plusieurs, et on en retire d'une tape", () => {
  const a = app();
  creuxDe_(a, 46);
  a.actions.comblerVif();
  a.geste({ vif: "clos" });
  a.geste({ tache: "a2" });
  /* Les bornes sont gelées, et elles le restent même si l'on retouche la
     réponse déjà choisie : sans cela le creux glisserait d'une demi-minute,
     la première activité posée tomberait hors de lui, l'écran redirait
     « rien n'a été compté » et « retirer » ne retrouverait plus rien. */
  a.maintenant(MIDI + 46 * MIN + 30 * 1000);
  a.geste({ vif: "clos" });
  A.equal(a.S.trou.fin, MIDI + 46 * MIN, "le creux ne glisse pas sous la main");
  a.geste({ tache: "a3" });
  const dedans = Array.from(a.db.temps).filter(x => x.deb === MIDI && x.fin === MIDI + 46 * MIN);
  A.equal(dedans.length, 2, "on marchait en priant : le creux en reçoit deux (13.dr)");

  a.geste({ tache: "a3" });
  A.equal(Array.from(a.db.temps).filter(x => x.t === "a3" && x.deb === MIDI).length, 0,
    "et toucher à nouveau la retire");
  A.match(a.dernierToast(), /Retiré/);
});

test("13.eg — « à personne » reste la position par défaut", () => {
  const a = app();
  creuxDe_(a, 46);
  a.actions.comblerVif();
  A.match(a.Z.html, /data-vif="rien" aria-pressed="true"/,
    "ce temps-là, il venait de le retirer à tout le monde (13.db)");
  a.geste({ tache: "a2" });
  const b = a.db.temps.filter(x => x.t === "a2")[0];
  A.equal(b.deb, MIDI + 46 * MIN, "une tape sans réponse ne redonne rien au creux");
  A.equal(b.fin, undefined, "et le compteur part");
});

test("13.eg — « j'y suis encore » reprend depuis l'arrêt, par le chemin réel", () => {
  const a = app();
  creuxDe_(a, 46);
  a.actions.comblerVif();
  a.geste({ vif: "suite" });
  a.geste({ tache: "a2" });
  const b = a.db.temps.filter(x => x.t === "a2")[0];
  A.equal(b.deb, MIDI, "on priait déjà : le compte reprend à l'arrêt (13.db)");
  A.equal(b.fin, undefined, "et il tourne encore");
});

test("13.eg — changer d'avis ne laisse pas de creux gelé derrière", () => {
  const a = app();
  creuxDe_(a, 46);
  a.actions.comblerVif();
  a.geste({ vif: "clos" });
  A.ok(a.S.trou, "le creux est gelé");
  a.geste({ vif: "rien" });
  A.equal(a.S.trou, null, "et il se dégèle avec la réponse qui l'avait posé");
  a.geste({ tache: "a2" });
  A.equal(a.db.temps.filter(x => x.t === "a2")[0].deb, MIDI + 46 * MIN);
});

/* ——— 13.eh — une séance interrompue reste une séance ——— */

/* La soirée du 7 novembre, telle que l'archive la garde : une lecture de
   trois heures et quart, et QUATRE prières dedans, séparées de neuf, quinze
   et neuf minutes. C'est le cas qui a demandé la règle — et celui qui casse
   la définition facile, « un creux que rien n'occupe » : ici la lecture
   occupe tous les creux, et la séance ne se serait jamais formée. */
function seance(a, ecart) {
  a.db.taches = [{ id: "p1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 },
                 { id: "l1", nom: "Lecture", cat: "dieu", d: "litt", maj: 1 }];
  const s1 = a.f.sujetId("La santé de maman");
  const s2 = a.f.sujetId("Le projet de Qualitas");
  a.db.temps = [
    bloc("L", "l1", j(19, 55), j(23, 20)),
    bloc("P1", "p1", j(20, 17), j(20, 46), { sj: [s1] }),
    bloc("P2", "p1", j(20, 46) + ecart * MIN, j(20, 46) + (ecart + 19) * MIN)
  ];
  return { s1: s1, s2: s2 };
}
const ids = (bs) => Array.from(bs, b => b.id);

test("13.eh — la même activité reprise dans la demi-heure continue la même séance", () => {
  const a = app();
  seance(a, 9);
  A.deepEqual(ids(a.f.seanceDe(a.f.blocT("P2"))), ["P1", "P2"]);
  A.deepEqual(ids(a.f.seanceDe(a.f.blocT("P1"))), ["P1", "P2"],
    "la séance se lit depuis n'importe lequel de ses blocs");
  const z = app();
  seance(z, 54);
  A.deepEqual(ids(z.f.seanceDe(z.f.blocT("P2"))), ["P2"],
    "cinquante-quatre minutes : deux trajets et non un, comme dans l'archive");
});

test("13.eh — ce qui tourne par-dessus ne coupe pas la séance", () => {
  const a = app();
  seance(a, 9);
  const L = a.f.blocT("L");
  A.ok(L.deb < a.f.blocT("P1").fin && L.fin > a.f.blocT("P2").deb,
    "la lecture couvre bien les deux prières et le creux entre elles");
  A.deepEqual(ids(a.f.seanceDe(a.f.blocT("P2"))), ["P1", "P2"],
    "deux choses menées ensemble ne se disputent pas la journée (13.by)");
  A.deepEqual(ids(a.f.seanceDe(L)), ["L"], "et la lecture est sa propre séance");
});

test("13.eh — la reprise rouvre la fiche de la séance, pas une page blanche", () => {
  const a = app();
  const s = seance(a, 9);
  a.S.blocId = "P2"; a.S.view = "sujets"; a.S.sjQ = "";
  a.f.vSujets();
  A.match(a.Z.html, /Nommés dans cette séance/);
  A.match(a.Z.html, /La santé de maman/, "ce qui est déjà nommé est sous les yeux");
  A.match(a.Z.html, /Tu reprends la séance commencée à/);
  A.equal(a.Z.html.indexOf('data-sjadd="' + s.s1 + '"'), -1,
    "et ne se propose plus : on ne le nomme pas deux fois dans la même prière");

  const z = app();
  seance(z, 54);
  z.S.blocId = "P2"; z.S.view = "sujets"; z.S.sjQ = "";
  z.f.vSujets();
  A.equal(z.Z.html.indexOf("Nommés dans cette séance"), -1);
  A.match(z.Z.html, /La dernière fois/, "là, c'est bien une autre fois");
});

test("13.eh — « la dernière fois » ne peut pas désigner la séance en cours", () => {
  const a = app();
  const s = seance(a, 9);
  a.db.temps.push(bloc("V", "p1", jour(3, 6, 0), jour(3, 6, 30), { sj: [s.s2] }));
  A.deepEqual(Array.from(a.f.sujetsDerniers(a.f.blocT("P2"))), [s.s2],
    "la dernière fois, c'est le 3 novembre — pas neuf minutes plus tôt");
});

test("13.eh — un sujet porté dans une prière coupée en deux compte une fois", () => {
  const a = app();
  const s = seance(a, 9);
  a.f.blocT("P2").sj = [s.s1];
  A.equal(a.f.sujetFois(s.s1), 1, "une prière interrompue reste une prière");
  A.deepEqual(ids(a.f.seancesDe(s.s1)), ["P1"], "son premier bloc en date la fois");
  A.match(a.f.sujetHist(s.s1), /nommé le/, "une fois ne se dit pas « nommé 2 fois »");

  const z = app();
  const t = seance(z, 54);
  z.f.blocT("P2").sj = [t.s1];
  A.equal(z.f.sujetFois(t.s1), 2, "deux prières séparées en font bien deux");
});

test("13.eh — « Retirer » vise le bloc où la ligne a été écrite", () => {
  const a = app();
  const s = seance(a, 9);
  a.f.blocT("P2").sj = [s.s2];
  a.S.blocId = "P2"; a.S.view = "sujets";
  a.geste({ sjsup: "P1|0" });
  A.deepEqual(Array.from(a.f.blocT("P1").sj || []), [],
    "la ligne part du bloc de 20 h 17, qui la portait");
  A.deepEqual(Array.from(a.f.blocT("P2").sj || []), [s.s2],
    "et le bloc où l'on se trouve n'est pas touché");
});

test("13.eh — le même sujet ne s'ajoute pas deux fois dans une séance", () => {
  const a = app();
  const s = seance(a, 9);
  a.S.blocId = "P2"; a.S.view = "sujets";
  a.geste({ sjadd: s.s1 });
  A.deepEqual(Array.from(a.f.blocT("P2").sj || []), [], "refusé");
  A.match(a.dernierToast(), /Déjà nommé dans cette séance/);
  a.geste({ sjadd: s.s2 });
  A.deepEqual(Array.from(a.f.blocT("P2").sj || []), [s.s2], "un autre sujet, lui, s'ajoute");
});

/* Le harnais a un DOM en carton : une ligne « Retirer » qui vise le mauvais
   bloc s'affiche parfaitement et ne se voit nulle part. Ce balayage lit donc
   la source — et il attrapera la cinquième liste, celle qui n'existe pas
   encore, le jour où quelqu'un la recopiera sur l'ancien modèle. */
test("balayage — aucune ligne à retirer ne tait le bloc dont elle vient", () => {
  const src = fs.readdirSync(path.join(__dirname, "..", "src"))
    .filter(f => f.endsWith(".js")).sort()
    .map(f => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8")).join("\n");
  const fns = src.match(/function liste[A-Za-z]+\(b[,)][\s\S]*?\n}/g) || [];
  A.ok(fns.length >= 4, "les listes d'un bloc sont bien là — " + fns.length);
  fns.forEach(f => {
    const nom = f.slice(9, f.indexOf("("));
    A.match(f, /data-[a-z]+sup="'\+b\.id\+'\|'/,
      nom + " : un indice sans bloc retirerait la ligne d'un autre bloc");
  });
});

/* ——— 13.ei — une séance, une question ——— */

/* Une prière reprise après neuf minutes, et qui tourne encore : le cas où
   l'arrêt posait la question une seconde fois. */
function seanceVive(a, nomme) {
  a.db.taches = [{ id: "p1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 }];
  const s = a.f.sujetId("La santé de maman");
  a.db.temps = [
    bloc("P1", "p1", MIDI - 60 * MIN, MIDI - 31 * MIN, nomme ? { sj: [s] } : {}),
    bloc("P2", "p1", MIDI - 22 * MIN)
  ];
  a.S.view = "today";
  return s;
}

test("13.ei — le premier arrêt d'une séance pose la question, comme avant", () => {
  const a = app();
  a.db.taches = [{ id: "p1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 }];
  a.db.temps = [bloc("P1", "p1", MIDI - 29 * MIN)];
  a.geste({ stop: "P1" });
  A.equal(a.S.view, "sujets", "elle se pose où elle est naturelle (13.cd)");
  A.equal(a.S.blocId, "P1");
});

test("13.ei — la reprise ne repose pas l'écran : une séance, une question", () => {
  const a = app();
  seanceVive(a, false);
  a.geste({ stop: "P2" });
  A.equal(a.S.view, "today", "aucun écran imposé une seconde fois");
  A.match(a.dernierToast(), /Même séance qu'à 11 h 00/,
    "elle dit pourquoi elle ne demande pas, au lieu de se taire");
});

test("13.ei — la reprise dit ce que la séance tient déjà", () => {
  const a = app();
  const s = seanceVive(a, true);
  a.geste({ stop: "P2" });
  A.match(a.dernierToast(), /1 sujet déjà/);

  const z = app();
  const s2 = seanceVive(z, true);
  z.f.blocT("P1").sj.push(z.f.sujetId("Le projet de Qualitas"));
  A.ok(s && s2);
  z.geste({ stop: "P2" });
  A.match(z.dernierToast(), /2 sujets déjà/);
});

test("13.ei — la porte de la séance se tient au pointage, et y ramène", () => {
  const a = app();
  seanceVive(a, true);
  a.geste({ stop: "P2" });
  a.S.view = "pointer"; a.f.vPointer();
  A.match(a.Z.html, /data-dis="P2"/, "elle vise le dernier bloc de la séance");
  A.match(a.Z.html, /En nommer un autre/);
  A.match(a.Z.html, /1 sujet pour cette séance/);
  a.geste({ dis: "P2" });
  A.equal(a.S.view, "sujets");
  A.equal(a.S.blocId, "P2");
  a.geste({ back: "1" });
  A.equal(a.S.view, "pointer", "et Retour revient d'où l'on vient, pas sur Aujourd'hui");
});

test("13.ei — la porte ouvre sans rien reprocher quand la séance n'a rien dit", () => {
  const a = app();
  seanceVive(a, false);
  a.geste({ stop: "P2" });
  a.S.view = "pointer"; a.f.vPointer();
  A.match(a.Z.html, /Dire ce que tu as nommé/);
  A.equal(a.Z.html.indexOf("pour cette séance"), -1,
    "aucun compte à zéro : un chiffre qui accuse doit mener quelque part, celui-là n'accuse pas");
});

test("13.ei — la porte s'efface quand la séance est finie", () => {
  const a = app();
  seanceVive(a, true);
  a.geste({ stop: "P2" });
  a.S.view = "pointer"; a.f.vPointer();
  A.match(a.Z.html, /data-dis=/);

  a.db.temps.push(bloc("X", "p1", MIDI + MIN));
  a.f.vPointer();
  A.equal(a.Z.html.indexOf("data-dis="), -1, "dès qu'autre chose tourne, la séance est finie");

  a.db.temps = a.db.temps.filter(b => b.id !== "X");
  a.maintenant(MIDI + 31 * MIN);
  a.f.vPointer();
  A.equal(a.Z.html.indexOf("data-dis="), -1,
    "et passé la demi-heure : on ne laisse pas traîner un chemin vers hier");
});

test("13.ei — la porte ne s'ouvre pas sur une question qui n'existe pas", () => {
  const a = app();
  a.db.taches = [{ id: "v1", nom: "En voiture", cat: "moi", d: "", maj: 1 }];
  a.db.temps = [bloc("V1", "v1", MIDI - 40 * MIN, MIDI - MIN)];
  a.S.view = "pointer"; a.f.vPointer();
  A.equal(a.Z.html.indexOf("data-dis="), -1,
    "un trajet ne mesure rien : l'app demande ce qu'elle ne sait pas, et rien d'autre (13.cg)");
});

/* ——— 13.ej — l'app pose ce qu'elle lit, pas ce qu'elle devine ——— */

function enTrain(a) {
  a.db.taches = [{ id: "a1", nom: "Méditer", cat: "dieu", d: "parole", maj: 1 },
                 { id: "a2", nom: "Prière", cat: "dieu", d: "priere", maj: 1 }];
  a.db.temps = [bloc("b1", "a1", MIDI - 40 * MIN)];
}

test("13.ej — une seule chose tourne : l'app la pose, et le dit", () => {
  const a = app();
  enTrain(a);
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  A.equal(a.S.draft.pdt, "b1", "ce n'est pas un pari : c'est la seule réponse possible");
  A.equal(a.S.draft.pdtSup, true);

  a.S.step = a.f.etapes(a.S.draft).length - 1;
  a.f.render();
  A.match(a.Z.html, /Méditer/);
  A.match(a.Z.html, /Touche si ce n'était pas pendant ça/,
    "une supposition se voit et se défait d'une tape, comme celle du jour (13.dx)");
  A.match(a.Z.html, /L'app le suppose/);
});

test("13.ej — deux choses tournent : elle se tait", () => {
  const a = app();
  enTrain(a);
  a.db.temps.push(bloc("b2", "a2", MIDI - 10 * MIN));
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  A.equal(a.S.draft.pdt, null, "trancher entre les deux serait cocher à sa place (P9)");
  A.equal(a.f.pdtCandidats().length, 2, "mais les deux sont offertes");
});

test("13.ej — rien ne tourne, rien n'est posé", () => {
  const a = app();
  a.db.taches = [{ id: "a1", nom: "Méditer", cat: "dieu", d: "parole", maj: 1 }];
  a.db.temps = [];
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  A.equal(a.S.draft.pdt, null);
  A.equal(a.f.pdtCandidats().length, 0);
});

test("13.ej — ce qu'on vient d'arrêter compte encore comme circonstance", () => {
  const a = app();
  enTrain(a);
  a.f.blocT("b1").fin = MIDI - 5 * MIN;
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  A.equal(a.S.draft.pdt, "b1",
    "on note souvent juste après avoir arrêté, et ce qu'on a reçu en vient quand même");

  const z = app();
  enTrain(z);
  z.f.blocT("b1").fin = MIDI - 31 * MIN;
  z.geste({ go: "note" });
  z.geste({ qui: "dieu" });
  A.equal(z.S.draft.pdt, null, "passé la demi-heure, ce n'est plus la même séance (13.ei)");
});

test("13.ej — une circonstance choisie ne se présente pas comme devinée", () => {
  const a = app();
  enTrain(a);
  a.db.temps.push(bloc("b2", "a2", MIDI - 10 * MIN));
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  a.geste({ pdt: "b2" });
  A.equal(a.S.draft.pdtSup, false);
  a.S.step = a.f.etapes(a.S.draft).length - 1;
  a.f.render();
  A.equal(a.Z.html.indexOf("L'app le suppose"), -1,
    "un libellé faux est de la famille d'un chiffre faux (13.ch)");
  A.match(a.Z.html, /Ce que tu donnais quand c'est arrivé/);

  /* Et le cas qui compte vraiment : l'app suppose, il retire, il remet.
     Ce qu'il a remis de sa main n'est plus une supposition. */
  const z = app();
  enTrain(z);
  z.geste({ go: "note" });
  z.geste({ qui: "dieu" });
  A.equal(z.S.draft.pdtSup, true, "posée par l'app");
  z.geste({ pdt: "b1" });
  A.equal(z.S.draft.pdt, null);
  z.geste({ pdt: "b1" });
  A.equal(z.S.draft.pdt, "b1");
  A.equal(z.S.draft.pdtSup, false, "remise de sa main : ce n'est plus l'app qui la suppose");
  z.S.step = z.f.etapes(z.S.draft).length - 1;
  z.f.render();
  A.equal(z.Z.html.indexOf("L'app le suppose"), -1);
});

test("13.ej — la supposition se garde avec l'acte, et nourrit le chemin", () => {
  const a = app();
  enTrain(a);
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  a.ecrit("nTxt", "Il m'a montré pourquoi j'étais là");
  a.actions.saveNote();
  const n = a.db.nodes[a.db.nodes.length - 1];
  A.equal(n.pdt, "b1", "le lien est gardé sur l'acte");
  A.equal(n.pdtSup, undefined, "la supposition est un état d'écran, pas une donnée d'archive");
  A.deepEqual(Array.from(a.f.actesPdt("b1"), x => x.id), [n.id]);
});

test("13.ej — changer d'acteur ne perd pas la circonstance", () => {
  const a = app();
  enTrain(a);
  a.geste({ go: "note" });
  a.geste({ qui: "dieu" });
  a.geste({ qui: "moi" });
  A.equal(a.S.draft.pdt, "b1", "la circonstance traverse, comme le sujet (13.cx, 13.dp)");
  A.equal(a.S.draft.pdtSup, true);
});

/* ------------------------------------------------------------------
   13.ek — une liste qui ne se remplit qu'au clavier reste vide.
   Quatre séances de prière, zéro sujet nommé, deux sujets en cinq
   jours : l'écran tendait bien des tapes, mais seulement de ce qui
   avait déjà été tapé. L'amorce manquait.
   ------------------------------------------------------------------ */

/* Une prière qui tourne, un frère à porter, et de quoi attendre :
   un prévu en retard, un acte de Dieu resté sans réponse, et un
   autre auquel il a répondu — celui-là ne doit pas être tendu. */
function aPorter(a) {
  a.maintenant(MIDI);
  a.db.taches = [{ id: "p1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 }];
  a.db.temps = [bloc("P1", "p1", j(20, 17), j(20, 46))];
  const g1 = a.f.gensId("Estelle");
  const g2 = a.f.gensId("Papa Théodore");
  a.db.nodes = [
    { id: "nv", act: "moi", dest: "dieu", kind: "acte", txt: "Jeûner un jour",
      etat: "prevu", date: "2026-11-05", prec: "j", par: [], suj: [], maj: 1, ts: 1 },
    { id: "nd", act: "dieu", dest: null, kind: "acte", txt: "Il a ouvert la porte de Qualitas",
      etat: "fait", date: "2026-11-02", prec: "j", par: [], suj: [], maj: 1, ts: 2 },
    { id: "nr", act: "dieu", dest: null, kind: "acte", txt: "Il a guéri la toux de Jonathan",
      etat: "fait", date: "2026-11-03", prec: "j", par: [], suj: [], maj: 1, ts: 3 },
    { id: "nm", act: "moi", dest: "dieu", kind: "acte", txt: "Je L'ai remercié",
      etat: "fait", date: "2026-11-03", prec: "j", par: ["nr"], suj: [], maj: 1, ts: 4 }
  ];
  a.S.blocId = "P1"; a.S.view = "sujets"; a.S.sjQ = "";
  return { g1: g1, g2: g2 };
}

test("13.ek — l'écran tend ce que l'application tient déjà", () => {
  const a = app();
  const o = aPorter(a);
  A.deepEqual(Array.from(a.db.sujets || []), [], "on part sans un seul sujet, comme le premier jour");
  a.f.vSujets();
  A.match(a.Z.html, /Ceux que tu portes/, "les gens sont tendus");
  A.match(a.Z.html, new RegExp('data-sjlie="' + o.g1 + '"'), "Estelle est à une tape");
  A.match(a.Z.html, /Pour Estelle/);
  A.match(a.Z.html, /Ce qui attend/);
  A.match(a.Z.html, /data-sjlie="nv"/, "ce qu'il avait prévu et n'a pas fait");
  A.match(a.Z.html, /data-sjlie="nd"/, "l'acte de Dieu resté sans réponse de lui");
  A.equal(a.Z.html.indexOf('data-sjlie="nr"'), -1,
    "mais pas celui auquel il a déjà répondu : il n'attend plus");
  A.equal(a.Z.html.indexOf('data-sjlie="nm"'), -1,
    "ni ses propres actes faits, qui ne sont pas une dette");
});

test("13.ek — rien n'est coché : tendre n'est pas nommer", () => {
  const a = app();
  aPorter(a);
  a.f.vSujets();
  A.deepEqual(Array.from(a.f.blocT("P1").sj || []), [],
    "l'écran a tout tendu et le bloc est toujours vide (13.de)");
  A.equal(a.Z.html.indexOf("coche"), -1, "aucune ligne tendue n'arrive cochée");
});

test("13.ek — le clavier passe sous les tapes", () => {
  const a = app();
  aPorter(a);
  a.f.vSujets();
  const tape = a.Z.html.indexOf("data-sjlie=");
  const clavier = a.Z.html.indexOf('id="sjQ"');
  A.ok(tape > -1 && clavier > -1, "les deux chemins sont là");
  A.ok(tape < clavier, "un champ de saisie en tête d'écran dit que le clavier est le chemin");
  A.match(a.Z.html, /Nommer autre chose/, "et le titre du champ dit ce qu'il est : le recours");
});

test("13.ek — une tape suffit, et la fiche naît du lien", () => {
  const a = app();
  const o = aPorter(a);
  a.geste({ sjlie: o.g1 });
  const sj = Array.from(a.f.blocT("P1").sj || []);
  A.equal(sj.length, 1, "une tape, un sujet nommé");
  const s = a.f.sujet(sj[0]);
  A.equal(s.lie, o.g1, "le sujet porte l'identifiant de la personne, pas seulement son nom");
  A.equal(a.f.sujetTxt(sj[0]), "Pour Estelle");
});

test("13.ek — le libellé se relit de la fiche", () => {
  const a = app();
  const o = aPorter(a);
  a.geste({ sjlie: o.g1 });
  const sid = Array.from(a.f.blocT("P1").sj)[0];
  a.db.gens.filter(g => g.id === o.g1)[0].nom = "Estelle A.";
  A.equal(a.f.sujetTxt(sid), "Pour Estelle A.", "un frère renommé renomme son sujet");
  a.db.gens = [];
  A.equal(a.f.sujetTxt(sid), "Pour Estelle",
    "et si la fiche visée disparaît, le texte gardé sert de repli");
});

test("13.ek — deux tapes sur la même personne ne font pas deux sujets", () => {
  const a = app();
  const o = aPorter(a);
  a.geste({ sjlie: o.g1 });
  const sid = Array.from(a.f.blocT("P1").sj)[0];
  a.db.temps.push(bloc("P9", "p1", jour(3, 6, 0), jour(3, 6, 30)));
  a.S.blocId = "P9";
  a.geste({ sjlie: o.g1 });
  A.deepEqual(Array.from(a.f.blocT("P9").sj), [sid], "la même fiche, pas une seconde");
  A.equal((a.db.sujets || []).length, 1, "et une seule ligne au cahier");
});

test("13.ek — ce qui est déjà nommé dans la séance ne se retend pas", () => {
  const a = app();
  const o = aPorter(a);
  a.geste({ sjlie: o.g1 });
  a.f.vSujets();
  A.equal(a.Z.html.indexOf('data-sjlie="' + o.g1 + '"'), -1,
    "Estelle est déjà portée dans cette prière : elle quitte les tendus (13.eh)");
  A.match(a.Z.html, new RegExp('data-sjlie="' + o.g2 + '"'), "les autres restent tendus");
  a.geste({ sjlie: o.g1 });
  A.match(a.dernierToast(), /Déjà nommé dans cette séance/,
    "et l'autre chemin est refusé de la même façon");
  A.equal(Array.from(a.f.blocT("P1").sj).length, 1);
});

test("13.ek — écrire ses propres mots détache, et l'écran l'avait dit", () => {
  const a = app();
  const o = aPorter(a);
  a.geste({ sjlie: o.g1 });
  const sid = Array.from(a.f.blocT("P1").sj)[0];
  a.S.sujId = sid; a.S.view = "sujet";
  a.f.vSujet();
  A.match(a.Z.html, /Ce sujet suit la fiche d'Estelle/,
    "l'avertissement précède le geste (P9), et il s'élide : « de Estelle » se lit comme une faute");
  A.match(a.Z.html, /il s'en détache/);
  a.ecrit("sjTxt", "La santé d'Estelle");
  a.actions.sjGarder();
  A.equal(a.f.sujet(sid).lie, null, "ses mots l'emportent, et ils détachent");
  A.equal(a.f.sujetTxt(sid), "La santé d'Estelle");
  A.match(a.dernierToast(), /dans tes mots/, "et il est prévenu de ce qui vient d'arriver");
});

test("13.ek — l'élision tient sur les noms qui commencent par une voyelle", () => {
  const a = app();
  A.equal(a.f.de("Estelle"), "d'Estelle");
  A.equal(a.f.de("Henriette"), "d'Henriette", "le h muet s'élide aussi");
  A.equal(a.f.de("Joseph"), "de Joseph");
  A.equal(a.f.de("Élise"), "d'Élise", "accentuée ou non, c'est la même voyelle");
  A.equal(a.f.de(""), "de ", "et rien ne jette sur un nom vide");
});

test("13.ek — une phrase ne se termine qu'une fois", () => {
  const a = app();
  A.equal(a.f.pt("Ce sujet suit la fiche d'Estelle A."), "Ce sujet suit la fiche d'Estelle A.",
    "un nom abrégé porte déjà son point : « A.. » s'est vu à l'écran");
  A.equal(a.f.pt("Ce sujet suit la fiche de Joseph"), "Ce sujet suit la fiche de Joseph.");
  A.equal(a.f.pt("Vraiment ?"), "Vraiment ?", "ni après un autre signe de fin");
  A.equal(a.f.pt(""), "", "et rien ne sort d'une phrase vide");
});

/* ------------------------------------------------------------------
   13.el — ce qui s'écoute ne se pagine pas.
   Les quatre blocs « pages » restés vides sont tous la même activité :
   « Écoute Enseignements TA », neuf heures quarante d'enseignement
   écouté, à qui l'application demandait sa dernière page lue. Ce
   n'était pas une friction, c'était une question sans réponse
   possible.
   ------------------------------------------------------------------ */

/* Une écoute qui tourne, et rien de déclaré : l'état du 7 novembre. */
function ecoute(a) {
  a.maintenant(MIDI);
  a.db.taches = [{ id: "e1", nom: "Écoute Enseignements TA", cat: "dieu", d: "litt", maj: 1 },
                 { id: "e2", nom: "Lecture perso", cat: "moi", d: "litt", maj: 1 }];
  a.db.temps = [bloc("E1", "e1", j(14, 16), j(17, 57))];
  a.S.blocId = "E1"; a.S.view = "pages";
  return a;
}

test("13.el — un ouvrage en parties ne demande pas son nombre de pages", () => {
  const a = app();
  ecoute(a);
  a.S.lvId = null; a.S.lvSp = "parties"; a.S.view = "livre";
  a.f.vLivre();
  A.match(a.Z.html, /Comment on y avance/, "la première question est la nature de la chose");
  A.equal(a.Z.html.indexOf('id="lvPages"'), -1,
    "un enseignement n'a pas de nombre de pages : on ne le demande pas");
  A.match(a.Z.html, /ce qui se <b>suit<\/b>/, "et l'écran dit pourquoi");

  a.ecrit("lvNom", "Enseignements TA");
  a.actions.livreGarder();
  A.equal((a.db.livres || []).length, 1, "il se garde sans nombre de pages");
  A.equal(Array.from(a.db.livres)[0].sp, "parties");
  A.equal(a.f.enParties(Array.from(a.db.livres)[0].id), true);
});

test("13.el — un livre, lui, réclame toujours ses pages", () => {
  const a = app();
  ecoute(a);
  a.S.lvId = null; a.S.lvSp = "pages"; a.S.view = "livre";
  a.f.vLivre();
  A.match(a.Z.html, /id="lvPages"/);
  a.ecrit("lvNom", "Une voix pour le réveil");
  a.actions.livreGarder();
  A.equal((a.db.livres || []).length, 0, "sans pages, il ne se garde pas");
  A.match(a.dernierToast(), /combien il a de pages/);
});

test("13.el — une fiche écrite avant la règle reste un livre", () => {
  const a = app();
  ecoute(a);
  a.db.livres = [{ id: "L1", nom: "Une voix pour le réveil", pages: 214, a: "", maj: 1 }];
  A.equal(a.f.enParties("L1"), false, "pas de sp : c'est un livre, comme avant");
  a.S.pgL = "L1"; a.S.pgA = null; a.S.pgZ = null;
  a.f.vPages();
  A.match(a.Z.html, /Jusqu'où es-tu allé/, "la question des pages ne bouge pas");
});

test("13.el — l'écran d'une série ne pose plus « jusqu'où »", () => {
  const a = app();
  ecoute(a);
  a.db.livres = [{ id: "S1", nom: "Enseignements TA", pages: 0, a: "", sp: "parties", maj: 1 }];
  a.S.pgL = "S1"; a.S.pgA = null; a.S.pgZ = null;
  a.f.vPages();
  A.match(a.Z.html, /Tu commences <b>Enseignements TA<\/b>, à la <b>partie 1<\/b>/);
  A.equal(a.Z.html.indexOf("Jusqu'où es-tu allé"), -1, "la question ne se pose pas");
  A.match(a.Z.html, /Dernière partie suivie/, "et le champ, s'il sert, parle de parties");
  A.match(a.Z.action, /Garder la partie 1/, "le bouton dit ce qu'une tape va garder");
});

test("13.el — une tape garde la partie, et le signet donne la suivante", () => {
  const a = app();
  ecoute(a);
  a.db.livres = [{ id: "S1", nom: "Enseignements TA", pages: 0, a: "", sp: "parties", maj: 1 }];
  a.S.pgL = "S1"; a.S.pgA = null; a.S.pgZ = null;
  a.f.vPages();
  a.actions.addPg();
  A.deepEqual(Array.from(a.f.blocT("E1").pg[0]), ["S1", 1, 1], "la partie 1 est gardée");
  A.match(a.dernierToast(), /partie 1/, "et le mot est juste : partie, pas page");
  A.equal(a.f.nomPassagePg(["S1", 1, 1]), "Enseignements TA, partie 1");

  a.db.temps.push(bloc("E2", "e1", jour(9, 1, 15), jour(9, 1, 55)));
  a.S.blocId = "E2"; a.S.pgA = null; a.S.pgZ = null;
  a.f.vPages();
  A.match(a.Z.html, /à la <b>partie 2<\/b>/, "le signet se lit dans l'archive, comme pour un livre");
});

test("13.el — une série ne se termine pas toute seule", () => {
  const a = app();
  ecoute(a);
  /* Le cas qui mord : une fiche d'abord déclarée en livre, puis passée en
     parties. Son ancien nombre de pages traîne encore, et refermerait la
     série dès la 40e partie si on lisait ce nombre. */
  a.db.livres = [{ id: "S1", nom: "Enseignements TA", pages: 38, a: "", sp: "parties", maj: 1 }];
  a.db.temps[0].pg = [["S1", 1, 40]];
  A.equal(a.f.livreFini(a.f.livre("S1")), false,
    "une série n'annonce pas son dernier numéro : rien ne la ferme d'office");
  A.deepEqual(Array.from(a.f.livresOuverts(), l => l.id), ["S1"]);
  a.f.livre("S1").fini = 1;
  A.equal(a.f.livreFini(a.f.livre("S1")), true, "lui seul peut la fermer (13.cf)");
});

test("13.el — le compte rendu n'additionne pas des pages et des parties", () => {
  const a = app();
  ecoute(a);
  a.db.livres = [{ id: "L1", nom: "Une voix", pages: 214, a: "", maj: 1 },
                 { id: "S1", nom: "Enseignements TA", pages: 0, a: "", sp: "parties", maj: 1 }];
  a.db.temps[0].pg = [["S1", 1, 3]];
  a.db.temps.push(bloc("E3", "e2", j(9, 0), j(10, 0), { pg: [["L1", 10, 29]] }));
  const t = a.f.mesureDisc("litt", j(0, 0), jour(30, 0, 0));
  A.match(t, /20 pages/, "les pages d'un livre restent des pages");
  A.match(t, /3 parties/, "et les parties suivies se disent à côté");
  A.equal(t.indexOf("23"), -1, "leur somme ne veut rien dire et n'apparaît pas");
});

test("13.el — ce qu'on reçoit d'un auteur garde les deux unités", () => {
  const a = app();
  ecoute(a);
  const au = a.f.auteurId("Théodore Andoseh");
  a.db.livres = [{ id: "L1", nom: "Une voix", pages: 214, a: au, maj: 1 },
                 { id: "S1", nom: "Enseignements TA", pages: 0, a: au, sp: "parties", maj: 1 }];
  a.db.temps[0].pg = [["S1", 1, 3], ["L1", 1, 12]];
  const r = a.f.recuDe(au);
  A.equal(r.pages, 12);
  A.equal(r.parts, 3);
  const t = a.f.recuTxt(r);
  A.match(t, /12 pages/);
  A.match(t, /3 parties suivies/);
});

/* ------------------------------------------------------------------
   13.em — une devinette n'a pas le droit de se faire passer pour un
   choix.
   Mesure du 10 novembre : 47 % du temps compté (46 h 24 sur 98 h 24)
   repose sur une routine déduite du nom de l'activité. La devinette
   était juste six fois sur six — ce n'est donc pas une correction de
   chiffres. C'est que rien, nulle part, ne distinguait un rangement
   dit par le disciple d'un rangement supposé par l'application.
   ------------------------------------------------------------------ */

/* L'archive du 10 novembre en miniature : trois activités qui n'ont
   jamais dit leur routine, dont une que le nom ne range nulle part,
   et une qui l'a dite. */
function devinees(a) {
  a.maintenant(MIDI);
  /* Déclarées dans le désordre, à dessein : c'est le poids qui doit les
     ranger, pas l'ordre où elles sont nées. */
  a.db.taches = [
    { id: "d3", nom: "Priere", cat: "dieu", maj: 1 },
    { id: "d4", nom: "Évangélisation", cat: "dieu", d: "ames", maj: 1 },
    { id: "d1", nom: "Sommeil", cat: "reste", maj: 1 },
    { id: "d2", nom: "Nuit de prière Paris", cat: "dieu", maj: 1 }
  ];
  a.db.temps = [
    bloc("B1", "d1", j(0, 0), j(7, 0)),
    bloc("B2", "d2", j(8, 0), j(10, 0)),
    bloc("B3", "d3", j(10, 0), j(11, 0)),
    bloc("B4", "d4", j(11, 0), j(11, 30))
  ];
  return a;
}
function tq(a, id) {
  return Array.from(a.db.taches).filter(function (t) { return t.id === id; })[0];
}

test("13.em — le champ absent dit la devinette, pas sa valeur", () => {
  const a = app();
  devinees(a);
  A.equal(a.f.discDevine("d3"), true, "« Priere » n'a jamais dit sa routine");
  A.equal(a.f.discTache("d3"), "priere", "et l'app compte pourtant avec");
  A.equal(a.f.discDevine("d4"), false, "« Évangélisation » l'a dite");
  /* Le cas qui commande toute la règle : « aucune routine » est un choix,
     et il s'écrit "". Le confondre avec l'absence du champ ferait repasser
     par la devinette ce que le disciple a déjà tranché. */
  tq(a, "d1").d = "";
  A.equal(a.f.discDevine("d1"), false, "dire « aucune » est un choix, pas un vide");
  A.equal(a.f.discTache("d1"), "", "et ce choix tient");
});

test("13.em — les devinées se comptent, la plus lourde d'abord", () => {
  const a = app();
  devinees(a);
  const ds = a.f.tachesDevinees();
  A.deepEqual(ds.map(function (x) { return x.t.nom; }),
    ["Sommeil", "Nuit de prière Paris", "Priere"],
    "l'ordre est celui du poids : on solde d'abord ce qui pèse le plus");
  A.equal(a.f.msDevinees(), 10 * H, "sept heures, deux heures, une heure");
  A.equal(a.f.hm(a.f.msDevinees()), "10 h");
});

test("13.em — la fiche dit ce qu'elle a deviné et attend ton mot", () => {
  const a = app();
  devinees(a);
  a.S.tchId = "d3"; a.S.view = "tache";
  a.f.vTache();
  A.match(a.Z.html, /Ceci est <b>deviné<\/b> d'après son nom/,
    "l'écran ne présente pas une supposition comme un rangement");
  A.match(a.Z.html, /data-dok="d3"/, "et la tape qui la confirme est là");
  A.match(a.Z.html, /Oui : La prière seul/, "elle dit ce qu'elle confirme");
  A.match(a.Z.html, /Rien ne bougera dans tes chiffres/);
});

test("13.em — une activité qui a dit sa routine ne se fait pas redemander", () => {
  const a = app();
  devinees(a);
  a.S.tchId = "d4"; a.S.view = "tache";
  a.f.vTache();
  A.equal(a.Z.html.indexOf("data-dok"), -1,
    "ce qui est dit est dit : on ne repose pas la question");
  A.equal(a.Z.html.indexOf("deviné"), -1);
});

test("13.em — confirmer n'écrit que ce qui était déjà compté", () => {
  const a = app();
  devinees(a);
  const avant = a.f.discTache("d2");
  const parAvant = a.f.parDisc({ d1: 7 * H, d2: 2 * H, d3: 1 * H, d4: 0.5 * H });
  a.geste({ dok: "d2" });
  A.equal(a.f.discTache("d2"), avant, "la routine ne bouge pas d'un pouce");
  A.equal(a.f.discDevine("d2"), false, "mais elle n'est plus supposée");
  A.deepEqual(a.f.parDisc({ d1: 7 * H, d2: 2 * H, d3: 1 * H, d4: 0.5 * H }), parAvant,
    "et aucune part n'a changé : c'est tout l'intérêt de la tape");
  A.match(a.dernierToast(), /Prière avec les autres/);
});

test("13.em — ce que le nom ne range nulle part se dit « aucune routine »", () => {
  const a = app();
  devinees(a);
  a.S.tchId = "d1"; a.S.view = "tache";
  a.f.vTache();
  A.match(a.Z.html, /Oui : aucune routine/,
    "dormir n'est pas une routine spirituelle, et l'app ne peut pas le décider seule");
  a.geste({ dok: "d1" });
  A.equal(tq(a, "d1").d, "", "le choix s'écrit, vide");
  A.equal(a.f.discDevine("d1"), false);
  A.match(a.dernierToast(), /aucune routine/);
  A.equal(a.f.tachesDevinees().length, 2, "et elle quitte la liste");
});

test("13.em — une tape tardive n'efface pas un choix déjà fait", () => {
  const a = app();
  devinees(a);
  /* Le nom dit « prière », le disciple a dit autre chose : si la tape
     repassait par la devinette, elle écraserait son mot par le nôtre. */
  tq(a, "d3").d = "ensemble";
  a.geste({ dok: "d3" });
  A.equal(tq(a, "d3").d, "ensemble", "son mot tient");
});

test("13.em — activité par activité, le supposé ne se dit pas comme le rangé", () => {
  const a = app();
  devinees(a);
  a.f.vueGarde("temps", "parts"); a.S.view = "temps";
  a.f.vMonTemps();
  const lignes = a.Z.html.split("<li").filter(function (x) { return x.indexOf("data-tch=") !== -1; });
  const der = lignes.filter(function (x) { return x.indexOf("d4") !== -1; })[0];
  const sup = lignes.filter(function (x) { return x.indexOf("d3") !== -1; })[0];
  A.match(sup, /deviné/, "« Priere » porte sa marque");
  A.equal(der.indexOf("deviné"), -1, "« Évangélisation » n'en porte pas");
});

test("13.em — la porte est au pied des seize routines", () => {
  const a = app();
  devinees(a);
  a.f.vueGarde("temps", "routines"); a.S.view = "temps";
  a.f.vMonTemps();
  A.match(a.Z.html, /data-act="devine"/,
    "le chiffre et sa source se regardent au même endroit");
  A.match(a.Z.html, /3 activités qui n'ont jamais dit leur routine/);
  A.match(a.Z.html, /10 h/, "avec le temps qui repose là-dessus");
});

test("13.em — l'écran des devinées se vide quand tout est dit", () => {
  const a = app();
  devinees(a);
  a.S.view = "devine";
  a.f.vDevine();
  A.match(a.Z.html, /<b>3 activités<\/b>/);
  A.match(a.Z.html, /data-dok="d1"/);
  A.match(a.Z.html, /Aucune routine/, "ce que le nom ne range nulle part se dit aussi");
  A.ok(a.Z.html.indexOf('data-dok="d1"') < a.Z.html.indexOf('data-dok="d3"'),
    "la plus lourde en tête");
  ["d1", "d2", "d3"].forEach(function (id) { a.geste({ dok: id }); });
  a.f.vDevine();
  A.match(a.Z.html, /Plus rien n'est deviné/);
  A.equal(a.Z.html.indexOf("data-dok"), -1);
});

/* ------------------------------------------------------------------
   13.en — ce qu'Il a dit et ce qu'Il a fait ne se rejoignent pas tout
   seuls.
   Mesure du 10 novembre 2026 : 17 paroles gardées, 10 citées comme
   précédent — et les 10 par un acte à lui. Zéro par un acte de Dieu.
   Le mémorial enregistrait « Il a parlé → j'ai répondu », et à part
   « j'ai fait → Il a fait ». Jamais « Il a dit → Il l'a tenu », qui
   est pourtant la seule chose pour laquelle on dresse une pierre.
   ------------------------------------------------------------------ */

/* Une parole d'il y a deux ans, une d'il y a un an, une réponse de lui
   à la première — et rien qui tienne encore ni l'une ni l'autre. */
function dites(a) {
  a.db.nodes = [
    { id: "p1", act: "dieu", man: "parle", kind: "rhema", txt: "« Je pourvoirai pour les tiens. »",
      par: [], date: "2024-11-08", prec: "j", etat: "fait", ts: 1, maj: 1 },
    { id: "p2", act: "dieu", man: "parle", kind: "rhema", txt: "« Ne crains pas pour la maison. »",
      par: [], date: "2025-11-08", prec: "j", etat: "fait", ts: 2, maj: 1 },
    { id: "m1", act: "moi", dest: "dieu", kind: "acte", txt: "Remercier pour cette parole",
      par: ["p1"], date: "2024-11-10", prec: "j", etat: "fait", ts: 3, maj: 1 }
  ];
  return a;
}
function nd(a, id) {
  return Array.from(a.db.nodes).filter(function (x) { return x.id === id; })[0];
}

test("13.en — répondre à une parole n'est pas l'accomplir", () => {
  const a = app();
  dites(a);
  A.equal(a.f.accomplie(nd(a, "p1")), false,
    "« Remercier pour cette parole » suit la parole, il ne la tient pas");
  A.deepEqual(a.f.parolesAttente().map(function (p) { return p.id; }), ["p1", "p2"],
    "les deux attendent, la plus ancienne d'abord");

  a.db.nodes.push({ id: "d1", act: "dieu", man: "pourvu", kind: "acte", txt: "La maison de Nkolbisson",
    par: ["p1"], date: "2026-11-08", prec: "j", etat: "fait", ts: 4, maj: 1 });
  A.equal(a.f.accomplie(nd(a, "p1")), true, "un acte de Lui, lui, la tient");
  A.deepEqual(a.f.parolesAttente().map(function (p) { return p.id; }), ["p2"]);
});

test("13.en — ce qui n'a pas eu lieu n'accomplit rien", () => {
  const a = app();
  dites(a);
  /* Un acte de quelqu'un d'autre compte — c'est souvent par là qu'Il
     passe —, mais seulement une fois qu'il a eu lieu. */
  a.db.nodes.push({ id: "g1", act: "gens", gid: "g9", man: "pourvu", kind: "acte",
    txt: "Il a prêté l'argent du loyer", par: ["p2"], date: "2026-12-01", prec: "j",
    etat: "prevu", ts: 5, maj: 1 });
  A.equal(a.f.accomplie(nd(a, "p2")), false, "prévu n'est pas tenu");
  nd(a, "g1").etat = "fait";
  A.equal(a.f.accomplie(nd(a, "p2")), true, "fait, oui — et par quelqu'un d'autre");
});

test("13.en — les paroles qui attendent passent devant le clavier", () => {
  const a = app();
  dites(a);
  const n = { id: "d9", act: "dieu", man: "pourvu", kind: "acte", txt: "La maison",
              par: [], suj: [], date: "2026-11-08", prec: "j", etat: "fait", ts: 9, maj: 1 };
  a.db.nodes.push(n);
  a.S.nodeId = "d9"; a.S.view = "lier"; a.S.cNeuf = false;
  a.f.vLier();
  A.match(a.Z.html, /Une parole qui attend encore/);
  A.match(a.Z.html, /data-par="p1"/, "elle est là, à portée de doigt");
  A.ok(a.Z.html.indexOf('data-par="p1"') < a.Z.html.indexOf('id="cFiltre"'),
    "avant le champ de recherche : ce qui se tape se remplit, ce qui s'écrit reste vide");
  A.ok(a.Z.html.indexOf('data-par="p1"') < a.Z.html.indexOf('data-par="p2"'),
    "la plus ancienne en tête");
  A.match(a.Z.html, /attend depuis/, "et la ligne dit depuis quand");
});

test("13.en — on ne tend rien à un acte de moi", () => {
  const a = app();
  dites(a);
  a.S.nodeId = "m1"; a.S.view = "lier"; a.S.cNeuf = false;
  a.f.vLier();
  A.equal(a.Z.html.indexOf("Une parole qui attend encore"), -1,
    "mon acte répond à une parole, il ne l'accomplit pas : la tendre serait mentir");
});

test("13.en — une parole ne se tend pas à elle-même", () => {
  const a = app();
  dites(a);
  a.S.nodeId = "p2"; a.S.view = "lier"; a.S.cNeuf = false;
  a.f.vLier();
  A.equal(a.Z.html.indexOf("Une parole qui attend encore"), -1,
    "une parole qui en cite une autre est autre chose, et ça marchait déjà");
});

test("13.en — une tape suffit, et c'est le vrai geste", () => {
  const a = app();
  dites(a);
  a.db.nodes.push({ id: "d9", act: "dieu", man: "pourvu", kind: "acte", txt: "La maison",
    par: [], suj: [], date: "2026-11-08", prec: "j", etat: "fait", ts: 9, maj: 1 });
  a.S.nodeId = "d9"; a.S.view = "lier";
  a.geste({ par: "p1" });
  A.deepEqual(Array.from(nd(a, "d9").par), ["p1"]);
  A.equal(a.f.accomplie(nd(a, "p1")), true, "et la parole est tenue");
  a.f.vLier();
  /* Elle reste atteignable dans la recherche — ce qui est lié ne disparaît
     jamais sous le pouce — mais elle quitte ce qu'on tend. */
  const tendu = a.Z.html.slice(a.Z.html.indexOf("Une parole qui attend encore"),
                               a.Z.html.indexOf('id="cFiltre"'));
  A.equal(tendu.indexOf('data-par="p1"'), -1, "elle n'attend plus");
  A.match(tendu, /data-par="p2"/, "l'autre, si");
});

test("13.en — la parole dit sur sa fiche ce qu'Il en a fait", () => {
  const a = app();
  dites(a);
  a.S.nodeId = "p1"; a.S.view = "node";
  a.f.vNode();
  A.match(a.Z.html, /Ce qu'Il en a fait/);
  A.match(a.Z.html, /Elle attend encore/);
  A.match(a.Z.html, /<b>2 ans<\/b> depuis qu'elle a été dite/);

  a.db.nodes.push({ id: "d1", act: "dieu", man: "pourvu", kind: "acte", txt: "La maison de Nkolbisson",
    par: ["p1"], date: "2026-11-08", prec: "j", etat: "fait", ts: 4, maj: 1 });
  a.f.vNode();
  A.match(a.Z.html, /<b>Accomplie\.<\/b>/, "le mémorial est dressé pour ce mot-là");
  A.match(a.Z.html, /Il a mis <b>2 ans<\/b>/);
  A.match(a.Z.html, /data-node="d1"/, "et ce qui l'a tenue est là, sous la phrase");
});

test("13.en — c'est le premier qui tient la parole qui date l'accomplissement", () => {
  const a = app();
  dites(a);
  /* Elle a été tenue deux fois. Le délai, c'est jusqu'à la première :
     « Il a mis deux ans » reste vrai même s'Il a continué après. */
  a.db.nodes.push({ id: "d2", act: "dieu", man: "pourvu", kind: "acte", txt: "Et encore après",
    par: ["p1"], date: "2026-11-08", prec: "j", etat: "fait", ts: 5, maj: 1 });
  a.db.nodes.push({ id: "d1", act: "dieu", man: "pourvu", kind: "acte", txt: "La maison",
    par: ["p1"], date: "2025-11-08", prec: "j", etat: "fait", ts: 4, maj: 1 });
  A.deepEqual(a.f.accompliesDe(nd(a, "p1")).map(function (x) { return x.id; }), ["d1", "d2"],
    "dans l'ordre où Il a agi, pas celui où c'est gardé");
  a.S.nodeId = "p1"; a.S.view = "node";
  a.f.vNode();
  A.match(a.Z.html, /Il a mis <b>12 mois<\/b>/, "douze mois, pas deux ans");
});

test("13.en — un acte ordinaire ne parle pas d'accomplissement", () => {
  const a = app();
  dites(a);
  a.S.nodeId = "m1"; a.S.view = "node";
  a.f.vNode();
  A.equal(a.Z.html.indexOf("Ce qu'Il en a fait"), -1);
});

test("13.en — les constats lisent la même chose que l'écran", () => {
  const a = app();
  dites(a);
  a.db.nodes.push({ id: "d1", act: "dieu", man: "pourvu", kind: "acte", txt: "La maison",
    par: ["p1"], date: "2026-11-08", prec: "j", etat: "fait", ts: 4, maj: 1 });
  const cs = a.f.constats();
  const delais = cs.filter(function (c) { return c.fam === "Ses délais"; })
                   .map(function (c) { return c.txt; }).join(" | ");
  A.match(delais, /Entre une parole et ce qui l'accomplit/,
    "le constat existait depuis toujours — il n'avait jamais rien à dire");
  A.match(delais, /<b>2 ans<\/b>/);
  A.match(delais, /<b>1<\/b> parole attend/, "et l'autre attend encore");
});

test("13.en — tant qu'aucune parole n'attend, rien n'est tendu", () => {
  const a = app();
  a.db.nodes = [
    { id: "d9", act: "dieu", man: "pourvu", kind: "acte", txt: "La maison",
      par: [], suj: [], date: "2026-11-08", prec: "j", etat: "fait", ts: 9, maj: 1 }
  ];
  a.S.nodeId = "d9"; a.S.view = "lier"; a.S.cNeuf = false;
  a.f.vLier();
  A.equal(a.Z.html.indexOf("Une parole qui attend encore"), -1,
    "une section vide est un mur de plus, pas une aide");
});

/* ------------------------------------------------------------------
   13.eo — une dynamique qui n'a pas de quoi se lire se dit, elle ne
   se dessine pas.
   Mesure du 11 novembre 2026 : quatre jours de chronomètre, et 24 des
   56 actes datés du même jour — celui où il s'est assis pour écrire
   son mémorial. Une courbe tracée là-dessus dirait quand il a commencé
   à se servir de l'app, pas sa marche avec Dieu.
   ------------------------------------------------------------------ */

/* Son archive en miniature : quatre jours comptés, pas un de plus. */
function quatreJours(a) {
  a.maintenant(MIDI);
  a.db.taches = [{ id: "t1", nom: "Priere", cat: "dieu", d: "priere", maj: 1 },
                 { id: "t2", nom: "Sommeil", cat: "moi", d: "", maj: 1 }];
  a.db.temps = [
    bloc("b1", "t1", jour(5, 21, 0), jour(5, 22, 0)),
    bloc("b2", "t1", jour(6, 21, 0), jour(6, 22, 30)),
    bloc("b3", "t1", jour(7, 5, 0), jour(7, 6, 0)),
    bloc("b4", "t1", jour(8, 21, 0), jour(8, 22, 0)),
    bloc("b5", "t2", jour(8, 0, 0), jour(8, 4, 0))
  ];
  return a;
}

test("13.eo — quatre jours ne font pas une dynamique, et l'app le dit", () => {
  const a = app();
  quatreJours(a);
  A.equal(a.f.joursComptes(), 4, "quatre jours distincts, cinq blocs");
  a.S.view = "revel"; a.S.rev = "dynamiques";
  a.f.vRevel();
  A.match(a.Z.html, /Elle ne dessine rien/, "la garde est en tête, pas en bas de page");
  A.match(a.Z.html, /Ce qui attend encore/);
  A.match(a.Z.html, /4 \/ 14/, "où l'on en est, et de combien");
  A.match(a.Z.html, /il en manque 10 jours comptés/);
  A.equal(a.Z.html.indexOf("Ce qui se lit déjà"), -1,
    "rien n'est lisible : la section ne s'affiche même pas");
});

test("13.eo — « il en manque 1 parole accomplie » ne se dit pas au pluriel", () => {
  const a = app();
  quatreJours(a);
  a.db.nodes = [];
  /* Deux paroles tenues, une de moins que le seuil : c'est exactement où
     son archive se trouve le 11 novembre. */
  ["p1", "p2"].forEach(function (id, i) {
    a.db.nodes.push({ id: id, act: "dieu", man: "parle", kind: "rhema", txt: "« … »",
      par: [], date: "2025-0" + (i + 1) + "-08", prec: "j", etat: "fait", ts: i + 1, maj: 1 });
    a.db.nodes.push({ id: "d" + id, act: "dieu", man: "pourvu", kind: "acte", txt: "Il l'a tenue",
      par: [id], date: "2026-0" + (i + 1) + "-08", prec: "j", etat: "fait", ts: 10 + i, maj: 1 });
  });
  A.equal(a.f.nbAccomplies(), 2);
  a.S.view = "revel"; a.S.rev = "dynamiques";
  a.f.vRevel();
  A.match(a.Z.html, /il en manque 1 parole accomplie/);
  A.equal(a.Z.html.indexOf("il en manque 1 paroles"), -1);
});

test("13.eo — le jour où le seuil est franchi, elle parle d'elle-même", () => {
  const a = app();
  quatreJours(a);
  /* On n'a rien touché d'autre que le nombre de jours. */
  for (let d = 9; d <= 18; d++) {
    a.db.temps.push(bloc("x" + d, "t1", jour(d, 21, 0), jour(d, 22, 0)));
  }
  A.equal(a.f.joursComptes(), 14);
  a.S.view = "revel"; a.S.rev = "dynamiques";
  a.f.vRevel();
  A.match(a.Z.html, /Ce qui se lit déjà/);
  A.match(a.Z.html, /Le rythme de tes journées/);
  A.match(a.Z.html, /Tu es le plus à Lui vers 21 h —/,
    "une seule heure nommée : les autres pèsent moins du quart");
  A.equal(a.Z.html.indexOf("vers 5 h"), -1);
  A.match(a.Z.html, /4 \/ 21/, "l'autre attend toujours ses trois semaines");
});

test("13.eo — l'heure du jour se lit sur ce qui est pour Lui, pas sur tout", () => {
  const a = app();
  quatreJours(a);
  const h = a.f.heuresDuJour();
  A.equal(h[21], 3 * H, "trois soirées de prière commencées à 21 h");
  A.equal(h[22], 30 * MIN, "et la demi-heure qui déborde");
  A.equal(h[5], 1 * H);
  A.equal(h[0], 0, "les quatre heures de sommeil ne sont pas à Lui");
  A.equal(h[2], 0);
});

test("13.eo — un bloc qui enjambe l'heure se partage entre les deux", () => {
  const a = app();
  a.maintenant(MIDI);
  a.db.taches = [{ id: "t1", nom: "Priere", cat: "dieu", d: "priere", maj: 1 }];
  a.db.temps = [bloc("b1", "t1", j(22, 40), j(23, 10))];
  const h = a.f.heuresDuJour();
  A.equal(h[22], 20 * MIN, "vingt minutes avant");
  A.equal(h[23], 10 * MIN, "dix après");
});

test("13.eo — le creux est la plus longue suite d'heures vides, sans boucler", () => {
  const a = app();
  const h = new Array(24).fill(0);
  [1, 2, 21, 22, 23].forEach(function (i) { h[i] = 1; });
  A.deepEqual(Array.from(a.f.creuxDuJour(h)), [3, 21],
    "de 3 h à 21 h, et non « de 23 h à 1 h » que personne ne lit comme un trou");
  A.equal(a.f.creuxDuJour(new Array(24).fill(1)), null, "aucun creux : on n'en invente pas");
});

test("13.eo — le va-et-vient compte les deux sens, et seulement ce qui a eu lieu", () => {
  const a = app();
  a.maintenant(MIDI);
  a.db.nodes = [
    { id: "D1", act: "dieu", man: "pourvu", kind: "acte", txt: "Il a pourvu",
      par: [], date: "2026-10-01", prec: "j", etat: "fait", ts: 1, maj: 1 },
    { id: "M1", act: "moi", dest: "dieu", kind: "acte", txt: "Le remercier",
      par: ["D1"], date: "2026-10-04", prec: "j", etat: "fait", ts: 2, maj: 1 },
    { id: "M2", act: "moi", dest: "dieu", kind: "acte", txt: "Jeûner un jour",
      par: [], date: "2026-09-01", prec: "j", etat: "fait", ts: 3, maj: 1 },
    { id: "D2", act: "dieu", man: "pourvu", kind: "acte", txt: "Il a répondu",
      par: ["M2"], date: "2026-09-21", prec: "j", etat: "fait", ts: 4, maj: 1 },
    { id: "M3", act: "moi", dest: "dieu", kind: "acte", txt: "Une démarche",
      par: [], date: "2026-09-01", prec: "j", etat: "fait", ts: 5, maj: 1 },
    { id: "D3", act: "dieu", man: "pourvu", kind: "acte", txt: "Ce qu'Il fera",
      par: ["M3"], date: "2026-12-01", prec: "j", etat: "prevu", ts: 6, maj: 1 }
  ];
  const e = a.f.echanges();
  A.deepEqual(Array.from(e.mien).map(function (x) { return x.j; }), [3], "trois jours pour rendre");
  A.deepEqual(Array.from(e.sien).map(function (x) { return x.j; }), [20], "vingt pour répondre");
  A.equal(a.f.nbEchanges(), 2, "ce qui est encore prévu n'a répondu à rien");
  A.match(a.f.dynEchanges(), /Tu mets <b>3 jours<\/b>/);
  A.match(a.f.dynEchanges(), /Il met <b>20 jours<\/b>/);
});

test("13.eo — une semaine contre l'autre, et le bruit se tait", () => {
  const a = app();
  a.maintenant(MIDI);
  a.db.taches = [{ id: "t1", nom: "Priere", cat: "dieu", d: "priere", maj: 1 },
                 { id: "t2", nom: "Lecture", cat: "dieu", d: "parole", maj: 1 }];
  a.db.temps = [
    bloc("a1", "t1", jour(6, 21, 0), jour(6, 23, 0)),   /* cette semaine : 2 h */
    bloc("a2", "t1", jour(1, 21, 0), jour(1, 22, 0)),   /* la précédente : 1 h */
    bloc("c1", "t2", jour(6, 9, 0), jour(6, 9, 2)),     /* 2 min */
    bloc("c2", "t2", jour(1, 9, 0), jour(1, 9, 1))      /* 1 min */
  ];
  const t = a.f.dynSemaine();
  A.match(t, /La prière seul \+ 1 h/, "une heure de plus, et dans quel sens");
  A.equal(t.indexOf("Bible"), -1, "une minute d'écart n'est pas un mouvement");
});

test("13.eo — rien à dire se dit, plutôt que de ne rien afficher", () => {
  const a = app();
  a.maintenant(MIDI);
  a.db.taches = [{ id: "t1", nom: "Priere", cat: "dieu", d: "priere", maj: 1 }];
  a.db.temps = [bloc("a1", "t1", jour(6, 21, 0), jour(6, 22, 0)),
                bloc("a2", "t1", jour(1, 21, 0), jour(1, 22, 0))];
  A.match(a.f.dynSemaine(), /Rien n'a bougé/);
});

test("13.eo — les seuils sont ceux de la table, pas ceux de l'écran", () => {
  const a = app();
  const ids = Array.from(a.c.DYN).map(function (d) { return d.id; });
  A.deepEqual(ids, ["progres", "jour", "semaine", "vaetvient", "parole"]);
  /* 13.eq — un nombre agrégé supporte le bruit que seize nombres séparés ne
     supportent pas : la semaine contre la précédente demande moins de jours
     que le détail des seize routines. */
  const seuil = {};
  Array.from(a.c.DYN).forEach(function (d) { seuil[d.id] = d.faut; });
  A.ok(seuil.progres < seuil.semaine,
    "l'agrégat parle avant le détail, et jamais l'inverse");
  Array.from(a.c.DYN).forEach(function (d) {
    A.ok(d.faut >= 3, d.id + " : un seuil en dessous de trois points ne protège de rien");
    A.ok(typeof d.lit === "function" && typeof d.ou === "function");
    A.equal(d.unite.length, 2, d.id + " : singulier et pluriel");
  });
});

/* ------------------------------------------------------------------
   13.ep — un seuil de fidélité ne se devine pas : il se déclare.
   Mesure du 12 novembre 2026 : quatre jours de chronomètre, sept
   routines sur seize jamais comptées, et le plus long intervalle
   visible à 2,3 jours. L'app n'a aucun moyen de savoir ce que
   « longtemps » veut dire pour lui — le seuil vient donc de lui.
   ------------------------------------------------------------------ */

/* Une routine déclarée à tel rythme, dite il y a tant de jours. */
function ryth(a, d, n, ditIlYA) {
  a.db.rythmes = a.db.rythmes || [];
  const t = jour(8 - (ditIlYA === undefined ? 0 : ditIlYA), 9, 0);
  a.db.rythmes.push({ id: "r-" + d, d: d, n: n, ts: t, maj: t });
  return a;
}
/* Une activité qui porte une routine, et un bloc pointé dessus. */
function signe(a, d, ilYA, h) {
  a.db.taches = a.db.taches || [];
  const tid = "t-" + d;
  if (!a.db.taches.filter(function (t) { return t.id === tid; }).length)
    a.db.taches.push({ id: tid, nom: "Activité " + d, cat: "dieu", d: d, maj: 1 });
  a.db.temps = a.db.temps || [];
  a.db.temps.push(bloc("b" + a.db.temps.length, tid,
    jour(8 - ilYA, h === undefined ? 10 : h, 0), jour(8 - ilYA, (h === undefined ? 10 : h) + 1, 0)));
  return a;
}

test("13.ep — une routine dont le rythme n'est pas dit ne parle pas", () => {
  const a = app();
  signe(a, "priere", 40);
  A.equal(a.f.retard("priere"), null, "aucun rythme déclaré : rien à dire");
  A.equal(a.f.rappelFid(), "", "et l'écran d'ouverture reste muet");
  A.equal(a.f.rythDits().length, 0);
});

test("13.ep — un rythme déclaré aujourd'hui n'est pas en retard aujourd'hui", () => {
  const a = app();
  ryth(a, "jeune", 30, 0);
  const r = a.f.retard("jeune");
  A.equal(r.jamais, true, "rien n'a jamais été compté pour le jeûne");
  A.equal(r.j, 0, "l'horloge part de la parole donnée, pas du premier jour du monde");
  A.equal(r.tard, false);
  A.equal(a.f.rappelFid().indexOf("Ce qui attend ta fidélité"), -1,
    "déclarer ne doit pas produire un reproche dans la seconde");
});

test("13.ep — « tous les jours » tolère qu'un jour passe, pas deux", () => {
  const a = app();
  ryth(a, "priere", 1, 10);
  signe(a, "priere", 1);
  A.equal(a.f.retard("priere").j, 1);
  A.equal(a.f.retard("priere").tard, false,
    "l'app ne réclame pas la prière du matin à midi");
  a.db.temps = [];
  signe(a, "priere", 2);
  A.equal(a.f.retard("priere").tard, true, "deux jours franchis : là, elle parle");
});

test("13.ep — « rien de compté » ne se dit jamais « tu n'as pas prié »", () => {
  const a = app();
  ryth(a, "priere", 1, 10);
  signe(a, "priere", 4);
  const h = a.f.rappelFid();
  A.match(h, /Rien de compté depuis 4 jours/);
  /* Même niée, la phrase serait écrite sous ses yeux : elle ne doit pas
     figurer à l'écran du tout. */
  A.equal(h.toLowerCase().indexOf("tu n'as pas prié"), -1,
    "l'app ne mesure que ce qui est pointé, et elle n'a le droit que de cette phrase");
  A.equal(h.toLowerCase().indexOf("manque de fidélité"), -1);
  A.match(h, /ce que tu as vécu sans le compter ne se voit pas d'ici/,
    "et elle le dit en clair, une fois");
});

test("13.ep — le jour zéro n'est pas une durée", () => {
  const a = app();
  /* Déclaré à l'instant : c'est le moment le plus délicat de toute la règle,
     et « 0 jours après l'avoir dit » y serait une phrase fausse. */
  ryth(a, "jeune", 1, 0);
  A.equal(a.f.fidTxt(a.f.retard("jeune")), "Dit aujourd'hui — rien de compté encore");
  ryth(a, "priere", 1, 10);
  signe(a, "priere", 0);
  A.equal(a.f.fidTxt(a.f.retard("priere")), "Compté aujourd'hui");
  const h = a.f.rappelFid();
  A.equal(h.indexOf("0 jour"), -1, "aucune des deux phrases ne se dit au jour zéro");
});

test("13.ep — jamais compté : le retard part de la parole donnée", () => {
  const a = app();
  ryth(a, "jeune", 7, 10);
  const r = a.f.retard("jeune");
  A.equal(r.j, 10);
  A.equal(r.tard, true, "dix jours pour un rythme de sept");
  A.match(a.f.fidTxt(r), /Jamais rien de compté, 10 jours après l'avoir dit/);
});

test("13.ep — une retraite en cours compte comme signe du jour", () => {
  const a = app();
  ryth(a, "retraite", 7, 40);
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(6, 6, 0), maj: 1 }];
  A.equal(a.f.perOuverte(a.db.periodes[0]), true);
  A.equal(a.f.retard("retraite").j, 0,
    "on y EST : elle ne pèse aucune heure et vaut signe de maintenant (13.cw)");
  A.equal(a.f.retard("retraite").tard, false);
});

test("13.ep — une période fermée date le signe à sa fin", () => {
  const a = app();
  ryth(a, "retraite", 7, 40);
  a.db.periodes = [{ id: "p1", d: "retraite", deb: jour(1, 6, 0), fin: jour(3, 18, 0), maj: 1 }];
  A.equal(a.f.retard("retraite").j, 5, "le 3 novembre, pas le 1er");
  A.equal(a.f.retard("retraite").tard, false, "cinq jours pour un rythme de sept");
});

test("13.ep — un bloc en cours vaut maintenant", () => {
  const a = app();
  ryth(a, "parole", 1, 20);
  a.db.taches = [{ id: "t1", nom: "Bible", cat: "dieu", d: "parole", maj: 1 }];
  a.db.temps = [bloc("b1", "t1", jour(8, 11, 0))];
  A.equal(a.f.retard("parole").j, 0, "un bloc sans fin est un bloc en cours (13.cf)");
  A.equal(a.f.retard("parole").tard, false);
});

test("13.ep — le signe ne vient que de la routine concernée", () => {
  const a = app();
  ryth(a, "priere", 1, 20);
  signe(a, "parole", 0);
  A.equal(a.f.dernierSigne("priere"), 0, "lire la Bible n'est pas prier");
  A.equal(a.f.retard("priere").tard, true);
});

test("13.ep — le plus en retard d'abord, pas le plus ancien", () => {
  const a = app();
  /* Deux retards dont l'ordre s'inverse selon ce qu'on classe : la prière
     est moins ancienne mais bien plus loin de sa parole. */
  ryth(a, "priere", 1, 40);
  signe(a, "priere", 20);
  ryth(a, "jeune", 30, 60);
  signe(a, "jeune", 35);
  const rs = a.f.retards();
  A.equal(rs.length, 2);
  A.equal(rs[0].d, "priere", "19 jours au-delà du rythme, contre 5");
  A.equal(rs[0].j, 20, "et pourtant moins ancien que le jeûne");
  A.equal(rs[1].d, "jeune");
  A.equal(rs[1].j, 35);
});

test("13.ep — au-delà de trois, l'écran renvoie aux seize", () => {
  const a = app();
  ["priere", "parole", "litt", "jeune", "donner"].forEach(function (d) {
    ryth(a, d, 1, 20);
  });
  A.equal(a.f.retards().length, 5);
  const h = a.f.rappelFid();
  A.match(h, /Et 2 autres/, "trois lignes, et la porte pour le reste");
  A.match(h, /Voir les seize rythmes/);
  A.match(h, /data-go="rythmes"/);
  A.equal(h.split("Jamais rien de compté").length - 1, 3,
    "trois, pas cinq : l'écran d'ouverture n'est pas un tableau de bord");
});

test("13.ep — quand tout est tenu, une sentinelle muette le dit en une ligne", () => {
  const a = app();
  ryth(a, "priere", 1, 20); signe(a, "priere", 0);
  ryth(a, "parole", 7, 20); signe(a, "parole", 2);
  A.equal(a.f.retards().length, 0);
  A.equal(a.f.rythTenus(), 2);
  const h = a.f.rappelFid();
  A.match(h, /2 rythmes déclarés, tous tenus/);
  A.equal(h.indexOf("Ce qui attend ta fidélité"), -1);
});

test("13.ep — « aucun rythme » est un choix, pas une absence de fiche", () => {
  const a = app();
  ryth(a, "priere", 1, 20);
  a.f.render = function () {};
  a.actions && 0;
  /* Le geste de retrait : la fiche reste, son nombre tombe à zéro — c'est ce
     qui se propage à l'autre appareil, là où une fiche absente
     ressusciterait. */
  a.ctx.geste({ rythn: "priere:0" });
  A.equal(a.db.rythmes.length, 1, "la fiche n'est pas supprimée");
  A.equal(a.db.rythmes[0].n, 0);
  A.equal(a.db.rythmes[0].id, "r-priere",
    "l'identifiant EST la routine : c'est ce qui empêche deux lignes à la fusion");
  A.equal(a.f.rythme("priere"), null);
  A.equal(a.f.rythDits().length, 0);
  A.equal(a.f.rappelFid(), "");
});

test("13.ep — déclarer fabrique une fiche dont l'identifiant EST la routine", () => {
  const a = app();
  a.f.render = function () {};
  A.equal(a.db.rythmes.length, 0, "rien de déclaré au départ");
  a.ctx.geste({ rythn: "priere:1" });
  A.equal(a.db.rythmes.length, 1);
  /* C'est cet identifiant-là, et pas un numéro de série, qui empêche deux
     appareils de déclarer deux fois la même routine (13.ep). */
  A.equal(a.db.rythmes[0].id, "r-priere");
  A.equal(a.db.rythmes[0].d, "priere");
  A.equal(a.db.rythmes[0].n, 1);
  A.ok(a.db.rythmes[0].ts > 0, "l'horloge part de la parole donnée");
  A.ok(a.db.rythmes[0].maj > 0, "et la fiche est datée pour la fusion");
  /* Le même geste sur l'autre appareil ne doit pas faire une seconde ligne. */
  const B = a.f.sane({ rythmes: [{ id: "r-priere", d: "priere", n: 7, ts: 1, maj: 1 }] });
  A.equal(a.f.fusionne(a.db, B).rythmes.length, 1);
});

test("13.ep — une routine inconnue ne se déclare pas", () => {
  const a = app();
  a.f.render = function () {};
  a.ctx.geste({ rythn: "parfum:1" });
  a.ctx.geste({ rythn: "priere:5" });
  A.equal(a.db.rythmes.length, 0,
    "ni une routine qui n'existe pas, ni un rythme hors de l'échelle");
});

test("13.ep — desserrer son rythme n'efface pas un retard réel", () => {
  const a = app();
  ryth(a, "jeune", 1, 30);
  const avant = a.db.rythmes[0].ts;
  a.f.render = function () {};
  a.ctx.geste({ rythn: "jeune:30" });
  A.equal(a.db.rythmes[0].n, 30);
  A.equal(a.db.rythmes[0].ts, avant,
    "l'horloge ne se remet à l'heure qu'au passage de rien à quelque chose");
  A.equal(a.f.retard("jeune").j, 30, "le retard reste compté depuis la première parole");
});

test("13.ep — deux appareils ne font pas deux lignes pour la même routine", () => {
  const a = app();
  const A1 = a.f.sane({ rythmes: [{ id: "r-priere", d: "priere", n: 1, ts: 10, maj: 10 }] });
  const B1 = a.f.sane({ rythmes: [{ id: "r-priere", d: "priere", n: 7, ts: 10, maj: 99 }] });
  const f = a.f.fusionne(A1, B1);
  A.equal(f.rythmes.length, 1, "l'identifiant EST la routine");
  A.equal(f.rythmes[0].n, 7, "et la plus récente écriture tranche");
});

test("13.ep — l'écran des rythmes montre ce qui est dit et ce qui ne l'est pas", () => {
  const a = app();
  ryth(a, "priere", 7, 20);
  signe(a, "priere", 10);
  a.S.view = "rythmes";
  a.f.vRythmes();
  A.match(a.Z.html, /Une fois par semaine/);
  A.match(a.Z.html, /Rien de compté depuis 10 jours/);
  A.match(a.Z.html, /Aucun rythme déclaré/, "les quinze autres le disent");
  A.match(a.Z.html, /data-ryth="jeune"/);
  a.S.rythD = "priere";
  a.f.vRythme();
  A.match(a.Z.html, /data-rythn="priere:1"/);
  A.match(a.Z.html, /data-rythn="priere:0"/);
  A.match(a.Z.html, /Dernier signe il y a <b>10 jours<\/b>/);
});

/* ------------------------------------------------------------------
   13.eq — on ne porte pas « des gens » : on porte celui-ci, pour cela,
   et depuis combien de fois.
   Mesure du 12 novembre 2026 : six personnes, deux sujets, et pas un
   seul sujet rattaché à une personne. Ce n'était pas l'alerte qui
   manquait, c'est l'endroit où écrire.
   ------------------------------------------------------------------ */

function ceuxQuAttendent(a) {
  a.db.gens = [{ id: "g1", nom: "Laure", maj: 1 },
               { id: "g2", nom: "Toussaint", maj: 1 },
               { id: "g3", nom: "Hermine", maj: 1 }];
  a.db.taches = [{ id: "t1", nom: "Prière du matin", cat: "dieu", d: "priere", maj: 1 }];
  a.db.sujets = [
    { id: "s1", txt: "Sa santé", g: "g1", maj: jour(1, 9, 0) },
    { id: "s2", txt: "Son travail", g: "g1", maj: jour(1, 9, 0) },
    { id: "s3", txt: "Sa conversion", g: "g2", n: 100, maj: jour(1, 9, 0) }
  ];
  a.db.temps = [
    bloc("b1", "t1", jour(6, 7, 0), jour(6, 7, 20), { sj: ["s1"] }),
    bloc("b2", "t1", jour(3, 7, 0), jour(3, 7, 20), { sj: ["s3"] })
  ];
  return a;
}

test("13.eq — un sujet est pour quelqu'un ET garde ses propres mots", () => {
  const a = app();
  ceuxQuAttendent(a);
  A.equal(a.f.sujetGens(a.db.sujets[0]), "g1");
  A.equal(a.f.sujetTxt("s1"), "Sa santé", "ses mots, pas « Pour Laure »");
  A.deepEqual(Array.from(a.f.sujetsDe("g1")).map(s => s.id), ["s1", "s2"],
    "deux demandes distinctes pour la même personne — c'est ce qu'il demandait");
  A.equal(a.f.sujetsDe("g3").length, 0);
});

test("13.eq — le lien de 13.ek reste lu comme une personne", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.db.sujets.push({ id: "s4", txt: "Pour Hermine", lie: "g3", maj: 1 });
  A.equal(a.f.sujetGens(a.db.sujets[3]), "g3", "l'ancien lien vaut toujours rattachement");
  A.equal(a.f.sujetTxt("s4"), "Pour Hermine");
  A.equal(a.f.sujetsDe("g3").length, 1);
});

test("13.eq — deux personnes peuvent attendre la même chose", () => {
  const a = app();
  ceuxQuAttendent(a);
  A.equal(a.f.sujetPour("g1", "Sa santé"), "s1", "le même, pour la même personne");
  A.equal(a.f.sujetPour("g1", "  sa   SANTÉ "), "s1", "aux espaces et à la casse près");
  const neuf = a.f.sujetPour("g2", "Sa santé");
  A.notEqual(neuf, "s1", "« sa santé » de l'un n'est pas « sa santé » de l'autre");
  A.equal(a.f.sujetGens(a.f.sujet(neuf)), "g2");
  A.equal(a.f.sujetsDe("g2").length, 2);
  A.equal(a.f.sujetPour("g1", "   "), null);
  A.equal(a.f.sujetPour("gX", "Sa santé"), null, "une personne inconnue n'ouvre rien");
});

test("13.eq — rangés par l'attente, le plus ancien d'abord", () => {
  const a = app();
  ceuxQuAttendent(a);
  const at = a.f.porteAttente();
  A.deepEqual(Array.from(at).map(x => x.g.id), ["g2", "g1"]);
  A.equal(at[0].j, 5, "Toussaint : cinq jours");
  A.equal(at[1].j, 2, "Laure : deux jours — son autre sujet, jamais nommé, ne la vieillit pas");
  A.equal(a.f.porteTxt(at[0]), "Porté il y a 5 jours");
});

test("13.eq — celui que tu as nommé aujourd'hui n'y est pas", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.db.temps.push(bloc("b3", "t1", j(7, 0), j(7, 20), { sj: ["s2"] }));
  const at = a.f.porteAttente();
  A.deepEqual(Array.from(at).map(x => x.g.id), ["g2"],
    "un tour de garde, pas un reproche");
  const h = a.f.rappelPorte();
  A.match(h, /Toussaint/);
  A.equal(h.indexOf("Laure"), -1);
  A.match(h, /pas un reproche/);
});

test("13.eq — jamais nommé : l'horloge part du jour où le sujet a été écrit", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.db.sujets.push({ id: "s4", txt: "Sa paix", g: "g3", maj: jour(4, 9, 0) });
  const x = a.f.porteAttente().filter(y => y.g.id === "g3")[0];
  A.equal(x.der, null);
  A.equal(x.j, 4, "écrit il y a quatre jours, jamais porté");
  A.equal(a.f.porteTxt(x), "Jamais nommé, 4 jours après l'avoir écrit");
  /* Écrit aujourd'hui, il ne doit rien reprocher du tout. */
  a.db.sujets.push({ id: "s5", txt: "Sa joie", g: "g3", maj: j(9, 0) });
  a.db.sujets = a.db.sujets.filter(s => s.id !== "s4");
  A.equal(a.f.porteAttente().filter(y => y.g.id === "g3").length, 0);
});

test("13.eq — le compteur compte des prières, pas des blocs", () => {
  const a = app();
  ceuxQuAttendent(a);
  /* La même prière, coupée puis reprise neuf minutes plus tard (13.eh). */
  a.db.temps.push(bloc("b3", "t1", jour(3, 7, 29), jour(3, 7, 50), { sj: ["s3"] }));
  A.equal(a.f.sujetFois("s3"), 1, "une prière reprise est une fois, pas deux");
  a.db.temps.push(bloc("b4", "t1", jour(5, 7, 0), jour(5, 7, 20), { sj: ["s3"] }));
  A.equal(a.f.sujetFois("s3"), 2);
  /* 13.es — et ces deux séances ne touchent PAS le compteur : l'importunité
     est un acte, pas une statistique. */
  A.equal(a.f.impFois("s3"), 0);
  A.equal(a.f.sujetCompte(a.f.sujet("s3")), "Demandé 0 fois sur 100");
  A.equal(a.f.sujetReste(a.f.sujet("s3")), 100);
});

test("13.eq — le compte atteint se dit, et ne se ferme pas tout seul", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.f.sujet("s3").n = 2;
  a.f.render = function () {};
  a.ctx.geste({ imp: "s3" });
  a.ctx.geste({ imp: "s3" });
  A.equal(a.f.impFois("s3"), 2);
  A.match(a.f.sujetCompte(a.f.sujet("s3")), /Demandé 2 fois sur 2 — tu l'as fait/);
  A.deepEqual(Array.from(a.f.sujetsTenus()).map(s => s.id), ["s3"]);
  A.match(a.f.rappelPorte(), /Tu l'avais dit, tu l'as fait/);
  /* C'est lui qui le retire (P9). */
  a.ctx.geste({ sjvu: "s3" });
  A.ok(a.f.sujet("s3").vu > 0);
  A.equal(a.f.sujetsTenus().length, 0);
  A.equal(a.f.rappelPorte().indexOf("tu l'as fait"), -1);
  A.match(a.f.sujetCompte(a.f.sujet("s3")), /tu l'as fait/,
    "retiré de l'écran d'ouverture, mais la fiche le dit toujours");
});

test("13.eq — relever le nombre rouvre un vœu retiré", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.f.sujet("s3").n = 1; a.f.sujet("s3").vu = 1;
  A.equal(a.f.sujetsTenus().length, 0);
  a.S.view = "sujet"; a.S.sujId = "s3";
  a.ecrit("sjG", "g2"); a.ecrit("sjN", "50");
  a.actions.sjPour();
  A.equal(a.f.sujet("s3").n, 50);
  A.equal(a.f.sujet("s3").vu, undefined,
    "sinon l'accompli d'hier barrerait l'écran pour toujours");
});

test("13.eq — pour qui, et combien de fois : le même geste", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.S.view = "sujet"; a.S.sujId = "s1";
  a.ecrit("sjG", "g2"); a.ecrit("sjN", "12");
  a.actions.sjPour();
  A.equal(a.f.sujetGens(a.f.sujet("s1")), "g2", "on peut le rendre à quelqu'un d'autre");
  A.equal(a.f.sujetBut(a.f.sujet("s1")), 12);
  /* L'écran est resté ouvert : c'est de là qu'il corrige. */
  A.equal(a.S.sujId, "s1");
  a.ecrit("sjG", ""); a.ecrit("sjN", "0");
  a.actions.sjPour();
  A.equal(a.f.sujetGens(a.f.sujet("s1")), null, "et le détacher");
  A.equal(a.f.sujetBut(a.f.sujet("s1")), 0, "zéro ne compte pas");
});

test("13.eq — écrire une demande depuis la fiche de quelqu'un", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.S.view = "porte"; a.S.porteG = "g3";
  a.ecrit("pgSj", "Qu'elle retrouve la paix");
  a.actions.pgAdd();
  A.equal(a.f.sujetsDe("g3").length, 1);
  A.equal(a.f.sujetTxt(a.f.sujetsDe("g3")[0].id), "Qu'elle retrouve la paix");
  /* Deux fois le même texte ne font pas deux sujets. */
  a.ecrit("pgSj", "Qu'elle retrouve la paix");
  a.actions.pgAdd();
  A.equal(a.f.sujetsDe("g3").length, 1);
});

test("13.eq — l'écran d'ouverture plafonne à trois et renvoie au reste", () => {
  const a = app();
  ceuxQuAttendent(a);
  ["g4", "g5", "g6"].forEach(function (id, i) {
    a.db.gens.push({ id: id, nom: "Personne " + i, maj: 1 });
    a.db.sujets.push({ id: "x" + id, txt: "Pour " + id, g: id, maj: jour(1, 9, 0) });
  });
  A.equal(a.f.porteAttente().length, 5);
  const h = a.f.rappelPorte();
  A.match(h, /Et 2 autres/);
  A.match(h, /data-go="portes"/);
  A.equal(h.split('data-porte=').length - 1, 3, "trois lignes, pas cinq");
});

test("13.eq — rien ne parle quand personne n'est porté", () => {
  const a = app();
  a.db.gens = [{ id: "g1", nom: "Laure", maj: 1 }];
  A.equal(a.f.ceuxPortes().length, 0, "une personne sans sujet n'est pas portée");
  A.equal(a.f.rappelPorte(), "");
  a.f.vPortes();
  A.match(a.Z.html, /Aucun sujet pour cette personne/, "mais elle est là, pour qu'il commence");
});

test("13.eq — la fiche d'une personne tient ses demandes distinctes", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.S.porteG = "g1";
  a.f.vPorte();
  A.match(a.Z.html, /Sa santé/);
  A.match(a.Z.html, /Son travail/);
  A.match(a.Z.html, /Dernière fois que tu l'as nommé : <b>2 jours<\/b>/);
  A.match(a.Z.html, /data-act="pgAdd"/);
  a.S.porteG = "g2";
  a.f.render = function () {};
  a.ctx.geste({ imp: "s3" });
  a.f.vPorte();
  A.match(a.Z.html, /Demandé 1 fois sur 100/);
  A.equal(a.Z.html.indexOf("Sa santé"), -1, "les demandes de l'un ne sont pas celles de l'autre");
});

test("13.eq — la dynamique de progrès se tait sous quatorze jours comptés", () => {
  const a = app();
  a.db.taches = [{ id: "t1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 }];
  a.db.temps = [bloc("b1", "t1", jour(7, 9, 0), jour(7, 10, 0))];
  A.equal(a.f.joursComptes(), 1);
  A.equal(a.f.rappelProgres(), "", "un nombre agrégé supporte le bruit, pas l'absence");
  /* Quatorze jours comptés, et elle parle d'elle-même. */
  a.db.temps = [];
  for (let d = 0; d < 14; d++)
    a.db.temps.push(bloc("c" + d, "t1", jour(8 - d, 9, 0), jour(8 - d, 9, 30)));
  A.equal(a.f.joursComptes(), 14);
  A.match(a.f.rappelProgres(), /Où tu en es/);
});

test("13.eq — le progrès, c'est la semaine contre la précédente", () => {
  const a = app();
  a.db.taches = [{ id: "t1", nom: "Prière", cat: "dieu", d: "priere", maj: 1 },
                 { id: "t2", nom: "Sommeil", cat: "moi", d: "", maj: 1 }];
  /* Trois heures à Lui cette semaine, une seule la précédente. */
  a.db.temps = [bloc("b1", "t1", jour(5, 9, 0), jour(5, 12, 0)),
                bloc("b2", "t1", jour(-2, 9, 0), jour(-2, 10, 0)),
                bloc("b3", "t2", jour(5, 14, 0), jour(5, 20, 0))];
  A.match(a.f.dynProgres(), /2 h de plus/,
    "et le sommeil de la même semaine n'y entre pas : c'est ce qui va à Dieu");
  A.match(a.f.dynProgres(), /3 h<\/b> cette semaine/);
  /* L'inverse. */
  a.db.temps = [bloc("b1", "t1", jour(5, 9, 0), jour(5, 10, 0)),
                bloc("b2", "t1", jour(-2, 9, 0), jour(-2, 12, 0))];
  A.match(a.f.dynProgres(), /2 h de moins/);
  /* Cinq minutes d'écart ne sont pas un mouvement (13.eo). */
  a.db.temps = [bloc("b1", "t1", jour(5, 9, 0), jour(5, 10, 2)),
                bloc("b2", "t1", jour(-2, 9, 0), jour(-2, 10, 0))];
  A.match(a.f.dynProgres(), /autant que la précédente/);
});

test("13.eq — une personne effacée ailleurs ne laisse pas un sujet orphelin", () => {
  const a = app();
  ceuxQuAttendent(a);
  /* L'autre appareil l'a supprimée : le sujet reste, il perd ce qu'il
     visait — jamais l'inverse (13.cx, 13.df). */
  a.db.gens = a.db.gens.filter(g => g.id !== "g2");
  A.equal(a.f.sujetGens(a.f.sujet("s3")), null);
  A.equal(a.f.sujetsDe("g2").length, 0);
  A.equal(a.f.ceuxPortes().length, 1, "Laure seule reste portée");
  A.equal(a.f.porteAttente().filter(x => !x.g).length, 0,
    "aucune ligne sans personne");
  A.equal(a.f.sujetTxt("s3"), "Sa conversion", "et le sujet garde ses mots");
});

/* ------------------------------------------------------------------
   13.er — une routine qui se vit en actes ne se mesure pas en heures.
   Donner, jeûner, l'église, servir : on ne lance pas un chronomètre
   pour ces choses-là. Mesure du 12 novembre 2026 : sur ses 56 actes,
   25 sont de lui et pas un seul ne porte de circonstance.
   ------------------------------------------------------------------ */

function acteMoi(id, o) {
  return Object.assign({ id: id, act: "moi", dest: "dieu", kind: "acte", txt: "Un acte",
    desc: "", man: "", par: [], suj: [], etat: "fait", date: today8(), prec: "j",
    ts: 1, maj: 1 }, o || {});
}
function today8() { return "2026-11-08"; }
function dateJ(d) { return "2026-11-" + String(d).padStart(2, "0"); }

function actesEtRoutines(a) {
  a.db.taches = [{ id: "t1", nom: "Prière du matin", cat: "dieu", d: "priere", maj: 1 }];
  a.db.temps = [bloc("b1", "t1", jour(8, 6, 0), jour(8, 7, 0))];
  a.db.nodes = [
    acteMoi("n1", { txt: "J'ai donné la dîme", d: "donner", date: dateJ(6) }),
    acteMoi("n2", { txt: "J'ai jeûné mardi", d: "jeune", date: dateJ(3) }),
    acteMoi("n3", { txt: "J'ai prié avec un frère", pdt: "b1" }),
    acteMoi("n4", { txt: "Je dois appeler Jonas", etat: "prevu", d: "servir", date: dateJ(20) }),
    { id: "n5", act: "dieu", man: "pourvu", kind: "acte", txt: "Il a pourvu", desc: "",
      par: [], suj: [], etat: "fait", date: dateJ(5), prec: "j", d: "donner", ts: 5, maj: 1 }
  ];
  return a;
}

test("13.er — un acte de Dieu n'est pas une routine qu'on pratique", () => {
  const a = app();
  actesEtRoutines(a);
  A.equal(a.f.acteDisc(a.f.node("n5")), "", "même avec le champ posé à la main");
  A.equal(a.f.acteDit(a.f.node("n5")), false);
  A.deepEqual(Array.from(a.f.actesDisc("donner")).map(n => n.id), ["n1"],
    "l'acte de Dieu ne vient pas gonfler la routine");
});

test("13.er — l'absence du champ et « aucune routine » sont deux choses", () => {
  const a = app();
  actesEtRoutines(a);
  A.equal(a.f.acteDit(a.f.node("n3")), false, "n3 n'a rien dit");
  a.f.node("n3").d = "";
  A.equal(a.f.acteDit(a.f.node("n3")), true, "là, il a dit : aucune");
  A.equal(a.f.acteDisc(a.f.node("n3")), "");
  A.equal(a.f.actesSansDisc().length, 0, "et il ne réclame plus rien");
});

test("13.er — la circonstance propose, elle n'applique pas", () => {
  const a = app();
  actesEtRoutines(a);
  A.equal(a.f.acteDiscPropose(a.f.node("n3")), "priere",
    "l'acte a été noté pendant une prière");
  A.equal(a.f.acteDisc(a.f.node("n3")), "", "mais rien n'est écrit tant qu'il n'a pas touché");
  A.deepEqual(Array.from(a.f.actesSansDisc()).map(n => n.id), ["n3"]);
  /* Une circonstance sans routine ne propose rien. */
  a.db.taches[0].d = "";
  A.equal(a.f.acteDiscPropose(a.f.node("n3")), "");
});

test("13.er — ce que le dernier écran affiche est ce qui se garde", () => {
  const a = app();
  actesEtRoutines(a);
  a.S.view = "note";
  a.S.draft = { act: "moi", gid: null, dest: "dieu", dgid: null, txt: "J'ai servi au culte",
    desc: "", man: "", par: [], suj: [], pdt: "b1", etat: "fait", date: today8(),
    prec: "j", fige: false };
  /* L'écran replié montre la proposition, en clair. */
  A.match(a.f.porteDisc(a.S.draft), /La prière seul/);
  A.match(a.f.porteDisc(a.S.draft), /D'après la circonstance/);
  a.actions.saveNote();
  const n = a.db.nodes[a.db.nodes.length - 1];
  A.equal(n.d, "priere", "ce qui était affiché est ce qui est gardé");
  A.equal(a.f.acteDit(n), true);
});

test("13.er — et une tape la défait", () => {
  const a = app();
  actesEtRoutines(a);
  a.S.view = "note";
  a.S.draft = { act: "moi", gid: null, dest: "dieu", dgid: null, txt: "J'ai lu un livre",
    desc: "", man: "", par: [], suj: [], pdt: "b1", etat: "fait", date: today8(),
    prec: "j", fige: false };
  a.ctx.geste({ douv: "1" });
  A.equal(a.S.dOuv, true, "une tape déplie les seize");
  A.match(a.f.porteDisc(a.S.draft), /data-ndisc="donner"/);
  a.ctx.geste({ ndisc: "" });
  A.equal(a.S.draft.d, "", "« aucune routine » est un choix");
  A.equal(a.S.dOuv, false, "et l'écran se replie");
  a.actions.saveNote();
  const n = a.db.nodes[a.db.nodes.length - 1];
  A.equal(n.d, "", "le choix l'emporte sur la proposition");
  A.equal(a.f.acteDit(n), true, "il a dit : il ne sera plus rappelé");
});

test("13.er — une routine inconnue ne s'écrit pas", () => {
  const a = app();
  actesEtRoutines(a);
  a.S.view = "note";
  a.S.draft = { act: "moi", par: [], suj: [], txt: "x", etat: "fait", date: today8(), prec: "j" };
  a.ctx.geste({ ndisc: "parfum" });
  A.equal("d" in a.S.draft, false);
  a.S.view = "acteDisc"; a.S.adiscId = "n3";
  a.ctx.geste({ adiscn: "n3:parfum" });
  A.equal(a.f.acteDit(a.f.node("n3")), false);
  a.ctx.geste({ adiscn: "n5:donner" });
  A.equal(a.f.node("n5").act, "dieu");
  A.equal(a.f.acteDisc(a.f.node("n5")), "", "et un acte de Dieu reste hors de portée");
});

test("13.er — un acte prévu ou abandonné n'est pas un signe", () => {
  const a = app();
  actesEtRoutines(a);
  A.equal(a.f.acteCompte(a.f.node("n4")), false, "ce qui est prévu n'a pas été vécu");
  A.equal(a.f.actesDisc("servir").length, 0);
  a.f.node("n4").etat = "abandon";
  A.equal(a.f.actesDisc("servir").length, 0, "et ce qui est abandonné non plus");
  a.f.node("n4").etat = "encours";
  A.equal(a.f.actesDisc("servir").length, 1, "ce qui dure encore est vécu");
});

test("13.er — le dernier signe d'une routine gagne les actes", () => {
  const a = app();
  actesEtRoutines(a);
  /* « Donner » : aucun bloc, aucun temps mis à part — rien que des actes. */
  ryth(a, "donner", 7, 20);
  A.equal(a.f.dernierSigne("donner") > 0, true,
    "donner sa dîme est un signe, sans qu'aucun chronomètre ait tourné");
  const r = a.f.retard("donner");
  A.equal(r.j, 2, "l'acte du 6 novembre");
  A.equal(r.tard, false, "deux jours pour un rythme de sept");
  A.equal(r.jamais, false);
  /* Sans le champ, la même archive le disait en retard de vingt jours. */
  delete a.f.node("n1").d;
  A.equal(a.f.retard("donner").j, 20);
  A.equal(a.f.retard("donner").tard, true);
});

test("13.er — les deux unités se disent côte à côte et ne s'additionnent pas", () => {
  const a = app();
  actesEtRoutines(a);
  /* La fenêtre des routines s'ouvre sur aujourd'hui : c'est l'acte du jour
     qui s'y lit, comme les heures du jour. */
  a.db.nodes.push(acteMoi("n6", { txt: "J'ai donné ce matin", d: "donner" }));
  a.S.view = "temps";
  a.f.vueGarde("temps", "routines");
  a.f.vMonTemps();
  const h = a.Z.html;
  A.match(h, /1 acte de toi/, "donner n'a pas une minute, et pourtant il a reçu");
  /* Le tiret dit « rien reçu » : il serait faux devant une routine vécue. */
  /* La ligne, et elle seule : la suivante a bien le droit à son tiret. */
  const d0 = h.indexOf("Donner à Dieu");
  const ligneDonner = h.slice(d0, h.indexOf("</li>", d0));
  A.equal(ligneDonner.indexOf("—"), -1, "pas de tiret là où il y a des actes");
  A.match(ligneDonner, /1 acte de toi/);
  const a0 = h.indexOf("La conquête des âmes");
  A.match(h.slice(a0, h.indexOf("</li>", a0)), /—/,
    "mais une routine qui n'a vraiment rien reçu le dit toujours");
  A.match(h, /Le jeûne/);
  /* Et la colonne des heures reste celle des heures. */
  A.equal(h.indexOf("1 h · 1 acte"), -1);
});

test("13.er — la fenêtre compte : un acte d'avant n'entre pas dedans", () => {
  const a = app();
  actesEtRoutines(a);
  const t0 = a.f.minuit(2), t1 = a.f.minuit(0) + 86400000;
  A.deepEqual(Array.from(a.f.actesDisc("donner", t0, t1)).map(n => n.id), ["n1"]);
  A.deepEqual(Array.from(a.f.actesDisc("jeune", t0, t1)).map(n => n.id), [],
    "le jeûne du 3 novembre est hors des trois derniers jours");
  A.equal(a.f.actesDisc("jeune").length, 1, "mais il existe, sur toute l'archive");
});

test("13.er — l'écran des actes sans routine propose ce qu'il peut", () => {
  const a = app();
  actesEtRoutines(a);
  a.f.vActesDisc();
  A.match(a.Z.html, /J'ai prié avec un frère/);
  A.match(a.Z.html, /pendant La prière seul/, "la circonstance répond déjà");
  A.match(a.Z.html, /ne le devinera pas/);
  A.equal(a.Z.html.indexOf("J'ai donné la dîme"), -1, "celui-là a déjà dit");
  A.equal(a.Z.html.indexOf("Il a pourvu"), -1, "et un acte de Dieu n'est pas concerné");
  /* Une tape, et c'est réglé. */
  a.f.render = function () {};
  a.S.view = "adisc";
  a.ctx.geste({ adiscn: "n3:priere" });
  A.equal(a.f.acteDisc(a.f.node("n3")), "priere");
  A.equal(a.f.actesSansDisc().length, 0);
  a.f.vActesDisc();
  A.match(a.Z.html, /Tous tes actes ont dit leur routine/);
});

test("13.er — la fiche d'un acte à lui dit sa routine, ou qu'il n'a rien dit", () => {
  const a = app();
  actesEtRoutines(a);
  a.S.view = "node"; a.S.nodeId = "n3";
  a.f.vNode();
  A.match(a.Z.html, /Pas encore dit/);
  A.match(a.Z.html, /La circonstance propose La prière seul/);
  A.match(a.Z.html, /data-adisc="n3"/);
  a.S.nodeId = "n1";
  a.f.vNode();
  A.match(a.Z.html, /Donner à Dieu/);
  a.S.nodeId = "n5";
  a.f.vNode();
  A.equal(a.Z.html.indexOf("De quelle routine"), -1,
    "on ne demande pas sa routine à un acte de Dieu");
});

test("13.er — ce qui est dit ne se fait plus proposer", () => {
  const a = app();
  actesEtRoutines(a);
  /* Noté pendant une prière, mais il a dit « donner » : la circonstance
     n'a plus rien à proposer, et sa fiche ne doit pas lui redemander. */
  a.f.node("n3").d = "donner";
  A.equal(a.f.acteDiscPropose(a.f.node("n3")), "",
    "il a tranché — l'application ne repropose pas par-dessus");
  A.equal(a.f.actesSansDisc().length, 0);
  a.S.view = "node"; a.S.nodeId = "n3";
  a.f.vNode();
  A.equal(a.Z.html.indexOf("La circonstance propose"), -1);
  A.match(a.Z.html, /Donner à Dieu/);
  /* Et le choix explicite de « aucune » ferme la question tout autant. */
  a.f.node("n3").d = "";
  A.equal(a.f.acteDiscPropose(a.f.node("n3")), "");
  a.f.vNode();
  A.match(a.Z.html, /Aucune routine/);
  A.equal(a.Z.html.indexOf("La circonstance propose"), -1);
  /* Le choix l'emporte aussi au moment de garder. */
  a.S.view = "note";
  a.S.draft = { act: "moi", gid: null, dest: "dieu", dgid: null, txt: "J'ai servi",
    desc: "", man: "", par: [], suj: [], pdt: "b1", d: "servir", etat: "fait",
    date: today8(), prec: "j", fige: false };
  a.actions.saveNote();
  const n = a.db.nodes[a.db.nodes.length - 1];
  A.equal(n.d, "servir", "et non la routine du bloc pendant lequel il notait");
});

/* ========================================================================
   13.es — l'importunité se compte à la main
   ======================================================================== */

/* Un sujet pour quelqu'un, et rien de frappé encore. */
function aFrapper(a) {
  ceuxQuAttendent(a);
  a.f.render = function () {};
  return a;
}
function frappe(a, sid, n) {
  for (let i = 0; i < (n || 1); i++) a.ctx.geste({ imp: sid });
}

test("13.es — le compteur ne bouge que par la tape, jamais par une séance", () => {
  const a = app();
  aFrapper(a);
  /* Deux séances nomment s3 : l'archive les voit, le compteur ne bouge pas. */
  a.db.temps.push(bloc("b4", "t1", jour(5, 7, 0), jour(5, 7, 20), { sj: ["s3"] }));
  A.ok(a.f.sujetFois("s3") >= 2, "les séances restent de l'histoire");
  A.equal(a.f.impFois("s3"), 0, "frapper est un acte, il ne se déduit pas");
  frappe(a, "s3");
  A.equal(a.f.impFois("s3"), 1);
  A.ok(a.f.sujetFois("s3") >= 2, "et la tape ne fabrique pas de séance en retour");
});

test("13.es — une tape est une fiche datée, et non un nombre dans le sujet", () => {
  const a = app();
  aFrapper(a);
  const avant = a.f.sujet("s1").maj;
  frappe(a, "s1", 3);
  A.equal(a.db.imps.length, 3, "trois fiches, pas un champ à 3");
  A.equal(a.db.imps.filter(x => x.s === "s1").length, 3);
  a.db.imps.forEach(x => {
    A.ok(x.id, "chaque fois a son identifiant, sinon la réunion en écrase");
    A.ok(x.ts > 0, "et son jour");
  });
  A.equal(a.f.sujet("s1").n, undefined, "le sujet ne porte toujours pas de compte");
  A.equal(a.f.sujet("s1").maj, avant,
    "une tape ne bouscule pas le sujet : sinon « depuis qu'il est écrit » dérive");
});

test("13.es — la plus ancienne tape est la date de première prière", () => {
  const a = app();
  aFrapper(a);
  /* s2 n'a jamais été nommé dans une séance : rien ne le date encore. */
  A.equal(a.f.sujetDepuis("s2"), null);
  frappe(a, "s2");
  const t = a.f.impPremier("s2");
  A.ok(t > 0);
  A.equal(a.f.sujetDepuis("s2"), t, "la colonne que son cahier a — sans l'avoir demandée");
  frappe(a, "s2");
  A.equal(a.f.sujetDepuis("s2"), t, "et la deuxième ne la remplace pas");
});

test("13.es — la première et la dernière fois ne se confondent pas", () => {
  const a = app();
  aFrapper(a);
  /* Deux tapes à cinq jours d'écart : deux tapes dans la même milliseconde
     se valent, et c'est ce qui avait laissé passer la confusion. */
  a.db.imps = [{ id: "i1", s: "s2", ts: jour(1, 9, 0), maj: 1 },
               { id: "i2", s: "s2", ts: jour(6, 9, 0), maj: 1 }];
  A.equal(a.f.impPremier("s2"), jour(1, 9, 0));
  A.equal(a.f.impDernier("s2"), jour(6, 9, 0));
  A.equal(a.f.sujetDepuis("s2"), jour(1, 9, 0), "la première prière est la plus ancienne");
  A.equal(a.f.sujetDernier("s2"), jour(6, 9, 0),
    "et l'attente se compte depuis la dernière — sinon l'écran accuse à tort");
  const x = Array.from(a.f.porteAttente()).filter(y => y.g.id === "g1")[0];
  A.equal(x.j, 2, "deux jours, et non sept");
});

test("13.es — deux appareils qui frappent additionnent leurs fois", () => {
  const a = app();
  const s = { id: "s1", txt: "Sa délivrance", g: "g1", maj: 1 };
  const A1 = a.f.sane({ sujets: [s], imps: [{ id: "i1", s: "s1", ts: 100, maj: 100 }] });
  const B1 = a.f.sane({ sujets: [s], imps: [{ id: "i2", s: "s1", ts: 200, maj: 200 }] });
  const out = a.f.fusionne(A1, B1);
  A.equal(out.imps.length, 2,
    "un nombre rangé dans le sujet aurait perdu la tape du second appareil");
});

test("13.es — la tape de trop se retire, et ne ressuscite pas", () => {
  const a = app();
  aFrapper(a);
  frappe(a, "s1", 2);
  const id = a.db.imps[1].id;
  a.ctx.geste({ impx: id });
  A.equal(a.f.impFois("s1"), 1, "un compteur qu'on ne peut pas reprendre n'en est pas un");
  A.ok(a.db.morts[id] > 0, "sans pierre tombale, la prochaine réunion la ramène");
  const B1 = a.f.sane({ imps: [{ id: id, s: "s1", ts: 100, maj: 100 }] });
  A.equal(a.f.fusionne(a.f.sane(a.db), B1).imps.length, 1);
});

test("13.es — retirer une fiche qui n'existe pas ne touche à rien", () => {
  const a = app();
  aFrapper(a);
  frappe(a, "s1");
  a.ctx.geste({ impx: "i-inconnu" });
  A.equal(a.f.impFois("s1"), 1);
  a.ctx.geste({ imp: "s-inconnu" });
  A.equal(a.db.imps.length, 1, "on ne frappe pas pour un sujet qui n'existe pas");
});

test("13.es — frapper, c'est aussi porter : la personne sort de l'attente", () => {
  const a = app();
  aFrapper(a);
  const avant = Array.from(a.f.porteAttente()).map(x => x.g.id);
  A.ok(avant.indexOf("g2") !== -1, "Toussaint attend depuis sa dernière séance");
  frappe(a, "s3");
  const apres = Array.from(a.f.porteAttente()).map(x => x.g.id);
  A.equal(apres.indexOf("g2"), -1,
    "il vient de demander pour lui : lui reprocher l'attente serait faux");
  A.ok(a.f.rappelPorte().indexOf("Toussaint") === -1);
});

test("13.es — le vœu se tient par les tapes, et se défait si on en retire une", () => {
  const a = app();
  aFrapper(a);
  a.f.sujet("s3").n = 2;
  frappe(a, "s3", 2);
  A.deepEqual(Array.from(a.f.sujetsTenus()).map(s => s.id), ["s3"]);
  a.ctx.geste({ sjvu: "s3" });
  A.equal(a.f.sujetsTenus().length, 0, "c'est lui qui le retire (P9)");
  /* Et s'il retire une tape, le vœu n'est plus tenu : il se redira. */
  a.ctx.geste({ impx: a.db.imps[0].id });
  A.equal(a.f.sujet("s3").vu, undefined);
  A.deepEqual(Array.from(a.f.sujetsTenus()).map(s => s.id), [],
    "une fois de moins que promis : le vœu n'est pas tenu, et ne se vante pas");
  frappe(a, "s3");
  A.deepEqual(Array.from(a.f.sujetsTenus()).map(s => s.id), ["s3"]);
});

test("13.es — le + est sur la fiche de la personne, là où il prie", () => {
  const a = app();
  aFrapper(a);
  a.S.porteG = "g1";
  a.f.vPorte();
  A.match(a.Z.html, /data-imp="s1"/);
  A.match(a.Z.html, /data-imp="s2"/);
  A.match(a.Z.html, /importunité/);
  /* La pastille est DANS le lien du sujet : c'est closest() qui tranche. */
  const i = a.Z.html.indexOf('data-sujo="s1"'), j = a.Z.html.indexOf('data-imp="s1"');
  A.ok(i !== -1 && j > i, "le + se trouve avant que le lien ne l'emporte");
  frappe(a, "s1", 4);
  a.f.vPorte();
  A.match(a.Z.html, /data-imp="s1">4/, "le compte se lit sur la pastille");
});

test("13.es — la fiche du sujet montre le compte, le bouton, et chaque fois", () => {
  const a = app();
  aFrapper(a);
  a.S.view = "sujet"; a.S.sujId = "s3";
  a.f.vSujet();
  A.match(a.Z.html, /<div class="impn">0<\/div>/);
  A.match(a.Z.html, /J'ai demandé une fois de plus/);
  A.match(a.Z.html, /data-imp="s3"/);
  A.equal(a.Z.html.indexOf("Chaque fois que tu as demandé"), -1, "rien à retirer encore");
  frappe(a, "s3", 2);
  a.f.vSujet();
  A.match(a.Z.html, /<div class="impn">2<\/div>/);
  A.match(a.Z.html, /sur 100 que tu t'es promis/);
  A.match(a.Z.html, /Chaque fois que tu as demandé/);
  A.equal((a.Z.html.match(/data-impx=/g) || []).length, 2, "chacune se retire");
});

test("13.es — au-delà de douze fois, la liste se replie et dit la première", () => {
  const a = app();
  aFrapper(a);
  a.S.view = "sujet"; a.S.sujId = "s3";
  frappe(a, "s3", 12);
  a.f.vSujet();
  A.equal((a.Z.html.match(/data-impx=/g) || []).length, 12, "douze tiennent encore");
  frappe(a, "s3");
  a.f.vSujet();
  A.equal((a.Z.html.match(/data-impx=/g) || []).length, 10);
  A.match(a.Z.html, /Et 3 autres/);
  A.match(a.Z.html, /La première, le/);
});

test("13.es — les séances ne s'appellent plus des « fois »", () => {
  const a = app();
  aFrapper(a);
  a.S.view = "sujet"; a.S.sujId = "s3";
  a.f.vSujet();
  A.match(a.Z.html, /Les séances où tu l'as nommé/);
  A.equal(a.Z.html.indexOf("Les fois où tu l'as nommé"), -1,
    "deux nombres distincts ne portent pas le même mot");
  A.match(a.f.sujetHist("s3"), /nommé le/, "sans tape, l'histoire est celle des séances");
  frappe(a, "s3");
  A.match(a.f.sujetHist("s3"), /Demandé 1 fois sur 100, depuis le/,
    "dès la première tape, c'est l'importunité qui parle");
});

test("13.es — sans engagement, le compte se dit seul", () => {
  const a = app();
  aFrapper(a);
  A.equal(a.f.impTxt(a.f.sujet("s1")), "Jamais demandé");
  A.equal(a.f.sujetCompte(a.f.sujet("s1")), "", "pas d'engagement, pas de « sur N »");
  frappe(a, "s1", 5);
  A.equal(a.f.impTxt(a.f.sujet("s1")), "Demandé 5 fois");
  A.equal(a.f.sujetReste(a.f.sujet("s1")), null);
  A.equal(a.f.sujetReste(a.f.sujet("s3")), 100);
});

/* ---------- 13.et — la promesse sur chaque sujet ---------- */

/* La colonne *référence biblique* de son cahier : la seule des six qui
   n'avait pas de contrepartie. Un seul attribut sur le sujet — ou bien un
   besoin de la liste, qui APPORTE ses versets, ou bien ses mots à lui. */
function aPromettre(a) {
  ceuxQuAttendent(a);
  a.f.render = function () {};
  return a;
}

test("13.et — un besoin choisi apporte ses versets, et l'archive n'en garde que le nom", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prch: "guerison" });
  const s = a.f.sujet("s1");
  A.equal(s.pr, "guerison", "un seul attribut, et c'est l'identifiant du besoin");
  A.equal(JSON.stringify(a.db).indexOf("gu\u00e9rit toutes tes maladies"), -1,
    "le texte du verset ne se range pas : rien de l'archive ne peut dériver de l'Écriture");
  const p = a.f.sujetProm(s);
  A.equal(p.id, "guerison");
  A.ok(p.v.length >= 2, "sa page range deux versets sous ce besoin, ils viennent ensemble");
  A.match(a.f.promRefs(p), /Psaume 103:3/);
  A.match(a.f.promRefs(p), /1 Pierre 2:24/);
});

test("13.et — ses mots détachent de la liste, et la liste détache ses mots", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prch: "guerison" });
  a.ecrit("prT", "Ésaïe 54:17");
  a.actions.prPose();
  const s = a.f.sujet("s1");
  A.equal(s.pr, "Ésaïe 54:17", "ses mots l'emportent");
  A.equal(a.f.promesse("Ésaïe 54:17"), null, "et ne prétendent pas être un besoin de la liste");
  const p = a.f.sujetProm(s);
  A.equal(p.libre, "Ésaïe 54:17");
  A.equal(p.v, undefined, "une demande s'appuie sur UNE parole, pas sur deux");
  A.equal(a.f.promTitre(p), "Ésaïe 54:17");
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prch: "ennemi" });
  A.equal(a.f.sujet("s1").pr, "ennemi", "et choisir dans la liste efface ses mots en retour");
});

test("13.et — un champ libre vide ne retire rien", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prch: "guerison" });
  a.ecrit("prT", "   ");
  a.actions.prPose();
  A.equal(a.f.sujet("s1").pr, "guerison",
    "un bouton « garder » qui efface serait un piège : c'est « retirer » qui retire");
});

test("13.et — rien n'est deviné à sa place", () => {
  const a = app();
  aPromettre(a);
  a.db.sujets.push({ id: "s9", txt: "Guérison", g: "g1", maj: jour(1, 9, 0) });
  A.equal(a.f.sujetProm(a.f.sujet("s9")), null,
    "le mot du sujet ressemble à un besoin : l'application ne pose pas le verset pour autant (P9)");
  A.equal(a.f.sujetRefs(a.f.sujet("s1")), "", "et un sujet sans promesse n'en affiche aucune");
});

test("13.et — ce qui est posé se retire, et la réunion ne le ressuscite pas", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prch: "guerison" });
  /* L'autre appareil, resté sur la promesse posée il y a huit jours. */
  const vieux = +jour(1, 9, 0);
  a.f.sujet("s1").maj = vieux;
  const A1 = JSON.parse(JSON.stringify(a.db));
  a.ctx.geste({ prx: "s1" });
  A.equal(a.f.sujet("s1").pr, undefined, "une promesse qu'on ne peut pas changer est une étiquette (13.cl)");
  A.ok(a.f.sujet("s1").maj > vieux, "le sujet a vraiment changé, la réunion doit le savoir");
  const B1 = JSON.parse(JSON.stringify(a.db));
  const out = a.f.fusionne(A1, B1);
  A.equal(out.sujets.filter(x => x.id === "s1")[0].pr, undefined,
    "l'appareil où l'on a retiré est le plus récent : la promesse ne revient pas (13.bd)");
});

test("13.et — la référence se lit là où il prie", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prch: "guerison" });
  A.equal(a.f.sujetRefs(a.f.sujet("s1")), "Psaume 103:3 · 1 Pierre 2:24");
  a.S.view = "porte"; a.S.porteG = "g1";
  a.f.vPorte();
  A.match(a.Z.html, /Psaume 103:3/, "sur la fiche de la personne, à côté du +");
  A.equal(a.Z.html.indexOf("guerison"), -1, "l'identifiant ne s'affiche jamais");
  a.S.view = "cahier"; a.S.sjF = "attente";
  a.f.vCahier();
  A.match(a.Z.html, /Psaume 103:3/, "et sur la ligne du cahier");
});

test("13.et — la fiche du sujet se lit dans l'ordre de la phrase d'Ében-Ézer", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prch: "besoins" });
  a.S.view = "sujet"; a.S.sujId = "s1";
  a.f.vSujet();
  const dit = a.Z.html.indexOf("Ce qu'Il avait dit");
  const fait = a.Z.html.indexOf("Ce qu'Il a fait");
  A.ok(dit > 0, "la promesse a sa place sur la fiche");
  A.ok(fait > dit, "ce qu'Il avait dit vient AVANT ce qu'Il a fait : sinon l'exaucement est un fait isolé");
  A.match(a.Z.html, /Philippiens 4:19/, "et le verset s'y lit en entier");
  A.match(a.Z.html, /pourvoira à tous vos besoins/);
  A.match(a.Z.html, /data-prom="s1"/, "avec une porte pour en changer");
});

test("13.et — sans promesse, la fiche propose et n'impose pas", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "sujet"; a.S.sujId = "s1";
  a.f.vSujet();
  A.match(a.Z.html, /Ce qu'Il avait dit/, "la colonne existe même vide, sinon on ne sait pas qu'elle existe");
  A.match(a.Z.html, /référence biblique/, "et elle se nomme comme dans son cahier");
  A.match(a.Z.html, /data-prom="s1"/);
});

test("13.et — l'écran des promesses est sa page, et il répond à une seule question", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "promesse"; a.S.sujId = "s3";
  a.ctx.geste({ prch: "repentance" });
  a.S.view = "promesse"; a.S.sujId = "s3"; a.S.prQ = "";
  a.f.vPromesse();
  A.match(a.Z.html, /Proverbes 30:5/, "l'en-tête de sa page");
  A.equal(a.Z.retour, true, "et une porte de sortie");
  a.c.PROMESSES.forEach(c => {
    A.ok(a.Z.html.indexOf(c.cat) !== -1, "le besoin « " + c.cat + " » manque à l'écran");
  });
  A.match(a.Z.html, /Demandez, et l'on vous donnera/, "les versets se lisent AVANT de choisir");
  A.match(a.Z.html, /data-prx="s3"/, "ce qui est posé se retire");
  A.match(a.Z.html, /data-act="prPose"/, "et le champ libre reste ouvert");
});

test("13.et — la liste est sa page, transcrite sans perte", () => {
  const a = app();
  const tous = [];
  a.c.PROMESSES.forEach(c => c.items.forEach(x => tous.push(x)));
  const ids = tous.map(x => x.id);
  A.equal(new Set(ids).size, ids.length, "deux besoins ne portent pas le même identifiant");
  tous.forEach(x => {
    A.ok(x.t && x.v.length, x.id + " : un besoin sans verset ne promet rien");
    x.v.forEach(v => {
      A.ok(/\d/.test(v[0]), x.id + " : une référence sans chapitre ne se retrouve pas");
      A.ok(v[1].length > 20, x.id + " : le verset est tronqué");
    });
  });
  /* Les quatorze besoins de la photo, avec les références qu'elle porte. */
  const photo = {
    demander: ["Luc 11:9", "Jean 16:23", "1 Jean 5:14"],
    entend: ["Psaume 34:16", "Jérémie 33:3"],
    anxiete: ["Philippiens 4:6-7", "Ésaïe 43:2"],
    fardeaux: ["1 Pierre 5:7"], besoins: ["Philippiens 4:19"],
    jeune: ["Jean 15:5"], volonte: ["Psaume 32:8"],
    guerison: ["Psaume 103:3", "1 Pierre 2:24"], sagesse: ["Jacques 1:5"],
    biens: ["Psaume 91:10"], ouvriers: ["Matthieu 9:38"],
    repentance: ["Actes 11:18"], salutames: ["2 Pierre 3:9"]
  };
  Object.keys(photo).forEach(k => {
    const x = a.f.promesse(k);
    A.ok(x, "le besoin " + k + " de sa page a disparu de la liste");
    A.deepEqual(Array.from(x.v).map(v => v[0]), photo[k],
      "les références de " + k + " ont dérivé de sa page");
  });
  /* Et la seule que la photo ne portait pas, coupée au bas de la colonne. */
  A.ok(a.f.promesse("trouble").v.length, "« Ne crains point en temps de trouble » a été complétée");
  A.ok(tous.length > 20, "la liste est prolongée au-delà de sa page");
});

test("13.et — la recherche porte sur le besoin ET sur le texte du verset", () => {
  const a = app();
  aPromettre(a);
  a.S.view = "promesse"; a.S.sujId = "s1"; a.S.prQ = "";
  a.f.vPromesse();
  const prn = [...a.Z.html.matchAll(/data-prn="([^"]*)"/g)].map(m => m[1]);
  A.equal(prn.length, a.c.PROMESSES.reduce((n, c) => n + c.items.length, 0),
    "chaque ligne porte de quoi être trouvée");
  A.ok(prn.some(x => x.indexOf("moisson") !== -1),
    "chercher un mot du verset doit suffire : il ne connaît pas toujours le nom du besoin");
  A.ok(prn.some(x => x.indexOf("guérison") !== -1), "et le nom du besoin aussi");
  A.ok(prn.every(x => x === x.toLowerCase()), "la recherche ignore la casse");
});

test("13.et — entrer sur l'écran ne perd pas le sujet", () => {
  const a = app();
  ceuxQuAttendent(a);
  a.S.view = "sujet"; a.S.sujId = "s1";
  a.ctx.geste({ prom: "s1" });
  A.equal(a.S.view, "promesse");
  A.equal(a.S.sujId, "s1", "une question posée SUR un sujet ne perd pas son sujet en route");
  A.equal(a.f.nomVue("promesse"), "Sur quelle promesse");
});

test("13.et — une promesse posée survit à la réunion de deux appareils", () => {
  /* Elle est un champ du sujet et non une fiche à part : la réunion remplace
     alors la fiche entière, et c'est le `maj` qui tranche. Poser une promesse
     sans toucher la fiche la ferait silencieusement écraser par la copie de
     l'autre appareil, restée sur l'ancien état (13.bd). */
  const vieux = +jour(1, 9, 0);
  for (const poser of ["liste", "ses mots"]) {
    const a = app();
    aPromettre(a);
    a.f.sujet("s1").maj = vieux;
    const autre = JSON.parse(JSON.stringify(a.db));   // l'appareil resté en arrière
    a.S.view = "promesse"; a.S.sujId = "s1";
    if (poser === "liste") a.ctx.geste({ prch: "guerison" });
    else { a.ecrit("prT", "Ésaïe 54:17"); a.actions.prPose(); }
    A.ok(a.f.sujet("s1").maj > vieux, poser + " : la fiche a changé, elle doit le dire");
    const ici = JSON.parse(JSON.stringify(a.db));
    [a.f.fusionne(autre, ici), a.f.fusionne(ici, autre)].forEach(out => {
      A.ok(out.sujets.filter(x => x.id === "s1")[0].pr,
        poser + " : la promesse a été perdue à la réunion");
    });
  }
});

/* ---------- 13.eu — l'échéance d'une demande ---------- */

/* « une retraite où je dois prêcher » : certaines demandes sont attachées à un
   jour que le monde a fixé. Le compteur comptait sans jamais décompter. */
function aEcheance(a) {
  ceuxQuAttendent(a);
  a.maintenant(j(10, 0));            /* le 8 novembre 2026, à dix heures */
  a.f.render = function () {};
  return a;
}
function poseEch(a, sid, date, n) {
  a.S.view = "sujet"; a.S.sujId = sid;
  a.ecrit("sjG", a.f.sujet(sid).g || "");
  a.ecrit("sjN", n === undefined ? (a.f.sujetBut(a.f.sujet(sid)) || "") : n);
  a.ecrit("sjE", date);
  a.actions.sjPour();
}

test("13.eu — le jour se range, le rebours se calcule", () => {
  const a = app();
  aEcheance(a);
  poseEch(a, "s1", "2026-11-14", 20);
  const s = a.f.sujet("s1");
  A.equal(s.ech, "2026-11-14", "un jour, sans heure");
  A.equal(a.f.echJours(s), 6, "six jours : c'est déduit, ce n'est pas rangé");
  A.equal(JSON.stringify(s).indexOf("6 jours"), -1, "rien de ce qui se calcule ne se range");
  A.equal(s.n, 20, "et l'engagement vit à côté, pas dedans");
});

test("13.eu — les mots du jour", () => {
  const a = app();
  aEcheance(a);
  const dis = (d) => { a.f.sujet("s1").ech = d; return a.f.echTxt(a.f.sujet("s1")); };
  const bref = (d) => { a.f.sujet("s1").ech = d; return a.f.echCourt(a.f.sujet("s1")); };
  A.match(dis("2026-11-08"), /^C'est aujourd'hui/);
  A.match(dis("2026-11-09"), /^C'est demain/);
  A.match(dis("2026-11-07"), /^C'était hier/);
  A.match(dis("2026-11-14"), /^Dans 6 jours, le 14 novembre/);
  A.match(dis("2026-11-03"), /^C'était il y a 5 jours, le 3 novembre/);
  A.equal(bref("2026-11-08"), "aujourd'hui");
  A.equal(bref("2026-11-09"), "demain");
  A.equal(bref("2026-11-07"), "hier");
  A.equal(bref("2026-11-14"), "dans 6 jours");
  A.equal(bref("2026-11-03"), "il y a 5 jours");
  delete a.f.sujet("s1").ech;
  A.equal(a.f.echJours(a.f.sujet("s1")), null, "la plupart des demandes n'ont pas de terme");
  A.equal(a.f.echTxt(a.f.sujet("s1")), "");
  A.equal(a.f.echCourt(a.f.sujet("s1")), "");
});

test("13.eu — l'échéance se retire, et une date qui n'en est pas ne se pose pas", () => {
  const a = app();
  aEcheance(a);
  poseEch(a, "s1", "2026-11-14", 20);
  const avant = a.f.sujet("s1").maj;
  a.f.sujet("s1").maj = +jour(1, 9, 0);
  poseEch(a, "s1", "", 20);
  A.equal(a.f.sujet("s1").ech, undefined,
    "une échéance qu'on ne peut pas défaire n'est pas une échéance (13.cl)");
  A.equal(a.f.sujet("s1").n, 20, "et retirer le jour ne touche pas à l'engagement");
  A.ok(a.f.sujet("s1").maj > +jour(1, 9, 0), "la fiche a changé, la réunion doit le savoir");
  poseEch(a, "s1", "samedi prochain", 20);
  A.equal(a.f.sujet("s1").ech, undefined, "« samedi prochain » n'est pas un jour");
});

test("13.eu — l'échéance survit à la réunion de deux appareils", () => {
  const a = app();
  aEcheance(a);
  const vieux = +jour(1, 9, 0);
  a.f.sujet("s1").maj = vieux;
  const autre = JSON.parse(JSON.stringify(a.db));
  poseEch(a, "s1", "2026-11-14", 20);
  const ici = JSON.parse(JSON.stringify(a.db));
  [a.f.fusionne(autre, ici), a.f.fusionne(ici, autre)].forEach(out => {
    A.equal(out.sujets.filter(x => x.id === "s1")[0].ech, "2026-11-14",
      "le jour posé ici a été perdu à la réunion (13.bd)");
  });
});

test("13.eu — l'écran d'ouverture dit ce qui arrive, et mène quelque part", () => {
  const a = app();
  aEcheance(a);
  poseEch(a, "s1", "2026-11-11", 20);
  frappe(a, "s1", 7);
  const h = a.f.rappelEch();
  A.match(h, /Ce qui arrive/);
  A.match(h, /Sa santé/);
  A.match(h, /dans 3 jours/);
  A.match(h, /demandé 7 fois sur 20/, "deux faits : le jour, et ce qu'il a déjà fait");
  A.match(h, /data-sujo="s1"/, "un chiffre qui amène quelque part n'est pas un reproche (13.cb)");
  /* Jamais une cadence imposée, jamais un seuil manqué. */
  [/retard/i, /il te reste/i, /par jour/i, /manqu/i, /devrais/i].forEach(r => {
    A.equal(r.test(h), false, "l'écran accuse : " + r);
  });
});

test("13.eu — la fenêtre se referme, et l'application se tait", () => {
  const a = app();
  aEcheance(a);
  const voit = (d) => { a.f.sujet("s1").ech = d; return a.f.echeances().length === 1; };
  A.equal(voit("2026-11-16"), false, "huit jours : trop loin, rien à annoncer");
  A.equal(voit("2026-11-15"), true, "sept jours avant : la fenêtre s'ouvre");
  A.equal(voit("2026-11-08"), true, "le jour même");
  A.equal(voit("2026-11-07"), true, "un jour après : c'est l'instant du mémorial");
  A.equal(voit("2026-11-06"), false, "au-delà, une échéance passée n'est pas une alarme");
  a.f.sujet("s1").ech = "2026-11-07";
  A.match(a.f.rappelEch(), /dis ce qu'Il a fait/, "le jour passé appelle le mémorial, pas un rappel");
  a.f.sujet("s1").ech = "2026-11-10";
  A.match(a.f.rappelEch(), /Le jour approche/);
  A.equal(a.f.rappelEch().indexOf("dis ce qu'Il a fait"), -1);
});

test("13.eu — un sujet exaucé quitte la liste", () => {
  const a = app();
  aEcheance(a);
  a.f.sujet("s1").ech = "2026-11-10";
  A.equal(a.f.echeances().length, 1);
  a.db.nodes = [{ id: "n9", act: "dieu", man: "pourvu", kind: "acte", txt: "Il l'a relevée",
                  par: [], suj: ["s1"], etat: "fait", date: "2026-11-09", prec: "j", ts: 1, maj: 1 }];
  A.equal(a.f.echeances().length, 0, "la réponse est venue : le jour n'a plus rien à annoncer");
  A.equal(a.f.rappelEch(), "");
});

test("13.eu — rangées par le jour le plus proche", () => {
  const a = app();
  aEcheance(a);
  a.f.sujet("s1").ech = "2026-11-13";
  a.f.sujet("s2").ech = "2026-11-09";
  a.f.sujet("s3").ech = "2026-11-07";
  A.deepEqual(Array.from(a.f.echeances()).map(x => x.id), ["s3", "s2", "s1"],
    "le plus proche en premier, et celui d'hier avant tous");
});

test("13.eu — la fiche dit les deux faits, et ne les divise pas l'un par l'autre", () => {
  const a = app();
  aEcheance(a);
  poseEch(a, "s1", "2026-11-10", 20);
  frappe(a, "s1", 7);
  a.S.view = "sujet"; a.S.sujId = "s1";
  a.f.vSujet();
  A.match(a.Z.html, /Dans 2 jours, le 10 novembre/, "le terme se lit sous le compteur");
  A.match(a.Z.html, /class="impn">7</, "le compteur reste le compteur");
  A.match(a.Z.html, /fois demandé sur 20 que tu t'es promis/, "et l'engagement reste entier");
  A.match(a.Z.html, /id="sjE"/, "le jour se pose ici");
  A.match(a.Z.html, /id="sjN"/, "du même geste que le nombre");
  [/il te reste/i, /par jour/i, /retard/i].forEach(r => {
    A.equal(r.test(a.Z.html), false, "une cadence imposée : " + r);
  });
});

test("13.eu — la ligne porte l'abrégé, là où il prie", () => {
  const a = app();
  aEcheance(a);
  a.f.sujet("s1").ech = "2026-11-10";
  a.S.view = "porte"; a.S.porteG = "g1";
  a.f.vPorte();
  A.match(a.Z.html, /dans 2 jours/, "sur la fiche de la personne");
  A.match(a.Z.html, /class="ech pres"/, "et marquée, parce que le jour approche");
  a.f.sujet("s1").ech = "2026-12-20";
  a.f.vPorte();
  A.match(a.Z.html, /dans 1 mois/, "un jour lointain se lit quand même");
  A.equal(/class="ech pres"/.test(a.Z.html), false, "mais sans être marqué");
  a.S.view = "cahier"; a.S.sjF = "attente";
  a.f.vCahier();
  A.match(a.Z.html, /dans 1 mois/, "et sur la ligne du cahier");
});

test("13.eu — sans échéance, l'application ne demande rien et ne dit rien", () => {
  const a = app();
  aEcheance(a);
  A.equal(a.f.echeances().length, 0);
  A.equal(a.f.rappelEch(), "", "aucune demande n'a de terme : l'écran se tait");
  a.S.view = "sujet"; a.S.sujId = "s1";
  a.f.vSujet();
  A.equal(/class="block (echbloc|echbloc pres)"/.test(a.Z.html), false,
    "et la fiche ne montre pas une ligne vide");
  A.match(a.Z.html, /pour compter sans fin/, "l'absence de terme est un état normal, pas un trou");
});

test("13.eu — ce qui arrive est bien sur l'écran d'ouverture, dans les deux cas", () => {
  /* vToday a deux branches : celle où quelque chose remonte, et celle où rien
     ne remonte. Un rappel posé dans l'une seulement est invisible un jour sur
     deux, et aucun test d'unité ne le verrait. */
  for (const avecCarte of [false, true]) {
    const a = app();
    aEcheance(a);
    /* Un acte de Dieu fait toujours remonter quelque chose ; un acte de lui,
       fait et ancien, ne remonte pas — c'est ainsi qu'on atteint l'autre
       branche, celle de « Rien ne revient aujourd'hui ». */
    a.db.nodes = avecCarte
      ? [{ id: "n1", act: "dieu", man: "parle", kind: "rhema", txt: "Je pourvoirai",
           par: [], suj: [], etat: "fait", date: "2026-11-07", prec: "j", ts: 1, maj: 1 }]
      : [{ id: "n1", act: "moi", dest: "dieu", kind: "acte", txt: "J'ai prié pour elle",
           par: [], suj: [], etat: "fait", date: "2025-01-02", prec: "j", ts: 1, maj: 1 }];
    a.f.sujet("s1").ech = "2026-11-11";
    a.S.pile = []; a.S.view = "today";
    a.f.VUES.today();
    A.equal(/Rien ne revient aujourd'hui/.test(String(a.Z.haut)), !avecCarte,
      "le test n'atteint pas la branche qu'il croit viser");
    A.match(String(a.Z.html), /Ce qui arrive/,
      (avecCarte ? "avec une carte" : "sans carte") + " : l'échéance ne s'affiche pas");
    A.match(String(a.Z.html), /dans 3 jours/);
  }
});

/* ---------- 13.ev — le cahier s'écrit ---------- */

/* Un sujet qui n'est pour personne ne s'écrivait qu'au sortir d'une prière
   pointée : le cahier était en lecture seule. Une porte qui n'existe que
   pendant un autre geste n'est pas une porte. */
function auCahier(a) {
  a.S.pile = []; a.S.view = "cahier"; a.S.sjF = "attente"; a.S.sjQ = "";
  a.f.vCahier();
  return String(a.Z.html || "");
}

test("13.ev — le cahier porte sa porte, plein comme vide", () => {
  const a = app();
  ceuxQuAttendent(a);
  const plein = auCahier(a);
  A.match(plein, /data-act="cahNeuf"/, "le cahier plein ne s'écrit pas");
  A.match(plein, /id="cahSj"/);
  /* 13.ek — l'écran s'ouvre sur ce qui existe, le clavier passe dessous. */
  A.ok(plein.indexOf("cahNeuf") > plein.lastIndexOf("data-sujo="),
    "le clavier est passé devant les tapes (13.ek)");
  a.db.sujets = []; a.db.temps = [];
  const vide = auCahier(a);
  A.match(vide, /data-act="cahNeuf"/,
    "c'est sur le cahier vide que la porte manque le plus : sans elle, le premier sujet est impossible");
  A.match(vide, /id="cahSj"/);
  A.match(vide, /viennent en priant/, "et le chemin le moins cher se dit toujours en premier");
});

test("13.ev — écrire crée le sujet et ouvre sa fiche", () => {
  const a = app();
  ceuxQuAttendent(a);
  const avant = a.db.sujets.length;
  a.S.view = "cahier";
  a.ecrit("cahSj", "  Que la Parole soit donnée   pour la retraite ");
  a.actions.cahNeuf();
  A.equal(a.db.sujets.length, avant + 1);
  const s = a.db.sujets[a.db.sujets.length - 1];
  A.equal(s.txt, "Que la Parole soit donnée pour la retraite", "les espaces en trop ne font pas un autre sujet");
  A.equal(s.g, undefined, "un sujet peut n'être pour personne — c'est tout le cas");
  A.equal(a.S.view, "sujet", "le texte seul ne sert à rien : la fiche s'ouvre");
  A.equal(a.S.sujId, s.id);
  A.match(String(a.stocke("ebenezer.v1")), /pour la retraite/,
    "un sujet gardé en mémoire seule disparaît au rechargement");
  /* Et c'est bien l'écran où la suite se pose. */
  a.f.vSujet();
  A.match(String(a.Z.html), /id="sjG"/, "pour qui");
  A.match(String(a.Z.html), /data-prom="/, "sur quelle parole");
  A.match(String(a.Z.html), /id="sjN"/, "combien de fois");
  A.match(String(a.Z.html), /id="sjE"/, "jusqu'à quand");
});

test("13.ev — un texte déjà écrit ouvre le sujet qui le porte", () => {
  const a = app();
  ceuxQuAttendent(a);
  const avant = a.db.sujets.length;
  a.S.view = "cahier";
  a.ecrit("cahSj", "sa SANTÉ");
  a.actions.cahNeuf();
  A.equal(a.db.sujets.length, avant, "on ne crée pas un doublon");
  A.equal(a.S.sujId, "s1", "on amène sur celui qui existe (13.ct)");
  A.equal(a.S.view, "sujet");
});

test("13.ev — le libellé se compare comme il s'affiche", () => {
  const a = app();
  ceuxQuAttendent(a);
  /* 13.ek — un sujet pris dans une liste relit son libellé de ce qu'il vise :
     son texte rangé n'est qu'un repli, et peut ne rien valoir. */
  a.db.sujets.push({ id: "s7", txt: "vieux repli", lie: "g3", maj: 1 });
  A.equal(a.f.sujetTxt("s7"), "Pour Hermine");
  const avant = a.db.sujets.length;
  a.S.view = "cahier";
  a.ecrit("cahSj", "Pour Hermine");
  a.actions.cahNeuf();
  A.equal(a.db.sujets.length, avant, "comparer le texte rangé aurait doublé ce qui est déjà à l'écran");
  A.equal(a.S.sujId, "s7");
  /* Et ce rapprochement-là est le seul filet : le texte rangé ne vaut rien
     ici, donc une casse ou un espace de travers créerait un vrai doublon. */
  a.S.pile = []; a.S.view = "cahier";
  a.ecrit("cahSj", "  pour   HERMINE  ");
  a.actions.cahNeuf();
  A.equal(a.db.sujets.length, avant, "« pour   HERMINE » et « Pour Hermine » sont le même sujet");
  A.equal(a.S.sujId, "s7");
});

test("13.ev — rien ne s'écrit de vide", () => {
  const a = app();
  ceuxQuAttendent(a);
  const avant = a.db.sujets.length;
  a.S.view = "cahier";
  a.ecrit("cahSj", "   ");
  a.actions.cahNeuf();
  A.equal(a.db.sujets.length, avant);
  A.equal(a.S.view, "cahier", "on reste où l'on est");
  A.match(a.dernierToast(), /Écris ce que tu demandes/,
    "un bouton qui ne fait rien et ne dit rien laisse croire à une panne");
});

test("13.ev — le champ du haut cherche, celui du bas écrit", () => {
  const a = app();
  ceuxQuAttendent(a);
  const h = auCahier(a);
  A.match(h, /id="sjQ"/, "la recherche est toujours là");
  A.ok(h.indexOf('id="sjQ"') < h.indexOf('id="cahSj"'), "et toujours en tête");
  A.equal(h.indexOf("sjNeuf"), -1,
    "le champ de recherche ne crée rien : deux ordres de choses, deux formes (13.cu)");
  /* Et taper dans la recherche ne fabrique aucun sujet. */
  const avant = a.db.sujets.length;
  a.S.sjQ = "un sujet qui n'existe pas";
  a.f.vCahier();
  A.equal(a.db.sujets.length, avant);
});

/* ---------------------------------------------------------------------------
   13.ew — « Ce qu'Il avait dit » comprend ce qu'Il t'a dit à toi.
   Sur son archive : dix-sept paroles reçues, aucune rattachée à un sujet.
   La colonne « référence biblique » n'avait que l'Écriture imprimée.
--------------------------------------------------------------------------- */
function aParler(a) {
  aPromettre(a);
  a.db.nodes = [
    { id: "n1", act: "dieu", kind: "rhema", man: "parle", ref: "",
      txt: "Je te donnerai le pays que tu traverses", desc: "", par: [], suj: [],
      etat: "fait", date: "2026-11-07", prec: "j", ts: 1, maj: 1 },
    { id: "n2", act: "dieu", kind: "ecriture", ref: "Ésaïe 54:17", man: "",
      txt: "Toute arme forgée contre toi sera sans effet", desc: "", par: [], suj: [],
      etat: "fait", date: "2026-11-06", prec: "j", ts: 1, maj: 1 },
    { id: "n3", act: "dieu", kind: "acte", man: "pourvu", ref: "",
      txt: "Il a ouvert la porte du logement", desc: "", par: [], suj: [],
      etat: "fait", date: "2026-11-05", prec: "j", ts: 1, maj: 1 },
    { id: "n4", act: "moi", kind: "acte", man: "", ref: "",
      txt: "J'ai jeûné trois jours", desc: "", par: [], suj: [],
      etat: "fait", date: "2026-11-04", prec: "j", ts: 1, maj: 1 }
  ];
  return a;
}
function poseParole(a, sid, nid) {
  a.S.view = "promesse"; a.S.sujId = sid;
  a.ctx.geste({ prdi: nid });
  return a.f.sujet(sid);
}

test("13.ew — une parole du mémorial se pose comme un besoin de la page", () => {
  const a = app();
  aParler(a);
  const s = poseParole(a, "s1", "n1");
  A.equal(s.pr, a.c.PR_N + "n1", "un seul attribut porte les trois formes");
  const p = a.f.sujetProm(s);
  A.equal(p.dite.id, "n1");
  A.equal(p.libre, undefined, "ce n'est pas du texte libre");
  A.equal(p.v, undefined, "et ce n'est pas un besoin du catalogue");
  A.equal(a.f.promTitre(p), "Je te donnerai le pays que tu traverses");
  A.equal(a.f.sujetRefs(s), "Sa parole du 7 novembre 2026",
    "la ligne du cahier dit que c'en est une : une date seule se lirait comme une échéance");
  A.match(a.dernierToast(), /Sa parole du 7 novembre/,
    "le toast dit ce qui a été gardé, pas un identifiant");
  A.match(String(a.stocke("ebenezer.v1")), /n:n1/,
    "et c'est écrit dans l'archive, pas seulement en mémoire");
});

test("13.ew — une Écriture gardée porte sa référence, pas son jour", () => {
  const a = app();
  aParler(a);
  const s = poseParole(a, "s1", "n2");
  A.equal(a.f.sujetRefs(s), "Ésaïe 54:17",
    "c'est la référence qu'il relit en priant, pas la date où il l'a notée");
});

test("13.ew — ce qu'Il a FAIT ne se pose pas comme ce qu'Il avait DIT", () => {
  const a = app();
  aParler(a);
  const s = poseParole(a, "s1", "n3");
  A.equal(s.pr, undefined,
    "un acte qui a pourvu a déjà sa colonne : la confusion effacerait la distance à mesurer");
  poseParole(a, "s1", "n4");
  A.equal(a.f.sujet("s1").pr, undefined, "et un acte de lui n'est pas une parole de Dieu");
  A.equal(a.f.promNode(a.c.PR_N + "n3"), null);
  A.equal(a.f.promNode(a.c.PR_N + "n4"), null);
  A.deepEqual(Array.from(a.f.parolesPosables()).map(n => n.id), ["n1", "n2"],
    "l'écran ne propose que ce qui est une parole");
});

test("13.ew — une parole effacée ne laisse pas d'étiquette", () => {
  const a = app();
  aParler(a);
  const s = poseParole(a, "s1", "n1");
  a.db.nodes = a.db.nodes.filter(n => n.id !== "n1");
  A.equal(a.f.sujetProm(a.f.sujet("s1")), null,
    "un identifiant orphelin affiché tel quel aurait l'air d'une parole");
  A.equal(a.f.sujetRefs(a.f.sujet("s1")), "");
  a.S.view = "cahier"; a.S.sjQ = ""; a.S.sjF = "tout";
  a.f.vCahier();
  A.equal(a.Z.html.indexOf(a.c.PR_N + "n1"), -1, "et rien de l'identifiant ne fuit à l'écran");
});

test("13.ew — une parole posée survit à la réunion de deux appareils", () => {
  const a = app();
  aParler(a);
  /* L'autre appareil, resté sur la fiche d'il y a huit jours. */
  const vieux = +jour(1, 9, 0);
  a.f.sujet("s1").maj = vieux;
  const A1 = JSON.parse(JSON.stringify(a.db));
  poseParole(a, "s1", "n1");
  A.ok(a.f.sujet("s1").maj > vieux,
    "sans touche(), la fiche restée en arrière l'emporterait et l'effacerait");
  const B1 = JSON.parse(JSON.stringify(a.db));
  const out = a.f.fusionne(A1, B1);
  A.equal(out.sujets.filter(x => x.id === "s1")[0].pr, a.c.PR_N + "n1",
    "après la réunion, la parole posée est toujours là (13.bd)");
});

test("13.ew — le lien se lit des deux côtés", () => {
  const a = app();
  aParler(a);
  poseParole(a, "s1", "n1");
  A.deepEqual(Array.from(a.f.sujetsSurParole("n1")).map(s => s.id), ["s1"]);
  A.equal(a.f.sujetsSurParole("n2").length, 0);
  a.S.view = "node"; a.S.nodeId = "n1";
  a.f.vNode();
  A.match(a.Z.html, /Ce que tu demandes là-dessus/,
    "sans ce chemin, la promesse posée serait invisible depuis le mémorial");
  A.match(a.Z.html, /data-sujo="s1"/, "et la ligne mène au sujet");
  A.ok(a.Z.html.indexOf("Ce que tu demandes là-dessus") < a.Z.html.indexOf("Ce qu'Il en a fait"),
    "l'écran se lit dans l'ordre de la phrase : ce que je demande, puis ce qu'Il en a fait");
});

test("13.ew — ses paroles sont en tête de l'écran, et la coche dit laquelle est posée", () => {
  const a = app();
  aParler(a);
  poseParole(a, "s1", "n1");
  a.S.view = "promesse"; a.S.sujId = "s1"; a.S.prQ = "";
  a.f.vPromesse();
  const h = a.Z.html;
  A.match(h, /Ce qu'Il t'a dit/);
  A.ok(h.indexOf("Ce qu'Il t'a dit") < h.indexOf(a.c.PROMESSES[0].cat),
    "les siennes passent devant la page rangée par besoin");
  A.match(h, /data-prdi="n1"/);
  A.match(h, /data-prdi="n2"/);
  A.equal(h.indexOf('data-prdi="n3"'), -1, "ce qu'Il a fait n'y est pas");
  const bout = h.slice(h.indexOf('data-prdi="n1"'), h.indexOf('data-prdi="n2"'));
  A.match(bout, /✓/, "la parole posée est cochée");
  const prn = [...h.matchAll(/data-prn="([^"]*)"/g)].map(m => m[1]);
  A.ok(prn.some(x => x.indexOf("le pays que tu traverses") !== -1),
    "la recherche couvre ses paroles comme elle couvre les versets");
});

test("13.ew — une archive sans parole n'ouvre pas une section vide", () => {
  const a = app();
  aPromettre(a);
  a.db.nodes = [];
  a.S.view = "promesse"; a.S.sujId = "s1"; a.S.prQ = "";
  a.f.vPromesse();
  A.equal(a.Z.html.indexOf("Ce qu'Il t'a dit"), -1);
  A.equal(a.Z.html.indexOf("data-prdi"), -1);
  A.match(a.Z.html, /Proverbes 30:5/, "et la page rangée par besoin est toujours là");
});

test("13.ew — les trois formes se chassent l'une l'autre, jamais deux à la fois", () => {
  const a = app();
  aParler(a);
  poseParole(a, "s1", "n1");
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prch: "guerison" });
  A.equal(a.f.sujet("s1").pr, "guerison", "un besoin de la page efface la parole");
  poseParole(a, "s1", "n1");
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ecrit("prT", "Ésaïe 41:10");
  a.actions.prPose();
  A.equal(a.f.sujet("s1").pr, "Ésaïe 41:10", "et ses mots aussi");
  A.equal(a.f.sujetProm(a.f.sujet("s1")).dite, undefined);
});

test("13.ew — ce qui est posé se retire", () => {
  const a = app();
  aParler(a);
  poseParole(a, "s1", "n1");
  a.S.view = "sujet"; a.S.sujId = "s1";
  a.ctx.geste({ prx: "s1" });
  A.equal(a.f.sujet("s1").pr, undefined);
  A.equal(a.f.sujetProm(a.f.sujet("s1")), null);
});

test("13.ew — la fiche du sujet donne la parole en entier et la porte vers le mémorial", () => {
  const a = app();
  aParler(a);
  poseParole(a, "s1", "n1");
  a.S.view = "sujet"; a.S.sujId = "s1";
  a.f.vSujet();
  const h = a.Z.html;
  A.match(h, /Je te donnerai le pays que tu traverses/, "elle se lit en entier, pas tronquée");
  A.match(h, /data-node="n1"/, "et la porte vers le mémorial reste ouverte");
  A.match(h, /data-prom="s1"/, "elle se change");
  A.ok(h.indexOf("Ce qu'Il avait dit") < h.indexOf("Ce qu'Il a fait"),
    "l'ordre de la phrase d'Ében-Ézer ne bouge pas");
});

test("13.ew — rien n'est deviné à sa place", () => {
  const a = app();
  aParler(a);
  A.equal(a.f.sujetProm(a.f.sujet("s1")), null,
    "une archive pleine de paroles n'en pose aucune : c'est lui qui sait sur quoi il s'appuie");
  a.S.view = "promesse"; a.S.sujId = "s1";
  a.ctx.geste({ prdi: "nX" });
  A.equal(a.f.sujet("s1").pr, undefined, "et un identifiant inconnu n'écrit rien");
});
