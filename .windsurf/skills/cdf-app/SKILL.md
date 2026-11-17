---
description: Documentation complète de l'application CdF Terraforming Mars — frontend, API, règles de tournoi et déploiement
---

# CdF Terraforming Mars — Documentation complète de l'application

Application de gestion de tournois pour le **Championnat de France de Terraforming Mars (CdF)**.
Elle permet à des organisateurs (boutiques/associations) de créer et gérer des tournois
qualificatifs, aux joueurs de saisir leurs scores via QR code, et à l'admin de consolider
les qualifiés dans une Finale nationale.

## 1. Architecture générale

Deux dépôts actifs :

- **`workshop-cli`** — Frontend Next.js 16 (Turbopack), React 19, TailwindCSS 4, TypeScript.
  Déployé en standalone sur o2switch (`terraformingmars.fr`). Port 3000 en interne.
- **`workshop-api`** — Backend Express 4 + Prisma 5 + PostgreSQL.
  TypeScript compilé vers `dist/`. Port 4000 en interne. API publique :
  `api.terraformingmars.fr`. La base prod est sur le serveur o2switch
  (`127.0.0.1:5432`, inaccessible depuis l'extérieur).

- **`workshop-deploy`** — LEGACY : image Docker tout-en-un (nginx + supervisord)
  initialement déployée sur Render via GitHub Actions → GHCR. Conservée pour
  référence ; la prod actuelle n'utilise plus ce pipeline.

Déploiement actuel : voir §9 (tarball frontend + API Node sur o2switch).

## 2. Authentification et rôles

- **JWT** signé avec `JWT_SECRET`, durée 7 jours, stocké dans `localStorage("token")`.
- Quatre rôles :
  - `admin` — compte seedé, voit tout, réassigne les propriétaires, corrige les
    scores validés, marque des joueurs DNF, publie les classements de Finale.
  - `organizer` — compte créé via inscription, ne voit que SES tournois (`ownerId`).
  - `guest` — accès lecture seule : home = liste des tournois `en_cours` ouverts
    en vue streamer, plus `/stats`.
  - `streamer` — compte broadcast : home = finales `en_cours` uniquement
    (vue `/stream`), accès lecture seule à `/stats`. L'API refuse ses écritures
    (`POST /finale/add-players` → 403).
- `AuthProvider` (`src/lib/auth.tsx`) : `login`, `register`, `logout`, `fetchMe` au chargement.
- `AuthGate` (`AppShell.tsx`) redirige vers `/login` sauf pages publiques :
  `/login`, `/t/*` (landing joueur, `/stream`, `/suivre`, `/table/*`), `/chrono`.
- `/stats` est accessible aux rôles `admin`, `guest` et `streamer`.

## 3. Modèle de données (Prisma — `workshop-api/prisma/schema.prisma`)

- **User** : id, email (unique), password (bcrypt), name, role
  (`organizer`|`admin`|`guest`|`streamer`).
- **Tournament** : id, name, logoUrl?, eventDate (string), status (`brouillon`|`en_cours`|`fini`),
  format (`elimination`|`swiss`|`bracket`), size, currentRound, maxRounds,
  qualifiedCount, qualifiedIds (JSON string), ownerId → User.
  - `roundBoards` (JSON) — plateau (board) choisi par ronde.
  - `teams` (JSON `[{id,name,tag}]`) — rosters d'équipes, Finale uniquement.
  - `day2StartRound`, `day2ParticipantIds` (JSON `string[]`) — Finale 2 jours :
    première ronde du Jour 2 + top 32 reportés du Jour 1.
  - `day1ResultsPublished`, `day2ResultsPublished` (bool) — verrous de
    publication du classement de la ronde 3 de chaque jour (suspense Finale).
- **Participant** : id, firstname, name, pseudo?, email, phone, score (Float,
  points cumulés), dnf (bool), isDefendingChampion (bool — Finale : champion de
  l'année précédente, placé Table 1 ronde 1 Jour 1), teamId? (→ `Tournament.teams`),
  sourceTournamentId? (Finale : tournoi qualificatif d'origine), tournamentId.
- **Match** (= une table) : id, tournamentId, round, tableNumber, tableLabel?,
  participantIds (JSON string `(string|null)[]`), results (JSON `pid → points`),
  scorecards (JSON `pid → PlayerScore`), isPendingReview, isCompleted, isFinalist.
- **PlayerScore** (scorecard) : corporation, nt, objectifs, recompenses, forets,
  villes, cartes, megacredits (tiebreaker).

## 4. Cycle de vie d'un tournoi

1. **Brouillon** : création (nom, date, logo, joueurs). Check-in des joueurs présents
   (clic sur le joueur). Choix du format si ≥ 29 joueurs.
2. **En cours** : lancement → génération de la ronde 1. Les joueurs saisissent leurs
   scores via QR code → `isPendingReview` → l'organisateur valide → `isCompleted`.
   Quand toutes les tables de la ronde sont validées → bouton "Ronde suivante".
3. **Fini** : après la dernière ronde → calcul des qualifiés (`qualifiedIds`),
   export CSV possible, ajout des qualifiés à la Finale CdF.

## 5. Formats de tournoi (`src/lib/qualifier-rules.ts`)

Déterminés par le nombre de joueurs actifs (non-DNF) au lancement :

- **`elimination`** — 8 à 28 joueurs, 2 rondes. Ronde 1 : tables de **3-4
  uniquement** selon layouts fixes par taille (`ELIMINATION_LAYOUTS`, reconstruits
  sans tables de 5). Ronde 2 : layouts à jetons (`A1`, `B2`…) qui placent les
  gagnants de table + meilleurs seconds dans les tables `Finale` (`isFinalist`)
  et tout le reste en tables `Consolation`.
- **`swiss`** — 29+ joueurs, 3 rondes, format par défaut. Ronde 1 : tables de 4
  aléatoires. Rondes 2-3 : appariement suisse par score cumulé (tables de 4,
  ajustement 3/5 pour les restes — le cas table de 5 n'existe plus en pratique,
  évitement des rematchs).
- **`bracket`** — 29+ joueurs, 3 rondes, opt-in à la création (icône `mdiTournament`).
  Arbre d'élimination : Quarts → Demies → Finale. Tables de 4 en priorité, puis 3 ;
  un reste de 1 mod 4 devient **trois tables de 3** (ex. 33 → six 4 + trois 3),
  jamais de table de 5 (`getBracketTableSizes`). Les joueurs avancent selon leur
  rang à table (`crossBracketAdvancers` entrelace les qualifiés pour éviter les
  rematchs). Affichage par rang (1er, 2e…) — pas de points 5/3/2/1.

Règles communes : `getFormat(size)`, `getMaxRounds`, `getQualifiedCount(size)`
(nb de qualifiés pour la Finale selon la taille), `determineQualifiedPlayers`
(bracket : ronde la plus lointaine → points dernière table → score cumulé ;
elimination : gagnants des tables finales ; swiss : top par score total).

**Filet de sécurité ronde 2 élimination** : après résolution des jetons du layout,
tout joueur de ronde 1 non assis (table ajoutée à la main hors du layout officiel,
DNF ayant décalé le compte actif, etc.) est placé en Consolation — tables de 4
max, tables `Consolation N` supplémentaires si besoin. Aucun joueur actif ne peut
disparaître entre deux rondes. Si le lookup de layout échoue, tout le monde
tombe en Consolation plutôt que d'être perdu.

**Régénérer la ronde** (`/tournaments/[id]`, admin/owner) : bouton visible sur la
ronde courante tant qu'aucune table n'est validée ; masqué en ronde 1 et sur la
ronde d'ouverture du Jour 2. Reconstruit la ronde depuis ses sources (ronde 2
élimination ← tables de ronde 1, suisse ← re-siège par score, bracket ← reseed
depuis la ronde précédente), après confirmation (les saisies en attente sont
perdues). Sert à réparer une ronde déjà générée avec des joueurs manquants.

**Drag & drop** : en ronde active non validée, un joueur peut être déplacé vers
une autre table (3 min/5 max) **ou vers la carte "+ Nouvelle table"** qui
apparaît pendant le drag — crée une table numérotée à la suite, emporte sa
scorecard/résultat, supprime la table source vidée non validée.

### Finale CdF sur deux jours

- Jour 1 : 3 rondes suisses → top 32 (`day2ParticipantIds`) passe au Jour 2,
  scores remis à zéro ; Jour 2 : 3 rondes → fin de tournoi. `day2StartRound`
  marque la première ronde du Jour 2.
- Classement par équipe (`Tournament.teams` + `Participant.teamId`) : **Jour 1
  uniquement** — pas de classement/tags d'équipe au Jour 2.
- Le champion en titre (`isDefendingChampion`) est placé Table 1 à la ronde 1
  du Jour 1.
- **Suspense ronde 3** : tant que `day1ResultsPublished`/`day2ResultsPublished`
  est faux, seul l'admin voit les vrais résultats — spectateurs/joueurs voient
  l'ordre des sièges, NT et placements masqués, classement anonymisé, équipes
  rendues `Wild` + `Team ???`. L'admin publie par jour via « Publier le
  classement » ; republier/éditer après publication ne dépublie pas.
- Une Finale terminée affiche un **podium top 3** (pas de bloc « qualifiés » :
  les Finales n'ont pas de qualifiés — le principe a été supprimé).

## 6. Système de score

- **Scorecard joueur** (page mobile) : corporation + 6 catégories (NT, Objectifs,
  Récompenses, Forêts, Villes, Cartes) + mégacrédits (tiebreaker).
- **Total table** = somme des 6 catégories. Classement par total, égalité → mégacrédits.
- **Points de placement** : `[5,3,2,1]` (4-5 joueurs), `[5,3,2]` (3 joueurs).
  Bonus +1 pour les non-gagnants à ≤ 5 pts du gagnant. Recomputé côté admin dans
  `computePlacementPoints` (`SwissRounds.tsx`) lors de la correction de scorecards.
- **Classement général (swiss)** : points de placement cumulés → différence de
  tables → total NT.

## 7. Frontend — pages et composants (`workshop-cli/src`)

### Pages (`src/app`)

- **`/` (dashboard, `page.tsx`)** : liste des tournois de l'utilisateur. Finale épinglée
  en haut (carte plus sombre), puis tri par date décroissante. Création via bouton,
  suppression (propriétaire ou admin). **Filtre année** (dropdown sombre à gauche
  de « Créer un tournoi », `h-11`, coche sur l'année active) — année courante par
  défaut ; l'année de saison est lue dans le nom du tournoi d'abord
  (« Qualifier CdF 2027 » joué fin 2026 = saison 2027), `eventDate` en fallback.
  - Home **guest** : liste noire épurée des tournois `en_cours` uniquement →
    ouvre `/t/[id]/stream` + boutons Statistiques/Quitter.
  - Home **streamer** : finales `en_cours` uniquement → `/t/[id]/stream`.
- **`/login`** : connexion + inscription (name, email, password, ville optionnelle).
- **`/tournaments/new`** : création — nom, date, logo (upload ≤ 800 ko, base64),
  ajout de joueurs (firstname, name, email, phone obligatoires), recherche/filtre
  par tournoi d'origine, choix du format si ≥ 29 joueurs (swiss `Users` vs bracket
  `mdiTournament`). Boutons "Enregistrer brouillon" / "Lancer le tournoi".
- **`/tournaments/[id]`** (~1960 lignes, cœur de l'app) :
  - Brouillon : gestion joueurs (ajout/suppression, check-in par clic), choix du
    format, démarrage.
  - En cours : `SwissRounds` (rondes pliables, tables, drag & drop de joueurs entre
    tables non validées — min 3 / max 5, consolidation des tables vides),
    `BracketTreeView` pour le format bracket, QR code de la ronde active.
  - Validation des scores : table `isPendingReview` → "Valider" / "Modifier"
    (édition inline des scorecards) ; admin : "Corriger les scores" post-validation.
  - Liste joueurs : stats swiss (points, diff tables, NT), badge tournoi
    qualificatif pour la Finale, DNF (abandon, conserve les scores passés, retire
    des tables non validées, recalcule le format), édition des infos joueur.
  - Admin : édition tournoi (nom, date, logo, réassignation owner), suppression,
    régénération des rondes futures non complétées après retrait de joueur.
  - Fin de tournoi : calcul qualifiés (étoile jaune), export CSV, modal Finale CdF
    (cocher les qualifiés disponibles → `POST /finale/add-players`).
  - Auto-refresh : polling toutes les 10 s + au focus tant que `en_cours`.
  - Finale CdF : le nom/date sont dérivés de la **saison du qualificatif** — le
    tournoi « CdF Finale <année> » est créé/fusionné pour l'année lue dans le nom
    du qualificatif (pas de hardcode 2026). Modal « Ajouter les joueurs à la
    finale de la CdF » envoie `year` à l'API.
- **`/t/[tournamentId]`** (publique) : landing joueur via QR — infos tournoi, logos,
  ronde courante, recherche de sa table, lien vers la saisie des scores.
- **`/t/[tournamentId]/suivre`** (publique, spectateur) : vue lecture seule des
  rondes/résultats — les invités ne voient les scores qu'après validation admin
  des tables.
- **`/t/[tournamentId]/stream`** (vue broadcast, lecture seule) : fond canyon de
  Mars (`public/background.png`), overlays sombres, onglets **Classement /
  Rondes & Tables / Équipes / Statistiques** (le dernier réutilise
  `OverviewStats`). Paramètre `?stream=1` : masque tout le chrome pour OBS.
  Podium/grille d'équipes, flip des rosters, mouvement de rang + écarts, ligne
  de coupe Top 32, gestion des ex æquo de corporations, recherche joueur,
  épinglage joueurs/équipes, panneau détail joueur. Aucune saisie de score.
- **`/t/[tournamentId]/table/[tableId]`** (publique, mobile) : scorecard — sélection
  corporation (liste `CORPORATIONS`), saisie des 6 catégories + mégacrédits par
  joueur, calcul du total et du rang, soumission à `POST /api/public/.../table/...`.
- **`/stats`** (admin + guest + streamer) : statistiques du circuit réécrites —
  - **Filtre année** (dropdown à gauche du sélecteur, même style : année
    courante par défaut, saisons lues dans les noms, coche sur l'active) —
    scope les entrées ET la grille du sélecteur de tournoi ; un lien profond
    `?tournament=<id>` vers une autre saison ajuste l'année automatiquement.
  - Sélecteur de tournoi en grille d'emblèmes (logos), noms raccourcis
    `shortTournamentName` → `Q<aa> - <ville>` (année du nom prioritaire).
  - `OverviewStats` (`React.memo`) : cartes récap (tables validées, scorecards,
    meilleur score, plateau le plus joué), barres plateaux/corporations,
    distribution des scores, top joueurs % victoire, grande table **Joueurs /
    Corporations** à bascule (colonnes triables au choix, heatmap, drawer
    détail joueur), section « Comparer des corporations » (`CorpCompare`,
    2-3 corps côte à côte).
- **`/chrono`** : chronomètre plein écran (presets par phase : choix corporations,
  rondes, finale), compte à rebours ou incrémental, drift-free en arrière-plan.

### Composants et lib (`src/components`, `src/lib`)

- `AppShell.tsx` : shell + sidebar (dashboard, stats, chrono), AuthGate, modal Aide
  (contact développeur), infos utilisateur.
- `SwissRounds.tsx` : rendu des rondes/tables, drag & drop, édition inline des
  scorecards, `computePlacementPoints`.
- `BracketTreeView.tsx` : arbre visuel Quarts → Demies → Finale, joueurs par rang
  de table, flèches de progression, qualifiés surlignés.
- `QRCodeModal.tsx` : QR code vers `/t/[id]`, impression A4.
- `lib/types.ts` : `TournamentFormat`, `TournamentStatus`, `Participant`,
  `PlayerScore`, `TableMatch`, `Tournament`.
- `lib/store.ts` : hook `useTournaments` — fetch, add/update/delete avec updates
  optimistes vers `NEXT_PUBLIC_API_URL` (défaut `http://localhost:4000`).
- `lib/auth.tsx` : `AuthProvider`/`useAuth` (JWT localStorage, `fetchMe`).
- `lib/qualifier-rules.ts` : toute la logique de formats, tables, génération de
  rondes, détermination des qualifiés.

## 8. API (`workshop-api/src`)

Express + Prisma. Entrée `src/index.ts` : CORS (`FRONTEND_URL` ou `true`,
credentials), `express.json({ limit: "5mb" })` (logos base64), routes montées sous
`/api`, health check `GET /api/health`. Middleware `src/middleware/auth.ts` :
`authenticate` (Bearer JWT → `req.user`) et `requireAdmin`.

### `routes/auth.ts` — `/api/auth`

- `POST /register` : name/email/password (+city ignoré) → hash bcrypt, rôle organizer, JWT.
- `POST /login` : vérif bcrypt → JWT 7 jours + user.
- `GET /me` (auth) : profil courant.
- `GET /organizers` (admin) : liste des organisateurs (pour réassignation).

### `routes/tournaments.ts` — `/api/tournaments` (auth)

- `GET /` : tournois du user (admin : tous), formatés via `formatTournament`
  (parse JSON participantIds/results/scorecards/qualifiedIds de façon sûre).
- `GET /:id` : détail (owner ou admin).
- `POST /` : création avec participants + matches initiaux (transaction).
- `PUT /:id` : update complet — sync participants (add/update/delete, protection
  contre la suppression si tableau vide envoyé), sync matches, status/format/
  currentRound/qualifiedIds, `ownerId` (admin seul). Transactions + parsing JSON
  défensif pour éviter la corruption.
- `DELETE /:id` : owner ou admin (cascade participants/matches).
- `POST /finale/add-players` : un organizer ajoute ses qualifiés disponibles au
  brouillon « CdF Finale <année> » (le `year` du body est validé en 4 chiffres —
  fallback « CdF Finale 2026 » si absent/invalide) ; fusion dédup par email,
  `sourceTournamentId` persisté par participant, 403 pour les streamers.

### `routes/matches.ts` — `/api/tournaments` (auth)

- `PUT /:tournamentId/matches/:matchId` : mise à jour d'une table (results,
  scorecards, isCompleted, isPendingReview, participantIds) — owner ou admin.

### `routes/public.ts` — `/api/public` (sans auth)

- `GET /tournaments/:id` : données publiques du tournoi (pages `/t/*`).
- `POST /tournaments/:id/table/:tableId` : soumission scorecard joueur →
  calcule les points de placement, écrit results + scorecards,
  `isPendingReview = true`. Endpoint ouvert (le verrou par token QR
  `scoreAccessToken` a été implémenté puis complètement reverté — saisie
  publique, filet = validation admin obligatoire).
- `GET /stats` : toutes les scorecards + métadonnées (filtrage côté client) ;
  `?meta=1` renvoie les métadonnées seules (tournois pour les sélecteurs/home
  guest-streamer). Les entrées portent `tournamentId`, `tournamentName`,
  `eventDate`, `board`, `nt`, `objectifs`, `recompenses`, `logoUrl`.

## 9. Déploiement

### Production actuelle — o2switch (terraformingmars.fr)

- **Frontend** : build standalone packagé en `~/Desktop/frontend-build.tar.gz`
  (procédure détaillée : skill `deploy-frontend`). Points critiques :
  - **`NEXT_PUBLIC_API_URL=https://api.terraformingmars.fr` au build** — c'est
    baké dans le bundle ; un build sans cette variable retombe sur
    `localhost:4000` et le site en prod affiche « aucune donnée » (le navigateur
    interroge l'API locale du visiteur).
  - Copier `.next/static` → `standalone/.next/static` et `public` →
    `standalone/public` **en repartant d'un standalone frais** (un `cp -r` sur
    un dossier existant imbrique des doublons type `static/static/`).
  - Le tarball contient `server.js` + `node_modules` (dont sharp) + assets.
- **API** : Node sur o2switch, base PostgreSQL locale au serveur
  (`127.0.0.1:5432`). Après un changement de schéma : `prisma migrate deploy`
  **avant** de redémarrer l'API (sinon Prisma casse sur les colonnes
  manquantes). Ordre de déploiement : migration → nouveau code API.
- **Pas de proxy same-origin** : le front appelle `api.terraformingmars.fr`
  directement (CORS ouvert côté API).

### Legacy — `workshop-deploy` (Render, conservé pour référence)

- **`Dockerfile` multi-stage** : (1) clone + build API (`npm ci`, `prisma generate`,
  `tsc`) ; (2) clone + build frontend (`NEXT_PUBLIC_API_URL` en build-arg, output
  standalone) ; (3) image finale node:20-slim + nginx + supervisor + openssl.
  `ARG CACHEBUST` force un clone frais (bumpé par le CI avec `github.run_id`).
- **`start.sh`** : `PORT` (défaut 8080) → sed `PORT_PLACEHOLDER` dans nginx.conf →
  `prisma migrate deploy` → `prisma generate` → `seed.js` (admin `admin@cdf.com`,
  mot de passe via `ADMIN_PASSWORD`) → `supervisord`.
- **`supervisord.conf`** : 3 programmes — api (`node dist/index.js`, env
  DATABASE_URL/JWT_SECRET/PORT=4000), frontend (`server.js` standalone, PORT=3000),
  nginx.
- **`nginx.conf`** : template — `/api/` → 127.0.0.1:4000, `/` → 127.0.0.1:3000,
  headers proxy + websockets, `client_max_body_size 5m`.
- **`render.yaml`** : blueprint Render (service docker `workshop-app`, JWT_SECRET
  généré, DATABASE_URL manuel — Supabase PostgreSQL).
- **`.github/workflows/build-and-deploy.yml`** : push ou `repository_dispatch`
  (`submodule-update`) → build+push `ghcr.io/.../workshop-deploy:{latest,sha}` →
  curl `RENDER_DEPLOY_HOOK`.
- **`docker-compose.yml`** : dev local legacy (api:4000 + frontend:3000, SQLite
  `file:/app/data/prod.db`) — ne reflète plus la prod PostgreSQL.
- **Env** : `DATABASE_URL` (PostgreSQL/Supabase), `JWT_SECRET`, `FRONTEND_URL`
  (CORS), `NEXT_PUBLIC_API_URL` (vide en prod = même origine via nginx),
  `ADMIN_PASSWORD`, `PORT`.
- Historique : migration SQLite → PostgreSQL/Supabase → PostgreSQL o2switch
  (binaryTargets `rhel-openssl-3.0.x` conservés dans le schéma Prisma).

## 10. Historique fonctionnel (depuis la création)

Ordre chronologique des évolutions majeures (git log) :

1. **Socle** : app Next.js + API Express/Prisma (SQLite puis PostgreSQL), auth JWT,
   CRUD tournois, branding CdF + police Prototype.
2. **Tournois sans joueurs** à la création ; participants firstname/name/email/
   phone obligatoires.
3. **Robustesse API** : transactions, parsing JSON sûr, protection anti-corruption
   (tableau participants vide), fix schéma email/phone.
4. **Finale CdF** : nom fixe "CdF Finale 2026", logo CDF, date 2026-11-14, fusion
   dans le brouillon existant, endpoint `finale/add-players` pour les organizers,
   `sourceTournamentId` + badge/logo du tournoi qualificatif, auto-backfill.
5. **Qualifiés** : détermination robuste (exclusion DNF, fallback top scorers),
   auto-heal des tournois finis sans `qualifiedIds`.
6. **Gestion en cours** : DNF au lieu de suppression, drag & drop entre tables
   (3 min/5 max), consolidation tables vides, régénération des rondes futures,
   retrait de joueur mid-tournament avec recalcul du format.
7. **Scores** : scorecard mobile par QR (corporation + 6 catégories + MC
   tiebreaker), validation organisateur, édition inline, correction admin,
   impression A4 du QR.
8. **UX** : polling 10 s, check-in brouillon, stats joueurs (points/diff/NT),
   ordre de classement points → diff → NT, pages publiques dual-logo.
9. **Stats admin** : page `/stats` (leaderboard + corporations, filtres).
10. **Chrono** : page `/chrono` plein écran avec presets.
11. **Admin** : édition tournoi (nom/date/logo/réassignation owner), édition
    joueur à tout stade, suppression par owner, modal Aide/contact.
12. **Format bracket** : 3e format opt-in ≥ 29 joueurs, arbre
    Quarts/Demies/Finale, affichage par rang sans points,
    `BracketTreeView`, choix du format à la création et en brouillon.
13. **Finale deux jours + équipes** : Day 1 (3 rondes) → top 32 → Day 2 (3
    rondes), reset des scores, `day2StartRound`/`day2ParticipantIds` ;
    rosters `Tournament.teams` + `Participant.teamId`, classement équipe
    Jour 1 uniquement ; champion en titre `isDefendingChampion` placé Table 1 ;
    suspense de publication (`day1/day2ResultsPublished`), podium top 3 en fin
    de Finale (plus de notion de « qualifiés » en Finale).
14. **Rôles guest + streamer** : home guest = tournois `en_cours` → vue
    `/t/[id]/stream` ; home streamer = finales `en_cours` ; `/stats` ouvert
    aux deux rôles ; spectateurs `/t/[id]/suivre` (lecture seule, scores
    visibles après validation).
15. **Vue broadcast `/stream`** : fond canyon Mars, onglets Classement/Rondes &
    Tables/Équipes/Statistiques, mode OBS `?stream=1`, podium/grid équipes,
    rank movement + écarts, ligne de coupe Top 32, recherche/épinglage joueurs,
    panneau détail joueur.
16. **Stats réécrites** : `OverviewStats` partagé (`React.memo`), bascule
    Joueurs/Corporations, colonnes triables + heatmap, drawer joueur,
    comparateur de corporations (`CorpCompare`), sélecteur de tournoi en
    grille, noms `Q<aa> - <ville>`, filtre année de saison.
17. **Tables de 5 supprimées** : layouts élimination R1/R2 reconstruits en
    4/3, reste bracket 1 mod 4 → trois tables de 3 ; filet de sécurité
    Consolation en ronde 2 (plus de joueur perdu entre rondes) ; action
    « Régénérer la ronde » ; drag-to-new-table.
18. **Filtre année** : dashboard + `/stats`, saison lue dans le nom du tournoi
    d'abord (fallback `eventDate`) ; finale nommée « CdF Finale <année> »
    dynamiquement (`year` côté API).
19. **Corporations** : Athénadès ajoutée (logo + picklist), World Series Mars
    supprimée (nom/logo/image — les vieilles scorecards retombent en texte).
20. **Token d'accès score** : `scoreAccessToken` + `?key=` implémenté puis
    entièrement reverté (QR imprimés incompatibles) — la saisie publique reste
    ouverte, la validation admin reste le garde-fou.

## 11. Points d'attention pour les modifications

- Les champs JSON (`participantIds`, `results`, `scorecards`, `qualifiedIds`)
  sont des **strings en base** — toujours parser/serializer via les helpers
  (`formatTournament` côté API, types côté front).
- `participantIds` peut contenir des `null` (places vides) — filtrer avec
  `filter(Boolean)` / gardes de type.
- Le format est recalculé à chaque changement de joueurs actifs (DNF/retrait) —
  utiliser `getFormat(activeCount)` et non `tournament.format` en brouillon.
- Toute logique de tables/rondes/qualifiés vit dans `qualifier-rules.ts` — ne pas
  dupliquer les règles dans les pages.
- En prod, le front appelle `https://api.terraformingmars.fr`
  (`NEXT_PUBLIC_API_URL` baké au build — ne **jamais** builder sans, sinon le
  fallback `http://localhost:4000` rend le site « vide » en prod) ; en dev,
  `http://localhost:4000`.
- **Année de saison** : toujours lire l'année dans le **nom** du tournoi
  d'abord (« Qualifier CdF 2027 » peut se jouer fin 2026), `eventDate` en
  fallback — convention utilisée par le filtre dashboard, le filtre `/stats`,
  `shortTournamentName` (`Q<aa>`) et le nommage « CdF Finale <année> ».
  Ne pas se fier à `eventDate` seule pour grouper par saison.
- La Finale est identifiée par son nom (`/finale/i` + « CdF Finale <année> »
  dynamique) — ne pas renommer sans adapter les filtres (détection
  `isFinaleTournament`, recherche du brouillon, endpoint `finale/add-players`).
- **Jamais de table de 5** : privilégier 4, puis 3, 5 en dernier recours —
  les layouts élimination R1/R2 et la distribution bracket supposent des
  tables ≤ 4 ; tout nouveau layout doit respecter ça.
- Le suspense de Finale s'applique côté **rendu uniquement** — l'API renvoie
  les vraies données ; ne pas réutiliser les pages publiques pour afficher la
  ronde 3 non publiée sans passer par les mêmes filtres d'anonymisation.
- `OverviewStats` est partagé entre `/stats` et l'onglet Statistiques de
  `/stream` — toute modif impacte les deux surfaces.
