-- 20260713093000_team_members.sql
-- Personnes assignables DECOUPLEES des comptes (point 2).
--
-- ⚠️ CETTE MIGRATION TOUCHE DES DONNEES EXISTANTES (elle re-pointe task_assignees).
--    NE PAS appliquer sans confirmation explicite. C'est l'utilisateur qui pousse
--    lui-meme (`supabase db push`). Aucune connexion base n'est faite par l'agent.
--
-- Contexte : jusqu'ici les « responsables » d'une tache etaient des `profiles` (comptes
-- Supabase Auth). On les remplace par une table libre `team_members` : qui peut SE
-- CONNECTER (profiles/Auth, INCHANGE) != qui peut ETRE RESPONSABLE (team_members).
--
-- --- Requetes de recap LECTURE SEULE (a lancer AVANT, non executees ici) :
--       -- profils distincts actuellement responsables (= nb de team_members crees) :
--       select count(distinct user_id) as profils_responsables from public.task_assignees;
--       -- assignations a repointer :
--       select count(*) as assignations from public.task_assignees;

-- ===========================================================================
-- 1. Table team_members (DDL idempotente, hors garde de donnees).
-- ===========================================================================
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name  text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.team_members is
  'Personnes assignables a une tache (point 2). Decouplees des comptes Auth (profiles). '
  'Toute l''equipe authentifiee peut les gerer.';

-- RLS alignee sur le modele projet : toute l'equipe authentifiee gere les personnes
-- assignables ; service_role (API) a tous les droits ; anon aucun.
alter table public.team_members enable row level security;

revoke all on public.team_members from anon;
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;

drop policy if exists "team_members_select_authenticated" on public.team_members;
create policy "team_members_select_authenticated"
  on public.team_members for select
  to authenticated
  using (true);

drop policy if exists "team_members_insert_authenticated" on public.team_members;
create policy "team_members_insert_authenticated"
  on public.team_members for insert
  to authenticated
  with check (true);

drop policy if exists "team_members_update_authenticated" on public.team_members;
create policy "team_members_update_authenticated"
  on public.team_members for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "team_members_delete_authenticated" on public.team_members;
create policy "team_members_delete_authenticated"
  on public.team_members for delete
  to authenticated
  using (true);

-- ===========================================================================
-- 2. Migration de donnees + repointage de task_assignees (GARDEE / rejouable).
--    On conserve le nom de colonne `task_assignees.user_id` (il porte desormais un
--    team_member.id) pour eviter un renommage a propager dans tout le backend.
-- ===========================================================================
do $$
begin
  -- Idempotence : si la FK de task_assignees.user_id pointe deja vers team_members,
  -- le repointage est fait -> skip.
  if exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema = tc.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'task_assignees'
      and tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'team_members'
  ) then
    raise notice 'task_assignees.user_id pointe deja vers team_members : repointage deja applique, skip.';
    return;
  end if;

  -- 2a. Mapping profile.id -> nouveau team_member.id (DEDOUBLONNE par profil : un seul
  --     team_member par profil, meme si plusieurs taches le partagent). Decoupe du nom :
  --     1er mot -> first_name ; reste -> last_name ; si pas d'espace, last_name = ''.
  create temporary table _tm_map on commit drop as
  select
    p.id as profile_id,
    gen_random_uuid() as member_id,
    split_part(btrim(coalesce(p.nom, '')), ' ', 1) as first_name,
    btrim(
      substr(
        btrim(coalesce(p.nom, '')),
        length(split_part(btrim(coalesce(p.nom, '')), ' ', 1)) + 1
      )
    ) as last_name
  from public.profiles p
  where exists (
    select 1 from public.task_assignees ta where ta.user_id = p.id
  );

  -- 2b. Creer les team_members correspondants.
  insert into public.team_members (id, first_name, last_name)
  select member_id, first_name, coalesce(last_name, '')
  from _tm_map;

  -- 2c. Retirer l'ancienne FK (user_id -> profiles) avant de reecrire les valeurs.
  alter table public.task_assignees
    drop constraint if exists task_assignees_user_id_fkey;

  -- 2d. Reecrire les assignations existantes vers les nouveaux team_member.id
  --     (AUCUNE assignation perdue : toutes les lignes sont remappees via le mapping).
  update public.task_assignees ta
  set user_id = m.member_id
  from _tm_map m
  where ta.user_id = m.profile_id;

  -- 2e. Nouvelle FK -> team_members (on delete cascade : supprimer une personne retire
  --     ses assignations).
  alter table public.task_assignees
    add constraint task_assignees_user_id_fkey
    foreign key (user_id) references public.team_members (id) on delete cascade;
end$$;

-- ===========================================================================
-- 3. Note RLS (a signaler) : AUCUN changement de policy n'est requis ici.
--    La branche « responsable » de suppression de tache (tasks_delete_owner_or_assignee,
--    qui testait task_assignees.user_id = auth.uid()) a DEJA ete supprimee par
--    20260702090000_tasks_due_rename_and_delete_policy.sql, remplacee par la policy
--    ouverte `tasks_delete_authenticated` (using true). Il n'y a donc PAS de branche
--    morte a reecrire apres le repointage. Les policies de task_assignees
--    (select/insert/delete, using/with check `true`) ne referencent pas auth.uid()
--    contre user_id -> elles restent valides. L'autorisation reelle des endpoints est
--    de toute facon appliquee cote API (backend service_role, hors RLS).
