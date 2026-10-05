# Tests de non-régression — TipTap v2 → v3

Cette suite garantit que la conversion HTML ⇄ JSON du transformer ne régresse pas lors de l'upgrade
TipTap v2 → v3 (ou de toute évolution future des extensions). Elle est structurée en 4 niveaux, du
plus rapide/précis au plus proche de la production.

| Niveau | Dossier | Ce qu'il vérifie | Nécessite Docker ? | Nécessite le réseau ? |
|---|---|---|---|---|
| Unitaire | `test/unit/` | Fidélité HTML⇄JSON de chaque extension, contre des références figées (`test/golden/`) | Non | Non |
| Intégration | `test/integration/` | Le contrat de l'API `/transform` tel qu'utilisé par `fr.wseduc.transformer` (web-utils) | Non | Non |
| Fumée / E2E | `test/smoke/` | La même vérification, mais contre une instance **réellement déployée** (Docker local ou recette) | Non (mais cible un serveur qui, lui, tourne dans Docker) | Oui |
| Docker (CI) | `docker-compose.yml` (services `tests` / `integration-tests`) | Que tout ce qui précède fonctionne aussi dans l'environnement de build réel (Node/Alpine propre, image de prod) | Oui | Non (réseau interne docker-compose) |

Commande rapide pour tout lancer en local pendant le développement : `pnpm test` (unitaire + intégration,
quelques secondes, aucune dépendance externe).

## Principe : comparaison "golden" v2 vs v3

Plutôt que de deviner à la main la forme exacte du JSON attendu pour chaque extension, on capture la
**sortie réelle du code v2 actuel** comme référence (`test/golden/`), puis on rejoue exactement la même
suite sur le code v3 : tout écart devient un test qui échoue, à trier consciemment (changement de schéma
accepté et documenté, ou vraie régression à corriger).

Chaque fichier `test/golden/<fixture>.json` contient :

```json
{
  "sourceHtml": "... le HTML d'entrée (contenu de la fixture) ...",
  "json": { "...": "le JSON produit par generateJSON(sourceHtml) au moment de la capture" },
  "htmlFromJson": "... le HTML produit par generateHTML(json) au moment de la capture ..."
}
```

Et pour chaque fixture, `test/unit/transform.spec.ts` vérifie trois choses avec le code **actuellement
présent dans `src/`** :

