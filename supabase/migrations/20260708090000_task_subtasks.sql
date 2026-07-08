-- 20260708090000_task_subtasks.sql
-- Sous-taches (checklist) d'une tache principale (requirements.md §4.2, extension).
--
-- Migration ADDITIVE (aucune donnee existante modifiee) :
--   table `public.task_subtasks` (plusieurs items de checklist par tache) + RLS.
--
-- Modele d'autorisation HYBRIDE (coherent avec tasks / task_assignees / task_attachments) :
--   SELECT / INSERT / UPDATE / DELETE ouverts a `authenticated` ; le role `anon` n'a
--   aucun acces. Le backend accede via `service_role` (bypass RLS) apres verification
--   du JWT. Contrairement aux pieces jointes, les sous-taches ONT besoin d'UPDATE
--   (cocher/decocher + reordonner) et de DELETE (retirer un item).
-- Idempotente / rejouable (if not exists / drop policy if exists).

-- ---------------------------------------------------------------------------
-- Table des sous-taches (checklist).
-- ---------------------------------------------------------------------------
create table if not exists public.task_subtasks (
  id         uuid primary key default gen_random_uuid(),
  -- Suppression de la tache principale -> ses sous-taches disparaissent (cascade).
  task_id    uuid not null references public.tasks (id) on delete cascade,
  title      text not null,
  is_done    boolean not null default false,
  position   integer not null,                                          -- ordre d'affichage (0..n)
  created_at timestamptz not null default now()
);

comment on table public.task_subtasks is
  'Sous-taches (checklist) d''une tache principale (requirements.md §4.2, extension).';

-- Chargement des sous-taches d'une tache (vue detail) et calcul des compteurs de
-- progression (badge). Index compose (task_id, position) : sert aussi le tri par
-- position sans tri supplementaire.
create index if not exists task_subtasks_task_id_idx
  on public.task_subtasks (task_id);
create index if not exists task_subtasks_task_id_position_idx
  on public.task_subtasks (task_id, position);

alter table public.task_subtasks enable row level security;

grant select, insert, update, delete on public.task_subtasks to authenticated;
grant all on public.task_subtasks to service_role;

drop policy if exists "task_subtasks_select_authenticated" on public.task_subtasks;
create policy "task_subtasks_select_authenticated"
  on public.task_subtasks for select
  to authenticated
  using (true);

drop policy if exists "task_subtasks_insert_authenticated" on public.task_subtasks;
create policy "task_subtasks_insert_authenticated"
  on public.task_subtasks for insert
  to authenticated
  with check (true);

drop policy if exists "task_subtasks_update_authenticated" on public.task_subtasks;
create policy "task_subtasks_update_authenticated"
  on public.task_subtasks for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "task_subtasks_delete_authenticated" on public.task_subtasks;
create policy "task_subtasks_delete_authenticated"
  on public.task_subtasks for delete
  to authenticated
  using (true);

-- Defense en profondeur : aucun privilege de table pour `anon` (comme les autres tables).
revoke all on public.task_subtasks from anon;
