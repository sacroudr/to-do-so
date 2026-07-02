-- 20260701090300_tasks.sql
-- Table `tasks` (requirements.md §4.2 / §5) + RLS (modele "hybride" retenu).
--
-- Coherence : frontend/lib/types/domain.ts (Task) et backend/app/schemas/task.py
-- (champs metier FR : titre, statut, priorite, project_id, source ; echeance en
--  deux colonnes due_date + due_label — voir architecture.md §4).
--
-- AJOUT vs scaffold initial : colonne `created_by` (auteur), necessaire au
-- garde-fou de suppression demande. A repercuter dans les types front/back lors de
-- l'implementation des endpoints (voir architecture.md §5).

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  description text,
  project_id  uuid references public.projects (id) on delete set null,  -- tache orpheline autorisee (§4.2)
  -- Echeance : date PRECISE (due_date) OU indication LIBRE (due_label), §4.2.
  -- Les deux sont optionnelles et non exclusives au niveau du schema ; l'UI/API
  -- decident laquelle presenter (cf. TaskDueDate cote frontend).
  due_date    date,
  due_label   text,
  statut      public.task_status   not null default 'todo',
  priorite    public.task_priority not null default 'medium',
  source      text,                                                     -- reunion / compte rendu d'origine (§4.2)
  -- Auteur : rempli automatiquement pour un INSERT client (default auth.uid()) ;
  -- le backend (service_role, hors RLS) le renseigne explicitement depuis le JWT verifie.
  -- ON DELETE SET NULL : la tache survit a la suppression du compte de son auteur.
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tasks is
  'Taches issues des reunions (requirements.md §4.2 / §5).';
comment on column public.tasks.created_by is
  'Auteur de la tache ; sert au garde-fou RLS de suppression (auteur OU responsable).';

-- Index de performance (§8 : chargement rapide Kanban/Liste meme a volume croissant).
create index if not exists tasks_project_id_idx on public.tasks (project_id);   -- filtre par projet (§4.6)
create index if not exists tasks_statut_idx     on public.tasks (statut);        -- regroupement Kanban (§4.3)
create index if not exists tasks_created_by_idx on public.tasks (created_by);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — modele HYBRIDE :
--   SELECT  -> toute l'equipe authentifiee (§3)
--   INSERT  -> toute l'equipe (l'auteur declare doit etre soi-meme : anti-usurpation)
--   UPDATE  -> toute l'equipe (§3 : « creer, modifier... qu'il en soit responsable ou non »)
--   DELETE  -> auteur OU responsable (garde-fou) — voir migration task_assignees.
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
  on public.tasks for select
  to authenticated
  using (true);

drop policy if exists "tasks_insert_authenticated" on public.tasks;
create policy "tasks_insert_authenticated"
  on public.tasks for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "tasks_update_authenticated" on public.tasks;
create policy "tasks_update_authenticated"
  on public.tasks for update
  to authenticated
  using (true)
  with check (true);

-- NB : la policy DELETE (auteur OU responsable) reference public.task_assignees
-- et est donc creee dans la migration suivante, une fois cette table existante.
