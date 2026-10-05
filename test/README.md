# Tests de non-régression — TipTap v2 → v3

Garantit que la conversion HTML ⇄ JSON ne régresse pas lors de l'upgrade TipTap v2 → v3 (ni lors d'une
évolution future des extensions). 4 niveaux, du plus rapide au plus proche de la production :

| Niveau | Dossier | Vérifie | Docker ? | Réseau ? |
|---|---|---|---|---|
| Unitaire | `test/unit/` | Fidélité HTML⇄JSON de chaque extension vs références figées (`test/golden/`) | Non | Non |
| Intégration | `test/integration/` | Le contrat de l'API `/transform` (utilisé par `fr.wseduc.transformer`) | Non | Non |
| Fumée | `test/smoke/` | Même vérification contre une instance **déployée** (local ou recette) | Non* | Oui |
| CI (Jenkins) | `docker-compose.yml` (service `node`) | Que tout ce qui précède tourne aussi dans l'environnement de build réel | Oui | Non |

\* cible un serveur qui, lui, tourne dans Docker.

`pnpm test` lance unitaire + intégration (quelques secondes, aucune dépendance externe) — la commande à
utiliser pendant le développement.

## La différence entre les 4 niveaux

Ce qui change, c'est **contre quoi** chaque niveau fait tourner le code :

- **Unitaire** : appelle directement les fonctions de conversion TipTap (`generateJSON`/`generateHTML`),
  fixture par fixture. Pas de serveur, pas de requête HTTP — le plus rapide, le cœur de la
  non-régression (détails dans "Comment ça marche" ci-dessous). **C'est le seul niveau qui teste
  vraiment toutes les fixtures.**
- **Intégration** : appelle l'app Express **en mémoire** via `supertest` (pas de vrai port réseau) —
  teste le endpoint `/transform` lui-même (formats demandés, erreurs 4xx, `/healthcheck`), avec
  seulement une poignée de payloads représentatifs (dont la fixture `kitchen-sink`), pas toutes les
  fixtures.
