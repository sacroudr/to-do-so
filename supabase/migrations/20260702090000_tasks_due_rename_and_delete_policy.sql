-- 20260702090000_tasks_due_rename_and_delete_policy.sql
-- Aligne le schema `tasks` sur les decisions de conception Phase 2 :
--
--  1. ECHEANCE (§4.2) : renomme la colonne `due_label` -> `due_date_text` pour
--     s'aligner sur le DTO API, les types frontend et les tests (une seule source de
--     nommage : plus de mapping). Ajoute la contrainte « EXACTEMENT UN » des deux
--     champs d'echeance (date precise XOR texte libre), jusqu'ici seulement appliquee
--     cote API (Pydantic) — la base devient defense en profondeur.
--
--  2. SUPPRESSION (§4.2 / §3) : n'importe quel membre authentifie peut supprimer
--     n'importe quelle tache. On remplace la policy obsolete
--     `tasks_delete_owner_or_assignee` (auteur OU responsable) par une policy ouverte
--     `tasks_delete_authenticated` (`using (true)`), coherente avec l'UPDATE.
--
-- Idempotente / rejouable (if exists / rename conditionnel).

-- ---------------------------------------------------------------------------
-- 1. Renommage de la colonne d'echeance libre.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_label'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_date_text'
  ) then
    alter table public.tasks rename column due_label to due_date_text;
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 1bis. Contrainte « exactement une echeance » : due_date XOR due_date_text.
-- (due_date_text vide '' est traite comme non renseigne cote API ; on considere ici
--  la nullite au niveau colonne, l'API normalisant les chaines vides en NULL.)
-- ---------------------------------------------------------------------------
alter table public.tasks drop constraint if exists tasks_due_exactly_one;
alter table public.tasks
  add constraint tasks_due_exactly_one
  check ((due_date is not null) <> (due_date_text is not null));

-- ---------------------------------------------------------------------------
-- 2. Policy de suppression ouverte a tout membre authentifie (remplace l'obsolete).
-- ---------------------------------------------------------------------------
drop policy if exists "tasks_delete_owner_or_assignee" on public.tasks;

drop policy if exists "tasks_delete_authenticated" on public.tasks;
create policy "tasks_delete_authenticated"
  on public.tasks for delete
  to authenticated
  using (true);
