-- 20260701090000_init_extensions_and_enums.sql
-- Socle commun du schema : extensions, types enum (statut / priorite) et la
-- fonction partagee de maintien de `updated_at`.
--
-- Coherence : les valeurs d'enum sont STRICTEMENT alignees sur le code
--   - frontend : frontend/lib/types/domain.ts (TaskStatus / TaskPriority)
--   - backend  : backend/app/schemas/task.py (TaskStatus / TaskPriority)
-- requirements.md : §4.2 (priorites, statuts) et §4.3 (colonnes Kanban).

-- gen_random_uuid() (pgcrypto est disponible par defaut sur Supabase, on le rend explicite).
create extension if not exists pgcrypto;

-- Statuts de tache = colonnes de la vue Kanban (§4.3), dans l'ordre d'affichage.
-- Valeurs techniques en anglais ; les libelles FR vivent cote frontend
-- (frontend/lib/constants/task.ts), conformement a la convention d'architecture.md §4.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'todo',
      'in_progress',
      'waiting',
      'blocked',
      'done'
    );
  end if;
end$$;

-- Priorites (§4.2).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum (
      'low',
      'medium',
      'high'
    );
  end if;
end$$;

-- Evolutivite (§2.2 / §8) : pour ajouter un statut/priorite plus tard, utiliser
--   ALTER TYPE public.task_status ADD VALUE '<nouvelle_valeur>';
-- (pensez a mettre a jour le code frontend/backend en meme temps).

-- Fonction partagee : positionne `updated_at` a chaque UPDATE.
-- Reutilisee par les triggers de profiles / projects / tasks.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
