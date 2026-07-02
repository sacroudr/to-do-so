-- 20260701090100_profiles_and_auth_trigger.sql
-- Table `profiles` (requirements.md §5) + creation automatique du profil a
-- l'inscription via Supabase Auth + RLS.
--
-- Coherence : frontend/lib/types/domain.ts (interface Profile : id, nom, email, avatar).

create table if not exists public.profiles (
  -- 1-1 avec auth.users : l'id du profil EST l'id de l'utilisateur Supabase Auth.
  id         uuid primary key references auth.users (id) on delete cascade,
  nom        text not null,
  email      text not null unique,
  avatar     text,                                  -- URL d'avatar, optionnelle (§5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Comptes membres de l''equipe (requirements.md §5). Relation 1-1 avec auth.users.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger d'inscription (§4.1) : chaque nouvelle ligne dans auth.users cree la
-- ligne `profiles` correspondante. SECURITY DEFINER => la fonction s'execute avec
-- les droits de son proprietaire et contourne la RLS (l'insertion vient du systeme,
-- pas d'un client authentifie).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nom, email, avatar)
  values (
    new.id,
    -- Nom : on tente les metadonnees usuelles, sinon la partie locale de l'email.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nom', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;  -- idempotent / robuste aux re-executions
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS : lecture ouverte a toute l'equipe authentifiee ; chacun ne peut modifier
-- que SON propre profil (§3 / §8). Aucun acces pour le role `anon` (§8 : acces
-- restreint aux comptes de l'equipe).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Pas de policy INSERT/DELETE cote client :
--   - INSERT : gere par le trigger handle_new_user (SECURITY DEFINER).
--   - DELETE : suit la cascade depuis auth.users (suppression d'un compte).
