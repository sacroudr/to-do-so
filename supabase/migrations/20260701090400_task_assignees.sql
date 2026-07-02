-- 20260701090400_task_assignees.sql
-- Table de liaison tache <-> responsables (relation multiple, requirements.md §5)
-- + RLS + policy DELETE des taches (placee ici car elle depend de cette table).
--
-- Coherence : Task.assignees (frontend) et Task.assignee_ids (backend) sont
-- resolus a partir de cette table.

create table if not exists public.task_assignees (
  task_id    uuid not null references public.tasks (id)    on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)   -- unicite du couple + index sur (task_id, ...)
);

comment on table public.task_assignees is
  'Association taches <-> responsables (relation multiple, requirements.md §5).';

-- Filtre "par responsable" (§4.6) : index dedie sur user_id (le PK couvre deja task_id).
create index if not exists task_assignees_user_id_idx on public.task_assignees (user_id);

-- ---------------------------------------------------------------------------
-- RLS : lecture ouverte a toute l'equipe (§3). Ecriture (assignation /
-- reassignation) ouverte a toute l'equipe authentifiee, coherente avec l'UPDATE
-- ouvert des taches et le §4.2 (« Les utilisateurs peuvent [...] reassigner »).
-- Pas d'UPDATE : une association est creee ou supprimee, jamais modifiee.
-- ---------------------------------------------------------------------------
alter table public.task_assignees enable row level security;

grant select, insert, delete on public.task_assignees to authenticated;
grant all on public.task_assignees to service_role;

drop policy if exists "task_assignees_select_authenticated" on public.task_assignees;
create policy "task_assignees_select_authenticated"
  on public.task_assignees for select
  to authenticated
  using (true);

drop policy if exists "task_assignees_insert_authenticated" on public.task_assignees;
create policy "task_assignees_insert_authenticated"
  on public.task_assignees for insert
  to authenticated
  with check (true);

drop policy if exists "task_assignees_delete_authenticated" on public.task_assignees;
create policy "task_assignees_delete_authenticated"
  on public.task_assignees for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Garde-fou de SUPPRESSION des taches (demande) : un utilisateur ne peut supprimer
-- une tache que s'il en est l'AUTEUR ou un RESPONSABLE.
-- Placee ici (et non dans la migration tasks) car elle reference task_assignees.
--
-- NB de conception : §4.2 autorisant la reassignation par tous, ce garde-fou reste
-- volontairement LEGER (un utilisateur pourrait s'ajouter comme responsable pour
-- pouvoir supprimer). Il materialise l'intention « etre implique dans la tache » ;
-- un controle plus strict releve de la couche API (backend, service_role).
-- La sous-requete sur task_assignees est soumise a sa RLS SELECT (ouverte a authenticated).
-- ---------------------------------------------------------------------------
drop policy if exists "tasks_delete_owner_or_assignee" on public.tasks;
create policy "tasks_delete_owner_or_assignee"
  on public.tasks for delete
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1
      from public.task_assignees ta
      where ta.task_id = tasks.id
        and ta.user_id = (select auth.uid())
    )
  );
