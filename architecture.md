# Architecture — To-Do-So

Document de reference sur la structure du projet, les conventions et les choix
techniques. Il complete `requirements.md` (source de verite fonctionnelle) et
s'aligne section par section dessus.

---

## 1. Vue d'ensemble

To-Do-So est un **monorepo simple** (pas de Turborepo/Nx) organise en deux
applications independantes qui communiquent via HTTP :

- `frontend/` — application Next.js 16 (App Router) + Tailwind CSS v4.
- `backend/` — API Python FastAPI qui verifie les JWT Supabase et sert la logique
  metier + l'acces a PostgreSQL (Supabase).

Supabase fournit **la base PostgreSQL** et **l'authentification** (Supabase Auth).

```
                 ┌──────────────────────┐        ┌──────────────────────┐
                 │   Frontend (Next.js)  │        │   Backend (FastAPI)   │
   Navigateur ──▶│  App Router, Tailwind │        │  API /api/v1, JWT     │
                 └───────────┬───────────┘        └───────────┬──────────┘
                             │  (1) Auth email/mdp             │
                             ▼                                 │
                   ┌───────────────────┐                       │
                   │   Supabase Auth   │                       │
                   │   (JWT, sessions) │                       │
                   └─────────┬─────────┘                       │
                             │  (2) JWT en cookie              │
                             │                                 │
        (3) fetch API + Authorization: Bearer <JWT>            │
                             └───────────────▶─────────────────┘
                                                      │ (4) verifie le JWT
                                                      ▼
                                            ┌───────────────────┐
                                            │ Supabase Postgres │
                                            └───────────────────┘
```

### Choix : deux dossiers separes `frontend/` + `backend/`

Le scaffold Next.js existant a ete **deplace** a la racine vers `frontend/` (tous ses
fichiers de configuration l'ont suivi : `next.config.ts`, `tsconfig.json`,
`eslint.config.mjs`, `postcss.config.mjs`, `package.json`, `node_modules`, etc.). Le
backend vit dans `backend/`.

**Justification.** La demande impose une separation nette frontend/backend. Deux
dossiers racines offrent : des cycles de vie et deploiements independants (Vercel pour
le frontend, un hote a confirmer pour l'API, §6.1), des dependances cloisonnees (npm
vs pip), et une lisibilite immediate. On evite l'outillage monorepo lourd, non
justifie a cette echelle.

> Note : `AGENTS.md` reference les guides Next.js sous `node_modules/next/dist/docs/`.
> Depuis le deplacement, ils se trouvent sous `frontend/node_modules/next/dist/docs/`.

---

## 2. Contraintes Next.js 16 respectees (breaking changes)

Cette version de Next.js differe des versions anterieures. Les guides de
`frontend/node_modules/next/dist/docs/` ont ete consultes ; points appliques :

| Sujet | Regle appliquee |
| --- | --- |
| **`middleware` → `proxy`** | La garde de navigation est `frontend/proxy.ts` (fonction exportee `proxy`), runtime Node.js. `middleware.ts` est deprecie en v16. |
| **APIs de requete async** | `params`, `searchParams`, `cookies()`, `headers()` sont des Promises et sont `await` (ex. `app/(app)/projects/[projectId]/page.tsx`, `lib/supabase/server.ts`). |
| **Turbopack par defaut** | Scripts sans `--turbopack`. |
| **`next lint` supprime** | `package.json` invoque `eslint` directement ; ESLint flat config (`eslint.config.mjs`). |
| **Tailwind v4** | Configuration **par CSS** dans `app/globals.css` (`@import "tailwindcss"` + `@theme`), pas de `tailwind.config.js`. |
| **Type helpers** | Usage de `PageProps<'/route'>` (globaux, generes par Next) pour typer `params`. |

---

## 3. Structure des dossiers

### 3.1 Frontend (`frontend/`)

