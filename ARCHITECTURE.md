# Ében-Ézer — la carte du code

## Pourquoi un seul fichier, jusqu'ici

Ce n'était pas la PWA. Une application web installable peut avoir autant de fichiers qu'elle veut.
C'était **zéro build** : pas de npm, pas de bundler, pas d'étape entre l'écriture et la mise en
ligne. `git push`, et c'est en ligne. Un seul fichier, c'était aussi une seule requête et un cache
atomique — une mise à jour ne pouvait jamais servir un mélange d'ancien et de neuf.

À 6 000 lignes, le prix a dépassé le bénéfice. On a donc découpé — **sans rien perdre de zéro
build**.

## Ce que c'est, et ce que ce n'est pas

`src/01-socle.js` … `src/13-gestes.js` sont des `<script>` **classiques**, chargés dans l'ordre par
`index.html`, dans **une seule portée globale**. Ce ne sont **pas des modules** : on ne les importe
pas, on les empile. C'est exactement le même programme qu'avant, écrit sur douze feuilles.

**L'ordre est porteur.** Les numéros ne sont pas décoratifs : une fonction déclarée dans le
fichier 09 n'existe pas encore pendant que le code racine du fichier 06 s'exécute. Déplacer une
balise dans `index.html` casse le démarrage. Et comme le code racine du **dernier** fichier appelle
`render()`, un nouveau fichier d'écrans se glisse **avant** lui — c'est pourquoi les gestes portent
le numéro le plus haut, et pourquoi chaque nouveau fichier d'écrans le repousse d'un cran :
`11-argent.js` a pris la place de `11-gestes.js`, puis `12-sondes.js` celle de `12-gestes.js`. **Le
numéro 11 est vide depuis v98** : c'est la place de l'argent, sorti de l'app et pas détruit — on ne
renumérote donc pas derrière lui, la place l'attend. Les
trois endroits qui tiennent cet ordre :
`index.html`, `sw.js` (la liste `APP`), et `tests/harnais.js` (qui relit l'ordre **dans**
`index.html`, pour que le harnais empile comme le navigateur et pas autrement).

## La carte

| fichier | ce qu'il tient | lignes |
|---|---|---|
| `01-socle.js` | constantes du socle, `VERSION`, le crochet des sondes, rangement sur l'appareil | 258 |
| `02-dates.js` | dire une date comme on la dit de vive voix | 94 |
| `03-temps.js` | **les blocs** : compter, couper, réunir, les creux | 362 |
| `04-medias.js` | ce qu'on joint à un acte | 247 |
| `05-acces.js` | lire l'archive : actes, gens, ce qui remonte | 220 |
| `06-charpente.js` | rail, barres, briques, menu, le nom des écrans — dessiner la page | 469 |
| `07-ecrans-actes.js` | les écrans du mémorial, et l'assistant qui note | 1231 |
| `08-sync.js` | la copie distante, la réunion de deux appareils | 467 |
| `09-ecrans-temps.js` | pointer, la frise, mon temps | 800 |
| `10-ecrans-reste.js` | temps mis à part, lectures, auteurs, sujets et promesses, réglages, dictée | 3100 |
| `12-sondes.js` | **les sondes** : ce que l'app coûte en gestes, et ce qu'elle refuse | 470 |
| `13-gestes.js` | le délégué — un seul écouteur — et le démarrage | 1507 |
| `src/ebenezer.css` | la feuille de style | 822 |

`index.html` ne tient plus que la charpente HTML et les treize balises : **70 lignes**.

**`outils/demo.js` n'est pas de l'application.** Il n'est chargé ni par `index.html` ni par la
liste `APP` de `sw.js`, et il n'entre jamais dans la page livrée : il s'injecte à la main dans le
volet navigateur pour dérouler une livraison devant le disciple — un curseur qu'on voit taper, un
bandeau qui dit l'étape. Voir AGENTS.md §4.

**Attention aux `url()` du CSS.** Elles se résolvent depuis `src/`, pas depuis la page : les
polices sont donc en `../vendor/…`. C'est le piège classique d'une feuille extraite.

## En vue de React Native

Ce qui compte pour la bascule, ce n'est pas le nombre de fichiers : c'est **ce qui ne touche ni au
DOM ni au HTML**. Cette partie-là se transporte telle quelle ; le reste meurt avec la page web.

- **Se transporte** — `02-dates.js`, `03-temps.js`, et la moitié modèle de `05-acces.js`,
  `08-sync.js`, `10-ecrans-reste.js`, et la moitié calcul de `12-sondes.js` :
  les règles, le calcul des parts, les chemins, les périodes, les postes et les sommes, la fusion
  de deux archives, le bilan des gestes. C'est ce que les 420 tests défendent, et ils n'ouvrent
  aucune page.
- **Meurt à la bascule** — `06-charpente.js`, les trois `ecrans-*.js`, l'écran de
  `12-sondes.js`, `13-gestes.js`, `ebenezer.css` : tout ce qui
  fabrique du HTML ou écoute un clic. Les trois crochets des sondes, eux, se reposent ailleurs :
  un geste, une parole, une écriture — il y en a dans toute application.

**L'étape suivante, quand la bascule commencera :** faire du noyau de vrais modules ES
(`export` / `import`), pour que le projet React Native les importe directement au lieu de les
recopier. Ce n'est pas fait ici, et c'est volontaire : de vrais modules demandent soit une étape
de build, soit d'écrire à la main les imports de 359 déclarations. Les deux se décident au moment
de la bascule, pas avant. La découpe d'aujourd'hui rend ce travail **mécanique** — les frontières
sont déjà tracées.

## La règle de livraison n'a pas changé, sauf un chemin

Chaque livraison bump **les deux** :

- `const CACHE = "ebenezer-vNN"` dans `sw.js`
- `const VERSION = "vNN"` dans **`src/01-socle.js`** — plus dans `index.html`

Et tout nouveau fichier de `src/` se déclare à **trois** endroits : `index.html`, la liste `APP` de
`sw.js`, et nulle part ailleurs — le harnais, lui, relit `index.html`.
