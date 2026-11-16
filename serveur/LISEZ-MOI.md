# Le réveil — ce qu'il reste à poser sur le serveur

La règle 13.ey est entière côté téléphone : l'application calcule l'heure,
pose le miroir, s'abonne, et le service worker sait parler. Il manque le
réveil lui-même — la machine qui, à l'heure dite, tape sur l'épaule de
l'appareil. Une page web ne tourne pas quand on la quitte : c'est la seule
pièce qui ne peut pas vivre dans le dépôt.

Quatre gestes, une fois pour toutes. Ils demandent ton compte Supabase : je
ne les fais pas à ta place.

## 1. La table

Dans **SQL Editor**, exécuter [`reveil.sql`](reveil.sql) — la table, et la
règle qui fait que toi seul écris ta ligne. (Le même bloc est déjà dans
l'application, écran Synchronisation, étape 1 : un nouveau projet l'obtient
avec le reste.)

## 2. La clé

La moitié publique est dans le code, et c'est sa place : elle ne sert qu'à
prouver que l'envoi vient de cette application. La moitié privée est dans
`CLE-REVEIL.txt`, **hors du dépôt**, à côté de la spec. Elle ne doit jamais
y entrer : tout ce dépôt est publié.

```bash
supabase secrets set VAPID_JWK="$(cat ../CLE-REVEIL.txt)" --project-ref oxuhnypkgvfaijzpgpqb
```

## 3. La fonction

```bash
supabase functions deploy reveil --project-ref oxuhnypkgvfaijzpgpqb
```

La CLI n'est pas installée sur cette machine : `brew install supabase/tap/supabase`,
puis `supabase login`. Sinon, le tableau de bord fait les deux — **Edge
Functions → Deploy a new function**, et **Project Settings → Edge Functions →
Secrets** pour la clé.

## 4. L'horloge

Toutes les cinq minutes. C'est la précision du réveil, et elle suffit : on
prévient d'une dérive de plusieurs heures, pas d'un rendez-vous. Le SQL est
au bas de `reveil.sql`, en commentaire — il attend la référence du projet et
ta clé `service_role`, qui reste dans ta base et n'en sort pas.

Le tableau de bord sait le faire aussi, et sans clé à recopier :
**Integrations → Cron → Create job**, et choisir la fonction `reveil`.

## Vérifier

Dans l'application, sur la carte d'un compteur qui dérape : « Me prévenir
même quand l'app est fermée ». Si la table manque encore, l'application le
dit au lieu de s'allumer pour rien — « Le réveil n'est pas encore posé sur
le serveur ».

Ensuite : lancer un compteur sur une activité dont le seuil est court,
fermer l'application, attendre. Réglages → Synchronisation → Le réveil
affiche l'heure du prochain.

## Ce que le serveur sait

Trois colonnes : une adresse de push opaque, à qui elle appartient, et une
heure. Le message part **vide** — pas de corps, donc rien à chiffrer, parce
qu'il n'y a rien. Celui qui lirait la table apprendrait que cet appareil
compte quelque chose, et jusqu'à quand il croit que c'est normal. Pas ce
qu'il compte. C'est le minimum qu'un réveil puisse savoir ; en deçà, il ne
peut plus sonner (13.bh, 13.ey).