```
frontend/
├── app/
│   ├── layout.tsx                 # Root layout (html/body, fonts, globals) — lang="fr"
│   ├── globals.css                # Tailwind v4 + palette statuts/priorites (@theme)
│   ├── page.tsx                   # "/" -> redirige vers /dashboard
│   ├── (auth)/                    # Groupe de routes SANS sidebar (URL inchangee)
│   │   ├── layout.tsx             # Carte centree
│   │   ├── login/page.tsx         # Connexion (Supabase Auth) — §4.1
│   │   └── forgot-password/page.tsx  # Mot de passe oublie — §4.1
│   ├── (app)/                     # Groupe de routes AVEC sidebar (coquille app)
│   │   ├── layout.tsx             # Sidebar + zone de contenu
│   │   ├── dashboard/page.tsx     # Tableau de bord — §4.7
│   │   ├── kanban/page.tsx        # Vue Kanban (colonnes par statut) — §4.3
│   │   ├── list/page.tsx          # Vue Liste (tableau triable) — §4.4
│   │   ├── projects/page.tsx      # Liste des projets — §5
│   │   ├── projects/[projectId]/page.tsx   # Detail projet (params async)
│   │   ├── projects/[projectId]/loading.tsx # Skeleton (prefetch partiel)
│   │   └── profile/page.tsx       # Profil utilisateur — §4.7
│   └── auth/signout/route.ts      # Route Handler POST : deconnexion serveur
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx            # Sidebar pilotee par config (evolutive) — §4.7/§2.2
│   │   └── view-switcher.tsx      # Bascule Kanban/Liste — §4.5
│   └── ui/
│       └── status-badge.tsx       # Pastille couleur de statut — §7
├── lib/
│   ├── env.ts                     # Validation des variables NEXT_PUBLIC_*
│   ├── config/navigation.ts       # Sections de la sidebar (actives + futures)
│   ├── constants/task.ts          # Palette + libelles statuts/priorites
│   ├── types/domain.ts            # Types metier (Profile, Project, Task...)
│   ├── supabase/client.ts         # Client Supabase navigateur
│   ├── supabase/server.ts         # Client Supabase serveur (cookies async)
│   └── api/client.ts              # fetch wrapper : joint le JWT (Bearer)
├── proxy.ts                       # Garde de navigation (ex-middleware)
├── Dockerfile / .dockerignore     # Self-hosting optionnel (Vercel = cible)
├── .env.example                   # Cles publiques uniquement
└── (next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs)
```

### 3.2 Backend (`backend/`)

Architecture **en couches** (routes → dependances/securite → schemas → db), avec un
**dossier dedie a la verification des tokens Supabase** comme demande.

```
backend/
├── app/
│   ├── main.py                    # create_app() : CORS, handlers, montage /api/v1
│   ├── core/
│   │   ├── config.py              # Settings (pydantic-settings) depuis l'env
│   │   ├── errors.py              # Erreurs applicatives + handler global JSON
│   │   └── security/              # ★ DOSSIER DEDIE verification tokens Supabase
│   │       └── jwt.py             # verify_supabase_jwt (HS256, audience, exp)
│   ├── api/
│   │   ├── deps.py                # get_current_user (garde JWT) -> AuthenticatedUser
│   │   └── v1/
│   │       ├── router.py          # agrege les routes v1
│   │       └── routes/
│   │           ├── health.py      # PUBLIC (sonde)
│   │           ├── tasks.py       # protege (JWT)
│   │           ├── projects.py    # protege (JWT)
│   │           └── profiles.py    # protege (JWT) : /me
│   ├── schemas/                   # Modeles Pydantic (auth, task, project)
│   └── db/
│       └── supabase.py            # Client Supabase service_role (acces Postgres)
├── tests/                         # health public + garde 401 (exemple)
├── pyproject.toml                 # deps + ruff + black + pytest + mypy
├── requirements.txt               # deps runtime (alternative pip)
├── Dockerfile / .dockerignore     # multi-stage, non-root, healthcheck
└── .env.example                   # SECRETS backend (service_role, JWT secret)
```

**Regle de dependances (importante).** Le flux va des couches externes vers les
couches internes : `routes` dependent de `deps`/`schemas`/`db` ; `deps` depend de
`core.security` ; `core.security` ne depend de rien d'autre que `core.config`. La
verification du token est isolee et remplacable (voir §6). Les routes ne contiennent
pas de SQL : l'acces base passe par `app/db/supabase.py`.

---

## 4. Conventions de nommage

### Frontend
- **Fichiers de composants** : `kebab-case.tsx` (`view-switcher.tsx`), en cohérence
  avec les fichiers speciaux App Router (`page.tsx`, `layout.tsx`, `route.ts`).
- **Composants React** : `PascalCase` (`Sidebar`, `StatusBadge`).
- **Fonctions / variables** : `camelCase`. **Types / interfaces** : `PascalCase`.
- **Alias d'import** : `@/*` -> racine `frontend/` (defini dans `tsconfig.json`).
- **Groupes de routes** : `(auth)` / `(app)` — organisation sans impact sur l'URL.
- **Statuts / priorites** : valeurs techniques en anglais (`in_progress`, `high`),
  libelles d'affichage en francais dans `lib/constants/task.ts`.

### Backend
- **Modules / fichiers** : `snake_case.py`. **Classes** : `PascalCase`
  (`AuthenticatedUser`). **Fonctions / variables** : `snake_case`.
- **Endpoints** : versionnes sous `/api/v1`, ressources au pluriel (`/tasks`,
  `/projects`, `/profiles`).
- **Champs de donnees** : noms metier alignes sur le modele `requirements.md` §5
  (`titre`, `statut`, `priorite`, `project_id`, `source`...).

