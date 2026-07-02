# Supabase — schéma & migrations

Schéma PostgreSQL de **To-Do-So** (base + authentification Supabase). Les fichiers de
`migrations/` sont la source de vérité du schéma. Ils complètent `requirements.md` §5
et `architecture.md` §5.

## Ordre des migrations

Les migrations sont **numérotées** (préfixe horodaté `AAAAMMJJHHMMSS`) et s'appliquent
dans l'ordre lexicographique :

| Fichier | Contenu |
| --- | --- |
| `20260701090000_init_extensions_and_enums.sql` | Extension `pgcrypto`, types enum `task_status` / `task_priority`, fonction `set_updated_at()`. |
| `20260701090100_profiles_and_auth_trigger.sql` | Table `profiles` + trigger `on_auth_user_created` (création auto du profil à l'inscription) + RLS. |
| `20260701090200_projects.sql` | Table `projects` + RLS. |
| `20260701090300_tasks.sql` | Table `tasks` (dont `created_by`) + index + RLS (SELECT/INSERT/UPDATE). |
| `20260701090400_task_assignees.sql` | Table de liaison `task_assignees` + RLS + policy **DELETE** des tâches (auteur ou responsable). |

> L'ordre est contraint par les clés étrangères : `tasks` référence `projects` et
> `profiles` ; `task_assignees` référence `tasks` et `profiles`. La policy de
> suppression des tâches vit dans la dernière migration car elle interroge
> `task_assignees`.

## Modèle d'autorisation (RLS)

Lecture ouverte à **toute l'équipe authentifiée** partout (§3). Écriture (modèle
**hybride** validé) :

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | authenticated | *(trigger)* | soi-même | *(cascade auth.users)* |
| `projects` | authenticated | authenticated | authenticated | authenticated |
| `tasks` | authenticated | authenticated¹ | authenticated (§3) | **auteur OU responsable** |
| `task_assignees` | authenticated | authenticated | — | authenticated |

¹ `created_by` doit valoir `auth.uid()` (anti-usurpation) ; il est rempli
automatiquement par défaut côté client.

Le rôle `anon` n'a **aucune** policy → aucun accès (§8 : accès restreint à l'équipe).
Le backend FastAPI accède à la base via la clé **`service_role`**, qui **contourne la
RLS** : la RLS est donc une défense en profondeur pour tout accès client direct
(clé `anon`, Realtime), l'autorisation applicative fine restant à la charge de l'API.

## Appliquer les migrations

**Option A — Supabase CLI (recommandé, versionné) :**

```bash
supabase link --project-ref <ref-du-projet>
supabase db push
```

**Option B — SQL Editor (dashboard Supabase) :** exécuter le contenu de chaque
fichier `migrations/*.sql` **dans l'ordre du tableau ci-dessus**.

Les migrations sont écrites de façon idempotente (`if not exists`,
`create or replace`, `drop policy if exists ...`) et peuvent être rejouées sans erreur.
