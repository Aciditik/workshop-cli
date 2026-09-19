---
description: Documentation complète de l'application CdF Terraforming Mars — frontend, API, règles de tournoi et déploiement
---

# CdF Terraforming Mars — Documentation complète de l'application

Application de gestion de tournois pour le **Championnat de France de Terraforming Mars (CdF)**.
Elle permet à des organisateurs (boutiques/associations) de créer et gérer des tournois
qualificatifs, aux joueurs de saisir leurs scores via QR code, et à l'admin de consolider
les qualifiés dans une Finale nationale.

## 1. Architecture générale

Trois dépôts :

- **`workshop-cli`** — Frontend Next.js 16 (Turbopack), React 19, TailwindCSS 4, TypeScript.
  Déployé en standalone. Port 3000 en interne.
- **`workshop-api`** — Backend Express 4 + Prisma 5 + PostgreSQL (Supabase en prod).
  TypeScript compilé vers `dist/`. Port 4000 en interne.
- **`workshop-deploy`** — Image Docker tout-en-un : nginx (reverse proxy sur `$PORT`,
  défaut 8080) + supervisord qui lance l'API (4000) et le frontend (3000).
  Déployé sur Render via GitHub Actions → GHCR → deploy hook.

Routing nginx : `/api/*` → Express :4000, tout le reste → Next.js :3000.

## 2. Authentification et rôles

- **JWT** signé avec `JWT_SECRET`, durée 7 jours, stocké dans `localStorage("token")`.
- Deux rôles : `organizer` (compte créé via inscription) et `admin` (seedé).
- `AuthProvider` (`src/lib/auth.tsx`) : `login`, `register`, `logout`, `fetchMe` au chargement.
- `AuthGate` (`AppShell.tsx`) redirige vers `/login` sauf pages publiques :
  `/login`, `/t/*` (pages joueurs), `/chrono`.
- **Permissions** : un organizer ne voit que SES tournois (`ownerId`). L'admin voit tout,
  peut réassigner le propriétaire, éditer tout tournoi, supprimer, corriger les scores
  validés, marquer des joueurs DNF.

## 3. Modèle de données (Prisma — `workshop-api/prisma/schema.prisma`)

- **User** : id, email (unique), password (bcrypt), name, role (`organizer`|`admin`).
- **Tournament** : id, name, logoUrl?, eventDate (string), status (`brouillon`|`en_cours`|`fini`),
  format (`elimination`|`swiss`|`bracket`), size, currentRound, maxRounds,
  qualifiedCount, qualifiedIds (JSON string), ownerId → User.
- **Participant** : id, firstname, name, email, phone, score (Float, points cumulés),
  dnf (bool), sourceTournamentId? (Finale : tournoi qualificatif d'origine), tournamentId.
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

- **`elimination`** — 8 à 28 joueurs, 2 rondes. Ronde 1 : tables de 3-5 selon layouts
  déclaratifs fixes par taille (`ELIMINATION_LAYOUTS`). Ronde 2 : les gagnants de
  chaque table + meilleurs seconds rejoignent les tables finales (`isFinalist`).
- **`swiss`** — 29+ joueurs, 3 rondes, format par défaut. Ronde 1 : tables de 4
  aléatoires. Rondes 2-3 : appariement suisse par score cumulé (tables de 4,
  ajustement 3/5 pour les restes, évitement des rematchs).
- **`bracket`** — 29+ joueurs, 3 rondes, opt-in à la création (icône `mdiTournament`).
  Arbre d'élimination : Quarts → Demies → Finale. Tables de 4 en priorité, puis 3,
  puis 5 (`getBracketTableSizes`). Les joueurs avancent selon leur rang à table
  (`crossBracketAdvancers` entrelace les qualifiés pour éviter les rematchs).
  Affichage par rang (1er, 2e…) — pas de points 5/3/2/1.

Règles communes : `getFormat(size)`, `getMaxRounds`, `getQualifiedCount(size)`
(nb de qualifiés pour la Finale selon la taille), `determineQualifiedPlayers`
(bracket : ronde la plus lointaine → points dernière table → score cumulé ;
elimination : gagnants des tables finales ; swiss : top par score total).

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
  suppression (propriétaire ou admin).
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
- **`/t/[tournamentId]`** (publique) : landing joueur via QR — infos tournoi, logos,
  ronde courante, recherche de sa table, lien vers la saisie des scores.
- **`/t/[tournamentId]/table/[tableId]`** (publique, mobile) : scorecard — sélection
  corporation (liste `CORPORATIONS`), saisie des 6 catégories + mégacrédits par
  joueur, calcul du total et du rang, soumission à `POST /api/public/.../table/...`.
- **`/stats`** (admin) : leaderboard global + stats par corporation. Filtres
  tournoi/corporation/qualifiés, tri multi-métriques. Source : `GET /api/public/stats`.
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
  tournoi "CdF Finale 2026" appartenant à l'admin (créé en brouillon si absent,
  fusion sinon) ; `sourceTournamentId` persisté par participant.

### `routes/matches.ts` — `/api/tournaments` (auth)

- `PUT /:tournamentId/matches/:matchId` : mise à jour d'une table (results,
  scorecards, isCompleted, isPendingReview, participantIds) — owner ou admin.

### `routes/public.ts` — `/api/public` (sans auth)

- `GET /tournaments/:id` : données publiques du tournoi (page QR).
- `POST /tournaments/:id/table/:tableId` : soumission scorecard joueur →
  calcule les points de placement, écrit results + scorecards,
  `isPendingReview = true`.
- `GET /stats` : toutes les scorecards + métadonnées (filtrage côté client).

## 9. Déploiement (`workshop-deploy`)

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
- Historique : migration SQLite → PostgreSQL/Supabase ; préparation o2switch
  Phusion Passenger (binaryTargets `rhel-openssl-3.0.x`).

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
12. **Format bracket** (dernier) : 3e format opt-in ≥ 29 joueurs, arbre
    Quarts/Demies/Finale, tables 4→3→5, affichage par rang sans points,
    `BracketTreeView`, choix du format à la création et en brouillon.

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
- En prod, le front appelle l'API en same-origin (`NEXT_PUBLIC_API_URL=""`) via
  nginx ; en dev, `http://localhost:4000`.
- La Finale est identifiée par son nom (`/finale/i` / "CdF Finale 2026") — ne pas
  renommer sans adapter les filtres.
