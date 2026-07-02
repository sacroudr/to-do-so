-- 20260701090500_security_hardening.sql
-- Durcissement de securite (defense en profondeur) issu de l'audit du schema.
-- NE MODIFIE PAS le modele d'autorisation "hybride" valide (§3 / §4.2) :
--   - lecture ouverte a toute l'equipe,
--   - INSERT/UPDATE des taches ouverts, DELETE reserve a l'auteur ou a un responsable.
-- Idempotente (create or replace / if exists), rejouable sans erreur.
--
-- Contenu :
--   A. Fige le search_path des fonctions (dont SECURITY DEFINER) + retire l'EXECUTE
--      inutile accorde par defaut a public/anon/authenticated (lint Supabase).
--   B. Empeche le client de forger l'identite du profil : `id` et `email` deviennent
--      immuables cote client (nom / avatar restent editables) — reste alignes sur
--      auth.users, source de verite.
--   C. Fige `tasks.created_by` (auteur) apres creation : preserve l'integrite du
--      garde-fou de suppression (auteur OU responsable).
--   D. REVOKE explicite pour le role `anon` (defense en profondeur : meme si la RLS
--      etait un jour desactivee, `anon` n'aurait aucun privilege de table).

-- ---------------------------------------------------------------------------
-- A. Durcissement des fonctions
-- ---------------------------------------------------------------------------

-- set_updated_at : search_path fige a vide + appel qualifie de pg_catalog.now().
-- Empeche tout detournement par un search_path attaquant (lint "function_search_path_mutable").
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- handle_new_user (SECURITY DEFINER) : search_path fige a vide, tout est qualifie.
-- Comportement inchange (creation idempotente du profil a l'inscription).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nom, email, avatar)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nom', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Les fonctions trigger n'ont pas besoin d'etre appelables directement par les
-- roles clients : on retire l'EXECUTE accorde a public par defaut.
revoke all on function public.set_updated_at()  from public;
revoke all on function public.handle_new_user() from public;
-- (anon/authenticated heritent de public ; on est explicite par prudence.)
revoke all on function public.handle_new_user() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- B. Profil : empecher la falsification de `id` / `email` cote client.
-- La policy profiles_update_self autorise deja seulement SA propre ligne, mais
-- rien n'empeche l'utilisateur de reecrire son `email` (divergence avec
-- auth.users -> usurpation d'affichage). On fige id + email a l'UPDATE ; le
-- backend (service_role) reste libre de synchroniser via un flux dedie si besoin.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_lock_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.id    := old.id;      -- immuable (deja contraint par la policy, verrou defensif)
  new.email := old.email;   -- reste aligne sur auth.users (source de verite)
  return new;
end;
$$;

drop trigger if exists profiles_lock_identity on public.profiles;
create trigger profiles_lock_identity
  before update on public.profiles
  for each row execute function public.profiles_lock_identity();

-- ---------------------------------------------------------------------------
-- C. Tache : `created_by` (auteur) immuable apres creation.
-- L'UPDATE etant ouvert a toute l'equipe (§3), sans ce verrou un utilisateur
-- pourrait se declarer auteur d'une tache et contourner l'esprit du garde-fou
-- de suppression. L'auteur est fixe a la creation et ne doit jamais changer
-- (la reassignation concerne les RESPONSABLES via task_assignees, §4.2).
-- ---------------------------------------------------------------------------
create or replace function public.tasks_lock_created_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists tasks_lock_created_by on public.tasks;
create trigger tasks_lock_created_by
  before update on public.tasks
  for each row execute function public.tasks_lock_created_by();

-- ---------------------------------------------------------------------------
-- D. Defense en profondeur : aucun privilege de table pour `anon`.
-- La RLS bloque deja `anon` (aucune policy), mais un REVOKE explicite garantit
-- l'absence d'acces meme si la RLS venait a etre desactivee par erreur.
-- ---------------------------------------------------------------------------
revoke all on public.profiles       from anon;
revoke all on public.projects       from anon;
revoke all on public.tasks          from anon;
revoke all on public.task_assignees from anon;
