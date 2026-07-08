-- 20260707090000_task_attachments.sql
-- Pieces jointes PDF des taches (requirements.md §5).
--
-- Migration ADDITIVE (aucune donnee existante modifiee) :
--   1. table `public.task_attachments` (plusieurs PDF cumulables par tache) + RLS,
--   2. bucket Storage PRIVE `task-attachments` (10 Mo, PDF uniquement) + policies
--      d'acces sur `storage.objects`.
--
-- Modele d'autorisation HYBRIDE (coherent avec tasks / task_assignees) :
--   SELECT / INSERT ouverts a `authenticated` ; le role `anon` n'a aucun acces.
--   Le backend accede via `service_role` (bypass RLS) apres verification du JWT.
-- Idempotente / rejouable (if not exists / drop policy if exists / on conflict).

-- ---------------------------------------------------------------------------
-- 1. Table des pieces jointes.
-- ---------------------------------------------------------------------------
create table if not exists public.task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  storage_path text not null,                                            -- chemin de l'objet dans le bucket prive
  file_name    text not null,                                           -- nom d'origine (affichage)
  mime_type    text not null,
  size_bytes   bigint not null,
  -- Auteur de l'ajout (§5) ; la piece jointe survit a la suppression du compte.
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.task_attachments is
  'Pieces jointes PDF des taches (requirements.md §5), cumulables (historique).';

-- Chargement des pieces jointes d'une tache (vue detail §4.2 / formulaire d'edition).
create index if not exists task_attachments_task_id_idx
  on public.task_attachments (task_id);

alter table public.task_attachments enable row level security;

grant select, insert on public.task_attachments to authenticated;
grant all on public.task_attachments to service_role;

drop policy if exists "task_attachments_select_authenticated" on public.task_attachments;
create policy "task_attachments_select_authenticated"
  on public.task_attachments for select
  to authenticated
  using (true);

drop policy if exists "task_attachments_insert_authenticated" on public.task_attachments;
create policy "task_attachments_insert_authenticated"
  on public.task_attachments for insert
  to authenticated
  with check (true);

-- Defense en profondeur : aucun privilege de table pour `anon` (comme les autres tables).
revoke all on public.task_attachments from anon;

-- ---------------------------------------------------------------------------
-- 2. Bucket Storage PRIVE + policies sur storage.objects.
--    file_size_limit = 10 Mo (10485760 octets) ; PDF uniquement.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;

-- Acces aux objets du bucket : lecture / insertion reservees a `authenticated`.
-- (Le backend passe en service_role et contourne ces policies ; elles restent une
--  defense en profondeur pour tout acces client direct.)
drop policy if exists "task_attachments_storage_select_authenticated" on storage.objects;
create policy "task_attachments_storage_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'task-attachments');

drop policy if exists "task_attachments_storage_insert_authenticated" on storage.objects;
create policy "task_attachments_storage_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'task-attachments');
