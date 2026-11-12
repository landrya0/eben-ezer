# Ében-Ézer — comment travailler ici

Ce fichier existe pour une raison : les reprises du disciple suivent presque toujours la même
poignée de formes. Les connaître d'avance évite de livrer deux fois.

---

## 1. Ce que c'est — ne jamais le rétrécir

Un **mémorial de la marche avec Dieu** : garder ce que Dieu a dit et ce qu'Il a fait, relier chaque
réponse à la recherche et à la promesse qui l'ont précédée.

Le compteur de temps n'est pas un suivi d'habitudes. Le disciple a donné sa raison : **le temps est
la preuve de ma reconnaissance** — pas sa mesure, sa preuve.

Et la visée longue, dans ses mots :

> « permettre de déduire automatiquement des actes, de liens entre actes et actions de Dieu […] on
> construit un outil plus intelligent et plus intentionnel avec un objectif de suivre les
> dynamiques dans la relation avec Dieu. pas juste un outil de compte rendu comme First Love. »

**Conséquence de travail :** toute donnée saisie doit être **structurée, pas libre**. Un champ
texte où une liste était possible ferme la porte à la déduction. C'est la raison d'être des
auteurs (13.cr), des routines (13.cn), des livres (13.ck).

**Ében-Ézer n'est pas Premier Amour.** Les seize routines de Bertoua sont communes aux deux, la
complexité ne l'est pas. *« je ne veux pas qu'on reprenne tout de suite la complexité de First
Love ici. »*

---

## 2. Sa façon de penser — les épreuves que ses reprises font passer

Avant de livrer, passer la chose à ces huit tests. La plupart de mes fautes en ont manqué un.

**a) « Un X qu'on ne peut pas Y n'est pas un X. »**
C'est la forme même de ses reprises. *Une fenêtre qu'on ne peut pas remonter n'est pas une fenêtre*
(13.cl). *Une fiche qu'on ne peut ni corriger ni réunir n'est pas une fiche* (13.ct). Il juge une
fonctionnalité **entière**, jamais sur son chemin heureux.
→ *Demander avant de livrer :* et quand c'est faux ? et quand on veut revenir ? et quand c'est
écrit deux fois ?

**b) La forme dit ce que la chose est.**
Deux ordres de choses ne portent jamais la même forme (13.cu). Un écran répond à une question
(13.cs). L'ordre des onglets suit le geste (13.bu).
→ Si deux réglages se ressemblent à l'œil mais ne font pas la même sorte de chose, la forme ment.

**c) Le dernier geste reste au disciple.**
L'app prépare, prévient, propose — elle n'envoie pas, ne coche pas, ne ferme pas, ne fusionne pas à
sa place (13.bc, 13.cf, 13.ct). Deux orthographes proches ne sont pas forcément deux fautes : un
père et son fils portent le même nom.

**d) On réunit, on ne supprime pas ; rien ne se perd.**
Deux appareils, une archive : on réunit (13.bd). Toute suppression laisse une pierre tombale, sinon
la synchro ressuscite (13.be). Une réunion ne perd jamais une minute (13.cf).

**e) Un chiffre faux est pire que pas de chiffre.**
« 0 min » d'un temps qui existe est un chiffre faux (13.ch). Ce qui est bref a eu lieu (13.ci). La
journée est l'union, jamais la somme (13.by). Et **un chiffre qui accuse doit mener quelque part**
(13.cb) : jamais un reproche sans porte.

**f) Faire simple : un seul attribut, les champs en découlent.**
13.cn. Jamais deux champs que le disciple doit tenir d'accord entre eux. Si j'en propose deux,
j'ai mal compris.

**g) Ce qu'on fait tous les jours doit coûter un geste.**
L'app demande ce qu'elle ne sait pas, et rien d'autre (13.cg). Une note se garde d'elle-même
(13.cd).

**h) Ce qu'une chose *est* n'est pas ce qu'elle *mesure*.**
La routine dit ce que c'est ; le support dit ce qui se compte (13.cq). Un enseignement suivi en
vidéo est de la littérature chrétienne et n'a pas de pages.

Et, transversal : **rien ne part en clair** (13.bh). Le journal nomme des frères et des sœurs.

---

## 3. Comment il corrige, et ce qu'il attend

- **Ses reprises sont courtes et obliques.** Il nomme *un* écran ; la décision vaut pour **toute**
  la fonctionnalité. En tirer les conséquences partout sans qu'il ait à les énumérer.
- **S'il revient sur une demande que j'ai écartée**, reprendre le **besoin**, pas le mécanisme
  qu'il propose.
