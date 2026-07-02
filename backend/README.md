# To-Do-So — Backend (FastAPI)

API Python de la plateforme de suivi de taches. Verifie le JWT Supabase transmis
par le frontend, applique la logique metier, puis lit/ecrit dans PostgreSQL
(Supabase). Voir `../architecture.md`.

## Prerequis

- Python >= 3.11
- Un projet Supabase (URL, service_role key, JWT secret)

## Demarrage local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"        # ou: pip install -r requirements.txt
cp .env.example .env           # puis renseignez les valeurs
uvicorn app.main:app --reload  # http://localhost:8000
```

- Health check : `GET http://localhost:8000/health`
- Docs OpenAPI (Swagger) : `http://localhost:8000/docs`

## Tests / qualite

```bash
pytest          # tests (inclut la garde JWT sur une route protegee)
ruff check .    # lint
black .         # formatage
mypy app        # typage statique
```

## Structure

```
app/
  main.py                 # creation de l'app, CORS, handlers, montage /api/v1
  core/
    config.py             # settings via pydantic-settings (env)
    errors.py             # erreurs applicatives + handler global
    security/             # DOSSIER DEDIE a la verification des tokens Supabase
      jwt.py              # verify_supabase_jwt (HS256 + audience + exp)
  api/
    deps.py               # get_current_user (garde JWT) -> AuthenticatedUser
    v1/
      router.py           # agregation des routes v1
      routes/             # health (public), tasks, projects, profiles (proteges)
  schemas/                # modeles Pydantic (auth, task, project)
  db/
    supabase.py           # client Supabase (service_role) — acces PostgreSQL
tests/                    # exemples de tests (health + garde 401)
```

## Flux d'authentification

1. Le frontend obtient un JWT via Supabase Auth.
2. Il l'envoie a chaque requete : `Authorization: Bearer <jwt>`.
3. `get_current_user` (app/api/deps.py) delegue a `verify_supabase_jwt`
   (app/core/security/jwt.py) : signature HS256 avec `SUPABASE_JWT_SECRET`,
   audience `authenticated`, expiration.
4. Une fois le token valide, les handlers accedent aux donnees via le client
   Supabase service_role.