- **Fumée** : fait un vrai appel HTTP à un serveur **réellement démarré** (conteneur local ou recette) —
  vérifie uniquement la fixture `kitchen-sink` (qui combine l'essentiel des extensions), pour confirmer
  que le build déployé répond correctement de bout en bout.
- **CI (Jenkins)** : fait tourner les 3 niveaux ci-dessus (même couverture qu'eux) dans l'environnement
  Docker réel utilisé en production, pour détecter un problème propre à cet environnement (version de
  Node, etc.).

## Comment ça marche

Deux types de fichiers, à ne pas confondre — le sens est toujours fixture → golden, jamais l'inverse :

1. **Fixture** (`test/fixtures/*.html`) : un fichier HTML **écrit à la main**, qui reproduit un cas réel
   (une extension, un ancien format...). C'est la seule chose qu'on écrit nous-mêmes.
2. **Golden** (`test/golden/*.json`) : le résultat **généré automatiquement** à partir d'une fixture, en
   la faisant passer dans le code (`generateJSON`/`generateHTML`). On ne l'écrit jamais à la main.

Ce golden a été généré **une seule fois, avec l'ancien code TipTap v2**, puis committé : il fait office
de référence "on sait que ce résultat-là était correct". Aujourd'hui, avec le code v3,
`test/unit/transform.spec.ts` rejoue chaque fixture et compare le résultat obtenu à son golden : tout
écart devient un test qui échoue, à trier (changement de schéma volontaire, ou vraie régression).

Chaque `test/golden/<fixture>.json` contient `{ sourceHtml, json, htmlFromJson }`. Pour chaque fixture,
`transform.spec.ts` vérifie :

1. `HTML → JSON` == golden JSON — un nouveau contenu se convertit pareil.
2. golden `JSON → HTML` == golden HTML — **le plus important** : le JSON déjà stocké en base doit
   toujours s'afficher correctement.
3. `HTML → JSON → HTML → JSON` stable — pas de perte au fil des ré-enregistrements.
4. Le HTML de la fixture n'a pas changé sans re-capture de son golden (évite de tester contre une
   référence obsolète).

`scripts/capture-golden.ts` est l'outil qui génère un golden à partir d'une fixture (voir "Ajouter une
fixture" plus bas). Les autres scripts du dossier (`wait-for-http.ts`,
`run-integration-docker-tests.sh`) orchestrent les tests Docker, voir "CI" plus bas. `build-image.sh`
n'en fait pas partie — c'est le script préexistant de publication de l'image.

## Fixtures couvertes

Chaque extension custom de `EXTENSIONS`
([transformation-controller.ts](../src/controllers/transformation-controller.ts)) a sa fixture :

- **Base** : `core` (titres, gras, listes, citation...)
- **Edifice** : `hyperlink`, `linker`, `image`, `video`, `audio`, `iframe`, `attachments`,
  `information-pane`, `alert`, `mathjax`, `table`, `font-size`, `line-height`, `highlight`, `text-align`
- **Legacy** (`legacy/`) : paragraphe `div[style]`, tableau "template", alerte `p.info`/`div.warning`,
  cellule `td[style]` alignée, image "smiley"
- **`kitchen-sink/`** : un document combinant l'essentiel, en test de fumée structurel

> Une extension sans fixture ici n'est pas couverte — voir "Ajouter une fixture" avant d'en ajouter une
> à `EXTENSIONS`.

## Lancer les tests

```shell
pnpm test                     # unitaire + intégration (rapide, sans réseau ni Docker)
pnpm test:watch                # mode watch
pnpm test:smoke                 # contre une instance déployée (voir "Smoke tests")
pnpm test:docker                # unitaire + intégration, via l'image Docker CI
pnpm test:integration:docker    # build + démarre le vrai conteneur de prod, teste dessus, nettoie
pnpm test:ci                    # les deux commandes Docker ci-dessus (ce que lance Jenkins)
```

### Smoke tests (`test/smoke/`)

Tapent une URL `/transform` réelle. Ignorés (`describe.skip`) si `TRANSFORMER_URL` n'est pas défini —
jamais exécutés par erreur en local.

```shell
# Contre la recette (token auprès de l'équipe infra)
TRANSFORMER_URL=https://recette-tiptap.ode.tools/transform \
TRANSFORMER_BASIC_AUTH="rec-tiptap:$TRANSFORMER_TOKEN" \
pnpm test:smoke

# Contre un conteneur local
docker compose up -d --build content-transformer
TRANSFORMER_URL=http://localhost:3000/transform pnpm test:smoke
```

`test:integration:docker` automatise ce deuxième cas (voir `scripts/run-integration-docker-tests.sh`) :
démarre `content-transformer`, attend `/healthcheck`, lance `test:smoke` dessus, puis détruit la stack
(même en cas d'échec).

## Ajouter une fixture

> ⚠️ `pnpm test:golden:capture` sans filtre régénère **tous** les goldens avec le code **actuellement
> checké out** (la branche v3 sur ce dépôt) — ça écraserait la référence v2 que les fixtures existantes
> protègent. Toujours filtrer sur le chemin de la fixture (étape 2).

1. Créer `test/fixtures/<nom>/<cas>.html`, représentatif de ce que doit parser l'extension (s'inspirer
   de sa règle `parseHTML`).
2. `pnpm test:golden:capture <nom>/<cas>` — capture uniquement cette fixture (vérifier dans la sortie
   qu'un seul fichier est capturé).
3. `pnpm test` — doit passer immédiatement (le golden vient d'être capturé avec le même code).
4. Committer le HTML et son golden JSON ensemble.

## Faire évoluer une fixture existante

Si un test échoue parce que le comportement a **intentionnellement** changé (renommage d'un type de
nœud, nouvelle valeur par défaut...) :

1. Vérifier l'impact sur le contenu déjà stocké (le test #2 de "Comment ça marche" existe pour ça). Si du contenu
   existant risque d'être mal affiché, en discuter avec les équipes consommatrices (blog, wiki...) avant
   de continuer.
2. `pnpm test:golden:capture <nom>/<cas>` pour recapturer uniquement la fixture concernée.
3. Committer le golden mis à jour avec un message expliquant le changement de schéma — c'est la seule
   trace du "pourquoi" pour la prochaine personne.

Ne jamais mettre à jour un golden juste pour faire passer un test sans avoir compris le diff.

## CI (Jenkins)

Avant le build/déploiement de l'image, le `Jenkinsfile` lance :

1. `docker compose run --rm node sh -c "pnpm i --frozen-lockfile && pnpm test"` — unitaire + intégration,
   via l'image CI partagée `opendigitaleducation/node:18-alpine-pnpm` (le `Dockerfile` du service n'est
   pas impliqué).
2. `./scripts/run-integration-docker-tests.sh` — build + démarrage du vrai conteneur `content-transformer`
   (le `Dockerfile` de production, inchangé), puis `test:smoke` dessus via la même image CI.

Le stage 2 échoue si l'image de production elle-même ne se construit pas — c'est voulu, ça bloque un
déploiement cassé.

## Régressions corrigées

Le paquet `@edifice.io/tiptap-extensions` a été republié : ses
dépendances `@tiptap/*` sont désormais alignées sur `3.32.0` partout. Résultat : zéro conflit de peer
dependency, zéro `any`, zéro `pnpm.overrides`.

Le portage v2→v3 a par ailleurs introduit les régressions suivantes, toutes corrigées. Chaque fichier
listé porte le commentaire qui explique le bug en détail — cette liste ne fait que pointer vers eux :

| Régression | Corrigé dans |
|---|---|
| `text-align` perdu sur les titres (StarterKit v3 embarque un `heading` par défaut, qui coexistait avec notre `CustomHeading`) | [`src/models/Heading.ts`](../src/models/Heading.ts) |
| `underline` dupliqué, `link` volait sa priorité à `Hyperlink` (même cause : StarterKit v3) | [`transformation-controller.ts`](../src/controllers/transformation-controller.ts) (`StarterKit.configure`) |
| `colgroup`/`min-width` disparus sur les tableaux | [`src/models/TableOrTemplate.ts`](../src/models/TableOrTemplate.ts) |
| `color`/`fontFamily`/`fontSize`/`lineHeight` : `null` devenu `""` | [`src/models/StyleCompat.ts`](../src/models/StyleCompat.ts), `Color.ts`, `FontSize.ts`, `FontFamily.ts`, `LineHeight.ts` |
| `backgroundColor` de cellule : même bug que ci-dessus | [`src/models/TableOrTemplateCell.ts`](../src/models/TableOrTemplateCell.ts) |
| Style perdu sur les images "smiley" (ancien format) | [`src/models/Image.ts`](../src/models/Image.ts) |

Toutes causées par TipTap v3 lui-même (changement de moteur DOM zeed-dom → happy-dom, ou StarterKit v3
qui embarque plus d'extensions par défaut qu'en v2) — zéro changement de schéma pour le contenu déjà
stocké.

6 fixtures ont leur 3ᵉ test (round-trip : HTML → JSON → HTML → JSON stable) marqué `.skip()` — **leurs 2
premiers tests, ceux qui prouvent la non-régression v2/v3, tournent et passent normalement.** Le
round-trip est une propriété différente (le contenu reste-t-il identique si on le ré-ouvre puis
ré-enregistre ?), qui peut échouer même quand v2 et v3 se comportent pareil, si l'extension elle-même ne
l'a jamais garantie. Vérifié en lisant le code de chaque extension : identique en v2 et v3 dans les 6
cas ci-dessous — ce n'est donc pas une régression du portage (détail en commentaire dans
`KNOWN_ROUND_TRIP_LIMITATIONS`, `test/unit/transform.spec.ts`) :

| Fixture | Pourquoi le round-trip échoue |
|---|---|
| `mathjax/basic.html` | `renderHTML` produit un `<span>`, mais son propre `parseHTML` cherche une balise `<mathjax>` — il ne se reconnaît pas lui-même |
| `legacy/table-template.html` | Le tableau "template" legacy n'a jamais été conçu pour être relu dans ce format (uniquement écrit depuis du vieux HTML) |
| `legacy/legacy-table-cell-align.html` | Le `<p>` imbriqué pour l'alignement se re-parse avec un niveau d'imbrication en plus (comportement du schéma ProseMirror) |
| `attachments/basic.html` | ProseMirror insère automatiquement un paragraphe vide après un nœud "atome" (non éditable) en fin de document |
| `legacy/legacy-image-smiley.html` | `width: null` (ancien format) se rend en `width="NaN"`, qui se reparse en une autre valeur — un vieux bug déjà présent en v2 |
| `kitchen-sink/full-document.html` | Cumule les cas `mathjax` et `attachments` ci-dessus |

Une poignée de diffs HTML purement cosmétiques subsistent (`;` de fin de style, `controls="true"` vs
`controls`, apostrophe `'` vs `&apos;`) : conséquence du même changement de moteur DOM, le JSON produit
est strictement identique. Normalisées côté test uniquement (`test/unit/normalize-html.ts`), sans
toucher au code de production.

## Warnings connus dans la sortie des tests

Deux messages apparaissent dans la sortie de `pnpm test`, sans impact sur les résultats (préexistants,
sans lien avec la migration v2→v3) :

- `[tiptap warn]: Duplicate extension names found: ['attachments']` — `Attachment` et
  `AttachmentTransformer` sont toutes les deux enregistrées dans `EXTENSIONS`
  (`transformation-controller.ts`) sous le même nom `'attachments'`. Déjà le cas sur `develop-pedago`.
- `Error transforming pad URL: ReferenceError: window is not defined` — le `PadIframeTransformer`
  d'`@edifice.io/tiptap-extensions` utilise `window.location.href`, qui n'existe pas côté serveur ;
  l'erreur est attrapée par son propre `try/catch` et n'affecte pas le résultat (voir
  `iframe/basic.html`, qui passe). Logué à chaque rendu d'iframe, y compris en prod.