---

## 5. Modele de donnees (rappel §5)

Tables Supabase : `profiles`, `projects`, `tasks`, `task_assignees` (relation
tache ↔ responsables multiple). Les types frontend (`lib/types/domain.ts`) et les
schemas backend (`app/schemas/`) refletent ces tables.

Le **schema SQL et les policies RLS sont implementes** dans `supabase/migrations/`
(voir `supabase/README.md` pour l'ordre et la procedure d'application). Points cles :

- **Enums** natifs `task_status` (`todo`/`in_progress`/`waiting`/`blocked`/`done`) et
  `task_priority` (`low`/`medium`/`high`), strictement alignes sur le code.
- **Echeance** (§4.2) : deux colonnes `tasks.due_date` (`date`) et `tasks.due_label`
  (`text`) — date precise OU indication libre.
- **Trigger d'inscription** : `on_auth_user_created` cree automatiquement la ligne
  `profiles` a chaque nouvel `auth.users` (fonction `handle_new_user`, SECURITY DEFINER).
- **Colonne ajoutee** : `tasks.created_by` (→ `profiles.id`, `on delete set null`),
  conservee pour l'**affichage / l'audit** de l'auteur (elle ne sert PAS a restreindre
  la suppression — voir ci-dessous). > A repercuter dans `lib/types/domain.ts`
  (`Task.createdBy`) et `app/schemas/task.py` lors de l'implementation des endpoints.

### Modele d'autorisation (RLS) — « hybride »

