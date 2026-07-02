-- 20260701090200_projects.sql
-- Table `projects` (requirements.md §5) + RLS.
--
-- Coherence : frontend/lib/types/domain.ts (interface Project : id, nom, description)
--             backend/app/schemas/project.py (ProjectBase : nom, description).

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.projects is
  'Projets / thematiques regroupant des taches (requirements.md §5).';

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : gestion des projets ouverte a toute l'equipe authentifiee.
-- La phase 1 n'a pas de systeme de roles (admin/membre) — celui-ci est prevu en
-- evolution (§2.2). Le filtrage fin pourra etre ajoute cote API/roles plus tard.
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;

grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

drop policy if exists "projects_select_authenticated" on public.projects;
create policy "projects_select_authenticated"
  on public.projects for select
  to authenticated
  using (true);

drop policy if exists "projects_insert_authenticated" on public.projects;
create policy "projects_insert_authenticated"
  on public.projects for insert
  to authenticated
  with check (true);

drop policy if exists "projects_update_authenticated" on public.projects;
create policy "projects_update_authenticated"
  on public.projects for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "projects_delete_authenticated" on public.projects;
create policy "projects_delete_authenticated"
  on public.projects for delete
  to authenticated
  using (true);