- **S'il corrige ma lecture de sa vision**, retirer ma réserve franchement et l'écrire.
- **Il ne veut pas un panorama d'options.** Décider, faire, puis montrer — et dire ce qui reste
  ouvert.
- **Il relit la spec.** Ses mots y entrent **verbatim** dans la ligne de provenance de la règle.

---

## 4. La méthode

- **Avant de livrer, faire passer la batterie :**
  ```
  node --test "tests/*.test.js"
  ```
  Elle charge le **vrai** `index.html` dans un bac à sable — aucune copie du code à tenir à jour,
  aucune dépendance à installer. Chaque test porte le numéro de la règle qu'il défend. Un test qui
  casse renvoie d'abord à la spec : ou le code a dérivé, ou la règle a changé et le test change
  avec elle, **jamais en silence**.
- **Une correction de bug commence par un test qui échoue.** C'est ce qui prouve qu'on a bien
  trouvé la cause, et non un symptôme voisin.
- **Un test qui ne peut pas échouer ne défend rien.** Avant de le garder, casser exprès ce qu'il
  surveille et vérifier qu'il tombe. Deux des balayages ci-dessous ont été écrits faux du premier
  coup et passaient au vert sur du code cassé.
- **Le harnais a un DOM en carton** : `querySelector()` rend `null`, aucune boîte n'a de
  dimensions. Une mise en page cassée, un bouton Retour emporté avec la barre, un `data-…` absent
  du sélecteur du délégué : **invisibles pour toute la batterie**. Ces fautes-là ne se rattrapent
  pas écran par écran — elles se rattrapent par des **balayages** qui passent TOUS les écrans au
  même crible et découvrent la liste des écrans eux-mêmes, de sorte qu'un écran neuf y entre sans
  qu'on y pense. Il y en a **huit**, en fin de batterie : aucun écran ne jette ni n'est vide,
  tout `data-…` affiché est écouté, aucun écran hors onglets ne perd sa porte de sortie, aucun
  geste n'arrête un compteur sans le dire, la réunion de deux appareils n'en ferme aucun, tout ce
  que le rail affiche est écouté (le rail n'est pas un écran : aucun des cinq premiers ne le
  voyait), aucune ligne à retirer ne tait le bloc dont elle vient, et **tout `rappelX()` est appelé
  par un écran** — un rappel juste qu'on oublie de poser donne une fonctionnalité entière
  invisible, avec tous ses tests au vert, puisqu'ils appellent la fonction que l'écran n'appelle
  pas (13.eu : deux mutations avaient survécu, et c'était exactement ce trou).
  **Y ajouter un balayage plutôt qu'un test** chaque fois qu'une faute aurait pu se produire
  partout.
- **Une idée = une version**, vérifiée dans le navigateur (375 px) avant de passer à la suivante.
- **Et montrée.** Après chaque livraison, dérouler la nouveauté **dans le volet navigateur**, sur
  la version en ligne, écran par écran : il la voit faire au lieu de la lire. La vérification est
  pour moi ; la démo est pour lui, et ce n'est pas la même chose. Poser les données qu'il faut
  avec les **vrais gestes**, puis **nettoyer** (`db = sane({}); save(); soVide();`) — et vérifier
  `SY.actif === false` avant d'écrire quoi que ce soit.
  - **La démo ne démarre jamais d'elle-même.** `DEMO.porte({titre, n, jouer, nettoie})` pose une
    carte avec un bouton et **attend** ; le scénario — les données de mise en place comprises —
    ne tourne qu'à son clic, et l'archive n'est touchée qu'à ce moment-là. À la fin, la même
    carte revient avec *Rejouer* et *Effacer la démo*. *« si je ne suis pas devant l'écran ça
    tourne dans le vide »* : vérifier que le volet est ouvert (`get_layout`) ne suffisait pas —
    ouvert n'est pas regardé. Installer, prévenir, et le laisser ouvrir.
  - **Avec `outils/demo.js`** — injecté à la main dans le volet, chargé ni par `index.html` ni par
    `sw.js`. Piloter l'app par du code donne un écran qui change tout seul : on ne sait ni où l'on
    a touché, ni pourquoi. *« tu me démontre quoi ? je ne comprend même pas. »* L'outil ajoute les
    deux seules choses qui manquaient : un **curseur** qu'on voit se déplacer et taper
    (`DEMO.tape`, `DEMO.ecrit` — le vrai `click()` part sur le vrai élément, donc le délégué et
    les sondes travaillent), et un **bandeau de narration** qui dit à chaque étape ce qu'on
    regarde (`DEMO.dit(titre, phrase, cle)` ; `cle` marque en or les étapes qui SONT la
    nouveauté). `DEMO.montre(cible)` encadre sans toucher — indispensable quand la nouveauté est
    ce que l'app a fait **toute seule**, puisqu'il n'y a justement aucun geste à voir.
  - **Compter les étapes d'avance** (`DEMO.ouvre(n)`) : « Étape 7 / 13 » dit où l'on en est.
    Et commencer par une étape qui montre le point de départ vide — sinon on ne sait pas ce qui
    a changé.
- **Toute règle fonctionnelle s'écrit dans la spec au fur et à mesure** :
  `../SPEC-EBEN-EZER.md` — **hors dépôt, jamais commitée**. Une règle `13.xx` (les plus récentes
  en premier) **et** une entrée de journal datée. La règle dit *pourquoi*, pas *comment*.
- **Les commentaires du code portent la raison, pas la description**, et citent le numéro de règle.
- Le français partout : interface, commits, spec, conversation.

---

## 5. Le code

- **Lire `ARCHITECTURE.md` avant de toucher au code.** L'application est en douze fichiers
  `src/01-…` à `src/13-…` — le numéro 11 est vide depuis v98, c'est la place de l'argent sorti de
  l'app —, des `<script>` classiques chargés **dans l'ordre**, une seule portée globale. Ce ne sont pas des modules. L'ordre est porteur : une fonction du 09 n'existe pas
  encore pendant le code racine du 06. JS vanilla, aucun build, `localStorage` (`ebenezer.v1`),
  CSS de Framework7 9.3.0 seulement (vendored, allégé).
- **Chaque livraison bump les deux** : `const CACHE = "ebenezer-vNN"` dans `sw.js` **et**
  `const VERSION = "vNN"` dans **`src/01-socle.js`**. Sinon le service worker sert l'ancienne
  version.
- **Un nouveau fichier de `src/` se déclare à deux endroits** : `index.html` et la liste `APP` de
  `sw.js`. Le harnais de test, lui, relit l'ordre dans `index.html`.
- **Les `url()` du CSS se résolvent depuis `src/`**, pas depuis la page.
- **Vérifier qu'un nom de classe CSS est libre** dans `vendor/framework7-bundle.min.css` avant de
  l'employer. (`.fb` existait : les trois boutons se sont empilés au même point.) **Et vérifier
  aussi l'ÉLÉMENT**, pas seulement la classe : `button{width:100%}` y est posé sur la balise, et
  un `<button>` neuf dans le rail a pris les 375 pixels en écrasant le nom de l'activité.
- **Un nouveau tableau de données se câble à quatre endroits**, sinon il ne survit ni au
  rechargement ni à la synchro : le littéral `db`, `sane()`, la boucle `maj`, et `fusionne()`.
  Une suppression passe par `tue(id)` → `db.morts`.
- Déploiement : GitHub Pages. Attendre que `sw.js` serve bien la nouvelle version avant de le dire.
- Patches : heredoc `python3 - <<'PYEOF'` avec un `rep(old,new)` qui vérifie `count(old)==1`,
  écriture du fichier à la fin seulement. Puis `node --check src/*.js` — un fichier par fichier,
  sans rien extraire.

---

## 6. Fautes déjà commises — ne pas les refaire

- Deux champs couplés là où un seul suffisait.
- Importer un mécanisme de Premier Amour parce qu'il existait là-bas.
- Donner aux vues la forme d'un filtre : elles n'ont pas la même fonction.
- Conditionner les sections d'une vue mais oublier la phrase d'en-tête, qui fuit dans les autres.
- Replier une barre et retirer du même coup **la seule porte** vers un réglage (le cas « Tout »).
- Annoncer une version en ligne sans l'avoir vue servie.
- **Poser les données d'une démo à heure fixe.** « Le bloc de ce matin, 6 h 30 » n'est pas
  encore arrivé quand il ouvre la carte à **minuit six** : la journée ne compte rien, l'écran des
  routines se vide, et la démo s'arrête à l'étape suivante faute de porte. Même piège pour « dans
  deux jours » là où le scénario dit *samedi*. Tout ce qu'une démo pose se calcule **depuis
  l'instant** — elle doit tourner à n'importe quelle heure, et le lendemain aussi.
- **Choisir une définition sur son élégance sans la passer sur l'archive.** « La séance continue
  tant que rien d'autre n'est compté » ne demandait aucun seuil et semblait plus juste : elle ne
  se serait jamais formée dans le seul cas qui l'avait demandée, puisqu'une lecture de trois
  heures couvrait les trois creux. Une notion nouvelle se vérifie d'abord sur ses données à lui,
  et le cas réel devient un test — sinon on livre une règle qui ne se déclenche jamais.
