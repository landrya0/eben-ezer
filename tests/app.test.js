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
  A.equal(a.f.mesureProposee("priere"), "", "la prière ne se compte qu'en temps");

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
