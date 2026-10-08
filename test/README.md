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

1. Vérifier l'impact sur le contenu déjà stocké (le test #2 du "Principe" existe pour ça). Si du contenu
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
dépendances `@tiptap/*` sont désormais alignées sur `3.31.4` partout. Résultat : zéro conflit de peer
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

6 tests de round-trip sont `.skip()` (raison en commentaire dans `KNOWN_ROUND_TRIP_LIMITATIONS`,
`test/unit/transform.spec.ts`) : limitations de conception **préexistantes** (identiques en v2 et v3),
pas des régressions — `mathjax` et le tableau "template" legacy ne sont pas censés round-trip par
design ; `attachments` et `legacy-table-cell-align` dépendent du schéma ProseMirror lui-même.

Une poignée de diffs HTML purement cosmétiques subsistent (`;` de fin de style, `controls="true"` vs
`controls`, apostrophe `'` vs `&apos;`) : conséquence du même changement de moteur DOM, le JSON produit
est strictement identique. Normalisées côté test uniquement (`test/unit/normalize-html.ts`), sans
toucher au code de production.
