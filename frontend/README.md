# To-Do-So — Frontend (Next.js)

Frontend de la plateforme interne de suivi de taches. App Router (Next.js 16),
React 19, Tailwind CSS v4. L'authentification est deleguee a Supabase Auth ; les
donnees metier sont servies par l'API FastAPI (`../backend`).

> Architecture detaillee : voir `../architecture.md`.

## Prerequis

- Node.js >= 20.9 (Next.js 16)
- Un projet Supabase (URL + anon key)
- L'API backend qui tourne (voir `../backend`)

## Demarrage

```bash
cd frontend
npm install                 # installe aussi @supabase/ssr et @supabase/supabase-js
cp .env.example .env.local  # puis renseignez les valeurs
npm run dev                 # http://localhost:3000
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Serveur de developpement (Turbopack par defaut en v16) |
| `npm run build` | Build de production |
| `npm run start` | Sert le build de production |
| `npm run lint` | ESLint (flat config ; `next lint` a ete supprime en v16) |
| `npm run typecheck` | Verification TypeScript (`tsc --noEmit`) |

## Points d'attention specifiques a Next.js 16

Cette version comporte des changements de rupture par rapport aux versions
anterieures (voir `AGENTS.md` a la racine) :

- **`proxy.ts` remplace `middleware.ts`** (fonction exportee `proxy`, runtime Node.js).
- **APIs de requete asynchrones** : `params`, `searchParams`, `cookies()`, `headers()`
  sont des Promises et doivent etre `await`.
- **Turbopack par defaut** (plus de flag `--turbopack`).
- **`next lint` supprime** : on invoque ESLint directement.
- **Tailwind v4** : configuration via CSS (`@import "tailwindcss"` + `@theme` dans
  `app/globals.css`), pas de `tailwind.config.js`.

## Structure

```
app/
  (auth)/           # login, mot de passe oublie (layout centre, sans sidebar)
  (app)/            # coquille authentifiee avec sidebar : dashboard, kanban, list, projects, profile
  auth/signout/     # Route Handler de deconnexion (POST)
components/         # UI reutilisable (layout, ui)
lib/                # env, types, constants, config nav, clients Supabase, client API
proxy.ts            # garde de navigation (ex-middleware)
```