1. **`HTML source → JSON` == golden JSON** — un nouveau contenu se convertit toujours pareil.
2. **golden `JSON → HTML` == golden HTML** — **le test le plus important** : le JSON déjà stocké en base
   (produit hier, avec l'ancienne version) doit toujours se ré-afficher correctement aujourd'hui.
3. **`HTML → JSON → HTML → JSON` stable** — pas de perte ni d'instabilité au fil des ré-enregistrements.

Un 4ᵉ test (`fixture drift`) vérifie que le fichier HTML de la fixture n'a pas été modifié sans
re-capturer son golden (évite de tester silencieusement contre une référence obsolète).

## Fixtures couvertes

Chaque extension personnalisée réellement utilisée dans `EXTENSIONS`
([transformation-controller.ts](../src/controllers/transformation-controller.ts)) a sa fixture sous
`test/fixtures/<nom>/*.html` :

- **Contenu de base** : `core` (titres, gras, listes, citation...)
- **Extensions Edifice** : `hyperlink`, `linker`, `image`, `video`, `audio`, `iframe`, `attachments`,
  `information-pane`, `alert`, `mathjax`, `table` (+ couleur de fond de cellule), `font-size`,
  `line-height`, `highlight`, `text-align`
- **Contenu ancien format (`legacy/`)** : paragraphe `div[style]:has(> span)`, tableau "template"
  `.row/.column.cell`, alerte `p.info`/`div.warning`, cellule `td[style]` avec alignement, image "smiley"
- **`kitchen-sink/`** : un document combinant l'essentiel, comme test de fumée structurel global

> Une extension backend qui n'a pas de fixture ici n'est pas couverte — voir "Ajouter une fixture"
> ci-dessous avant d'ajouter une nouvelle extension à `EXTENSIONS`.

## Lancer les tests

```shell
pnpm test                  # unitaire + intégration (rapide, sans réseau ni Docker)
pnpm test:watch            # mode watch pour le développement
pnpm test:smoke            # contre une instance déployée (voir "Smoke tests" ci-dessous)
pnpm test:docker           # unitaire + intégration, dans un conteneur Node propre
pnpm test:integration:docker  # build + démarre le vrai conteneur de prod, teste dessus, puis nettoie
pnpm test:ci               # les deux commandes Docker ci-dessus, à la suite (ce que lance Jenkins)
```

### Smoke tests (`test/smoke/`)

Ces tests tapent une URL `/transform` réelle. Ils sont ignorés (`describe.skip`) si `TRANSFORMER_URL`
n'est pas défini — donc jamais exécutés par erreur en local.

```shell
# Contre l'environnement de recette (token à récupérer auprès de l'équipe infra)
TRANSFORMER_URL=https://recette-tiptap.ode.tools/transform \
TRANSFORMER_BASIC_AUTH="rec-tiptap:$TRANSFORMER_TOKEN" \
pnpm test:smoke

# Contre un conteneur lancé en local
docker compose up -d --build content-transformer
TRANSFORMER_URL=http://localhost:3000/transform pnpm test:smoke
```

`test:integration:docker` fait exactement ce deuxième cas, mais de façon automatisée et isolée
(voir `scripts/run-integration-docker-tests.sh` et le service `integration-tests` de
`docker-compose.yml`) : il construit et démarre `content-transformer`, attend `/healthcheck` via
`scripts/wait-for-http.ts`, lance `test:smoke` dessus via le réseau interne docker-compose, puis
détruit systématiquement la stack (même en cas d'échec).

## Ajouter une fixture (nouvelle extension ou nouveau cas)

> ⚠️ `pnpm test:golden:capture` capture avec le code **actuellement checké out** — sur ce
> dépôt, c'est la branche v3. Sans filtre, il régénère TOUS les goldens, écrasant la
> référence v2 que les fixtures existantes protègent. Pour une fixture neuve, toujours
> filtrer sur son propre chemin (étape 2 ci-dessous).

1. Créer `test/fixtures/<nom>/<cas>.html` avec un HTML représentatif de ce que doit parser l'extension
   (s'inspirer de sa règle `parseHTML` dans `@edifice.io/tiptap-extensions` ou dans `src/models/`).
2. Capturer uniquement sa référence : `pnpm test:golden:capture <nom>/<cas>` (le filtre matche sur
   un sous-chemin — vérifier dans la sortie qu'un seul fichier a été capturé).
3. `pnpm test` doit passer immédiatement (le golden vient d'être capturé avec le même code).
4. Committer la fixture HTML **et** son golden JSON ensemble.

## Faire évoluer une fixture existante / accepter un changement de schéma

Si un test échoue parce que le comportement a **intentionnellement** changé (ex. renommage d'un type de
nœud, nouvelle valeur par défaut d'un attribut) :

1. Vérifier l'impact sur le contenu déjà stocké en base (le test #2 — golden JSON → HTML — existe
   justement pour révéler ça). Si du contenu existant risque d'être mal affiché, en discuter avec les
   équipes consommatrices (blog, wiki...) avant de continuer : ça peut nécessiter une migration.
2. Re-capturer uniquement la ou les fixtures concernées, une fois le changement voulu et compris :
   `pnpm test:golden:capture <nom>/<cas>` (sans filtre, ça recapture tout avec le code courant —
   réservé au bootstrap initial des goldens depuis du vrai code v2, jamais à une évolution ciblée).
3. Committer le golden mis à jour avec un message de commit qui explique le changement de schéma —
   c'est la seule trace de "pourquoi ce golden a changé" pour la prochaine personne qui le lira.

Ne jamais mettre à jour un golden juste pour faire passer un test sans avoir compris le diff.

## CI (Jenkins)

Le `Jenkinsfile` exécute, avant le build/déploiement de l'image :

1. `docker compose run --rm --build tests` — unitaire + intégration dans le stage Docker `test`
   (mêmes dépendances/version de Node que la prod, indépendant de la machine de l'agent Jenkins).
2. `./scripts/run-integration-docker-tests.sh` — build + démarrage du vrai conteneur `content-transformer`,
   puis `test:smoke` dessus via le réseau docker-compose.

Le stage 2 échoue si l'image de production elle-même ne se construit pas : c'est voulu, ça bloque
le déploiement d'un build cassé (voir "État connu" ci-dessous pour l'historique de ce point).

## État connu (89 tests verts, 6 skippés documentés, build de production au vert)

Le paquet `@edifice.io/tiptap-extensions` a été republié compatible TipTap v3 sous le tag npm
`chore-tiptap-v3`, avec deux corrections faites à la source (`edifice-frontend-framework`,
`packages/extensions/package.json`) : un `^` oublié sur `@tiptap/extensions` qui tirait une
version plus récente que le reste du paquet (cause du conflit), et l'ensemble aligné sur la
dernière version stable `3.31.4` plutôt que l'ancienne `3.10.2` — qui dérivait de toute façon à
chaque nouveau patch de `@tiptap/starter-kit` (lui-même dépendant d'autres paquets `@tiptap/*`
en caret). Ce dépôt est aligné sur la même version. Résultat : plus aucun conflit de peer
dependency, aucun `any` ni `pnpm.overrides` nécessaire, `tsc`/`pnpm build` passent proprement.

Sept vraies régressions introduites par le portage v2→v3 ont par ailleurs été identifiées et
corrigées (toutes dans `src/controllers/transformation-controller.ts` / `src/models/`) :

1. `text-align` perdu sur les titres — `StarterKit` v3 embarque désormais un `heading` par défaut
   (absent en v2), qui coexistait avec le `CustomHeading` renommé en `customHeading`. Fixé en
   renommant `CustomHeading` en `'heading'` via `.extend({ name: 'heading' })` et en désactivant le
   `heading` de StarterKit — zéro changement de schéma vs v2, aucune migration nécessaire.
2. Même mécanisme pour `underline` (doublon) et `link` (volait la priorité à `Hyperlink`, produisant
   `type: "link"` au lieu de `"hyperlink"`) — désactivés via `StarterKit.configure({...})`.
3. `colgroup`/`min-width` disparus sur les tableaux — le portage v3 de `TableOrTemplate.renderHTML`
   ne délégait plus à `this.parent()` (le renderHTML par défaut de `Table`). Restauré pour les deux
   branches (table normale et "template" legacy).
4. `color`/`fontFamily`/`fontSize`/`lineHeight`/`backgroundColor` : `null` devenu `""` — bug réel dans
   `@tiptap/extension-text-style` v3 (et l'extension `LineHeight`/`TableCell` d'edifice) : leur
   `parseHTML` retombe sur `element.style.x`, qui vaut `""` (pas `undefined`) sous happy-dom pour une
   propriété CSS absente. Fixé via `.extend()` avec `getStyleProperty()` (voir
   `src/models/StyleCompat.ts`).
5. Style perdu sur les images "smiley" (ancien format) — `@tiptap/html` v2 rendait via **zeed-dom**
   (bibliothèque permissive qui acceptait un objet JS comme valeur de `style` et le sérialisait
   lui-même) ; v3 utilise **happy-dom** (DOM standard, qui ne le fait pas), confirmé en lisant le
   code source des deux paquets. Fixé en sérialisant l'objet en chaîne CSS nous-mêmes
   (`styleObjectToCss`, `src/models/StyleCompat.ts`).

6 tests de round-trip sont marqués `.skip()` (raison en commentaire sur chaque test, voir
`KNOWN_ROUND_TRIP_LIMITATIONS` dans `test/unit/transform.spec.ts`) : ce sont des limitations de
conception **préexistantes** (code source identique entre v2 et v3, vérifié directement), pas des
régressions — `mathjax` et le tableau "template" legacy ne sont pas censés round-trip par design
(leur `renderHTML` ne produit pas le format que leur propre `parseHTML` attend) ; `attachments` et
`legacy-table-cell-align` dépendent du schéma ProseMirror lui-même (paragraphe de fin inséré après
un nœud atomique, imbrication de `<p>` pour l'alignement) ; `kitchen-sink` cumule les deux premiers.

Le même changement de moteur zeed-dom → happy-dom (cf. correctif 5) explique aussi une poignée de
différences purement cosmétiques qui restent après les 7 fixes ci-dessus : `;` de fin dans les
`style="..."`, `controls="true"` au lieu de `controls`, apostrophe `'` au lieu de `&apos;`, et
`data-document-is-captation="false"` rendu explicitement au lieu d'être omis. Le JSON stocké est
strictement identique dans tous ces cas (vérifié) — seul le texte HTML diffère. Normalisées côté
test uniquement (`test/unit/normalize-html.ts`, appliqué symétriquement aux deux côtés de chaque
comparaison), sans toucher au code de production.

`pnpm test:golden:capture` sans filtre régénère tous les goldens avec le code **actuellement
checké out** (v3 sur ce dépôt) — voir l'avertissement dans "Ajouter une fixture" plus haut avant
de l'exécuter.