Lecture ouverte a toute l'equipe authentifiee partout (§3). En ecriture : creation,
modification **et suppression** des taches ouvertes a toute l'equipe authentifiee
(requirements.md §4.2 / §3 : « qu'il en soit responsable ou non » ; n'importe quel
membre peut supprimer n'importe quelle tache). Le role `anon` n'a aucun acces (§8). Le
backend accede via la cle `service_role` qui **contourne la RLS** : la RLS est une
defense en profondeur pour tout acces client direct, l'autorisation fine restant a la
charge de l'API.

> **A aligner (migration).** La migration `supabase/migrations/20260701090400_task_assignees.sql`
> definit encore une policy `tasks_delete_owner_or_assignee` (auteur OU responsable).
> Cette regle est OBSOLETE : la suppression est ouverte a tout membre authentifie. La
> policy DELETE doit etre relaxee en `using (true)` (comme l'UPDATE) pour rester
> coherente avec la regle produit confirmee (§4.2).

---

## 6. Flux d'authentification (detaille, §6.2 / §8)

1. **Connexion.** L'utilisateur saisit email + mot de passe sur `/login`. Le client
   navigateur (`lib/supabase/client.ts`) appelle `supabase.auth.signInWithPassword`.
   **Aucun mot de passe ne transite ni n'est stocke par notre code** : Supabase Auth
   gere le hachage et emet un **JWT**. Pas d'inscription libre (§4.1).
2. **Session.** `@supabase/ssr` stocke la session (JWT d'acces + refresh) dans des
   cookies. `frontend/proxy.ts` protege les routes : un visiteur sans session est
   redirige vers `/login` ; un utilisateur connecte sur `/login` va vers `/dashboard`.
3. **Appel API.** Pour lire/ecrire des donnees, le frontend appelle l'API FastAPI via
   `lib/api/client.ts`, qui ajoute l'en-tete `Authorization: Bearer <JWT>`. Cote
   serveur, le JWT est recupere via `lib/supabase/server.ts` (`getAccessToken`).
4. **Verification.** L'API applique la dependance `get_current_user`
   (`app/api/deps.py`) sur chaque route protegee. Elle delegue a
   `verify_supabase_jwt` (`app/core/security/jwt.py`) : controle de la **signature
   HS256** avec `SUPABASE_JWT_SECRET`, de l'**audience** (`authenticated`) et de
   l'**expiration**. En cas d'echec → `401`.
5. **Acces base.** Une fois le token valide, le handler accede a PostgreSQL via le
   client Supabase `service_role` (`app/db/supabase.py`), en appliquant l'autorisation
   dans la couche API.

```
Utilisateur          Frontend (Next.js)         Supabase Auth        Backend (FastAPI)      Postgres
    │  email/mdp          │                          │                     │                   │
    │────────────────────▶│  signInWithPassword      │                     │                   │
    │                     │─────────────────────────▶│                     │                   │
    │                     │   JWT (cookie session)    │                     │                   │
    │                     │◀─────────────────────────│                     │                   │
    │  navigue (proxy.ts) │                          │                     │                   │
    │────────────────────▶│  fetch + Bearer <JWT>    │                     │                   │
    │                     │─────────────────────────────────────────────▶ │                   │
    │                     │                          │  verify_supabase_jwt │                   │
    │                     │                          │  (signature/exp/aud) │                   │
    │                     │                          │                     │  requete SQL      │
    │                     │                          │                     │──────────────────▶│
    │                     │   donnees JSON            │                     │◀──────────────────│
    │                     │◀─────────────────────────────────────────────  │                   │
```

### Evolution possible de la verification JWT
La verification actuelle utilise le **secret partage HS256** (le plus simple, et
conforme a la demande « JWT secret cote backend »). Les projets Supabase recents
peuvent utiliser des cles asymetriques (ES256/RS256) exposees via **JWKS**
(`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`). Le point d'extension est isole dans
`app/core/security/jwt.py` : il suffira de recuperer la cle publique et d'adapter
`algorithms`, sans toucher au reste de l'API.

---

## 7. UI / UX (§7)

- **Une couleur par statut** : tokens `--color-status-*` definis dans
  `app/globals.css` (`@theme`), consommes via `lib/constants/task.ts`
  (`StatusBadge`, colonnes Kanban).
- **Accent selon la priorite** : tokens `--color-priority-*` (bordure gauche des
  cartes, a exploiter lors de l'implementation des cartes).
- **Interface aeree, coins arrondis** : `rounded-xl`, espacements genereux, surfaces
  `bg-surface` sur fond `bg-background`. Cible **desktop**.
- **Sidebar lisible et evolutive** : sections actives + section « A venir » (§2.2),
  ajout d'une entree = 1 ligne dans `lib/config/navigation.ts`.

---

## 8. Securite et evolutivite (§8)

- **Secrets** : aucune valeur en dur ; tout via variables d'environnement
  (`.env.example` fournis pour frontend ET backend). La `service_role key` et le
  `JWT secret` restent **exclusivement** cote backend ; le frontend n'utilise que
  l'`anon key` publique.
- **Acces restreint** : pas d'inscription libre ; comptes crees en amont (§4.1).
- **Evolutivite** : API versionnee (`/api/v1`), sidebar et modele de donnees prevus
  pour accueillir les fonctionnalites futures (§2.2) sans refonte (§10).

---

## 9. Verification de coherence avec `requirements.md`

| Section | Element | Couverture dans le scaffold |
| --- | --- | --- |
| §4.1 Auth | Login, mot de passe oublie, sessions, acces restreint | `(auth)/login`, `(auth)/forgot-password`, `proxy.ts`, Supabase Auth |
| §4.2 Taches | Champs (titre, projet, responsables, echeance libre/date, statut, priorite, source) | `lib/types/domain.ts`, `app/schemas/task.py` |
| §4.3 Kanban | Colonnes par statut | `(app)/kanban` + `TASK_STATUSES` |
| §4.4 Liste | Tableau triable | `(app)/list` |
| §4.5 Bascule | Controle visible Kanban/Liste | `components/layout/view-switcher.tsx` |
| §4.6 Filtres | Par responsable / projet | Emplacements prevus (Kanban/Liste) |
| §4.7 Sidebar | Dashboard, Kanban, Liste, Projets, Profil, deconnexion | `components/layout/sidebar.tsx` + `lib/config/navigation.ts` |
| §5 Donnees | profiles, projects, tasks, task_assignees | types front + schemas back + **schema SQL & RLS** (`supabase/migrations/`) |
| §6 Archi | Next.js + Tailwind, FastAPI, Supabase, JWT | ce document |
| §7 UI/UX | Couleur par statut, accent priorite, aere | `globals.css` + `constants/task.ts` |
| §8 Non-fonctionnel | Secrets, acces restreint, evolutivite | env vars, `/api/v1`, sidebar config |

---

## 10. Prochaines etapes recommandees

1. **Schema Supabase** : ✅ fait — tables `profiles`, `projects`, `tasks`,
   `task_assignees` + **RLS policies** + trigger de creation de `profiles` a
   l'inscription, dans `supabase/migrations/` (voir `supabase/README.md`).
   Reste a repercuter `tasks.created_by` dans les types front/back.
2. **Backend** : implementer les acces base dans `tasks.py` / `projects.py` /
   `profiles.py` via `app/db/supabase.py`, ajouter la couche `services/` si la
   logique metier grossit, et les filtres responsable/projet (§4.6).
3. **Frontend** : cabler `lib/api/client.ts` avec `getAccessToken`, implementer les
   cartes de tache, le glisser-deposer Kanban (§4.3) et le tri de la vue Liste (§4.4).
4. **Tests** : etendre les tests backend (JWT valide/expire via secret de test) et
   ajouter des tests de composants frontend.
5. **CI/CD** : lint + typecheck + tests sur PR ; deploiement Vercel (frontend) et
   choix d'hote backend (§6.1).
