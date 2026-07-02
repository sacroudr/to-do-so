-- backfill_profiles_nom.sql
-- Script de RATTRAPAGE ponctuel (a executer une fois, PAS une migration versionnee).
--
-- Contexte : le trigger `handle_new_user` remplit `profiles.nom` a l'inscription. Les
-- comptes crees MANUELLEMENT dans le dashboard Supabase avant l'existence du trigger
-- (ou hors flux normal) peuvent avoir une ligne `profiles` au `nom` vide -> l'ecran
-- Profil affichait alors un nom vide.
--
-- Ce script recopie, pour ces lignes seulement, le meme nom que celui qu'aurait pose
-- le trigger : metadonnees Auth (nom / full_name / name) sinon partie locale de l'email.
--
-- Verification prealable (facultatif) — lister les profils incomplets :
--   select id, nom, email from public.profiles where nom is null or btrim(nom) = '';

update public.profiles p
set nom = coalesce(
  nullif(u.raw_user_meta_data ->> 'nom', ''),
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  nullif(u.raw_user_meta_data ->> 'name', ''),
  split_part(u.email, '@', 1)
)
from auth.users u
where p.id = u.id
  and (p.nom is null or btrim(p.nom) = '');
