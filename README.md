# To-Do-So

Plateforme interne de suivi de taches et d'actions issues des reunions
(remplacement d'un tableau Excel partage). Monorepo simple : un frontend Next.js et
un backend FastAPI, avec Supabase (PostgreSQL + Auth) comme socle de donnees.

> Specification fonctionnelle : `requirements.md`
> Architecture detaillee et justifications : `architecture.md`

## Organisation du depot

```
to-do-so/
├── frontend/        # Next.js 16 (App Router) + Tailwind v4
├── backend/         # FastAPI (Python) — verification JWT + API metier
├── requirements.md  # cahier des charges (source de verite fonctionnelle)
├── architecture.md  # documentation d'architecture
└── docker-compose.yml
```

## Demarrage rapide

Deux services independants. Voir les README de chaque dossier pour le detail.

```bash
# 1) Backend (http://localhost:8000)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env            # renseigner les cles Supabase
uvicorn app.main:app --reload

# 2) Frontend (http://localhost:3000)
cd frontend
npm install
cp .env.example .env.local      # renseigner URL + anon key Supabase + URL API
npm run dev
```

Ou via Docker : `docker compose up --build` (necessite les fichiers `.env`).

## Stack

| Composant | Technologie |
| --- | --- |
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 |
| Backend | Python + FastAPI |
| Base de donnees | Supabase (PostgreSQL) |
| Authentification | Supabase Auth (email/mot de passe, JWT) |
| Hebergement | Vercel (frontend) ; backend a confirmer (§6.1) |
