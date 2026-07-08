-- 20260707093000_task_status_9_states.sql
-- Refonte des statuts de tache : 5 -> 9 (requirements.md §4.3).
--
-- ⚠️ CETTE MIGRATION TOUCHE DES DONNEES EXISTANTES (colonne public.tasks.statut) :
--    le statut « blocked » est RETIRE et les taches concernees migrent vers « waiting ».
--    NE PAS appliquer sans confirmation explicite (voir le recap des comptes par statut
--    fourni avec cette migration). L'utilisateur pousse lui-meme (`supabase db push`).
--
-- Approche = SWAP d'enum : on cree un nouvel enum avec les 9 valeurs DANS L'ORDRE du
-- flux Kanban, on convertit la colonne (blocked -> waiting), on fixe le nouveau defaut
-- « a_qualifier », puis on remplace l'ancien type. On gere le DROP DEFAULT avant
-- l'ALTER TYPE. Migration GUARDEE / rejouable : si l'enum contient deja « a_qualifier »
-- (deja appliquee), on ne fait rien.
--
-- Nouveaux statuts (ordre) :
--   a_qualifier, a_planifier, todo, in_progress, waiting, a_tester, a_corriger,
--   done, archive
-- (todo / in_progress / waiting / done : cles inchangees.)

do $$
begin
  -- Idempotence : si la refonte est deja appliquee, on sort sans rien faire.
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'task_status' and e.enumlabel = 'a_qualifier'
  ) then
    raise notice 'task_status contient deja « a_qualifier » : migration deja appliquee, skip.';
    return;
  end if;

  -- 1. Nouveau type enum avec les 9 valeurs, dans l'ordre du flux Kanban.
  create type public.task_status_new as enum (
    'a_qualifier',
    'a_planifier',
    'todo',
    'in_progress',
    'waiting',
    'a_tester',
    'a_corriger',
    'done',
    'archive'
  );

  -- 2. Retirer le defaut AVANT l'ALTER TYPE (le defaut 'todo' n'est pas castable
  --    automatiquement vers le nouveau type pendant la conversion de la colonne).
  alter table public.tasks alter column statut drop default;

  -- 3. Convertir la colonne : « blocked » -> « waiting », sinon valeur conservee.
  alter table public.tasks
    alter column statut type public.task_status_new
    using (
      case statut::text
        when 'blocked' then 'waiting'
        else statut::text
      end::public.task_status_new
    );

  -- 4. Nouveau defaut = premier statut du flux (« a qualifier »).
  alter table public.tasks alter column statut set default 'a_qualifier';

  -- 5. Remplacer l'ancien type par le nouveau (on reprend le nom 'task_status').
  drop type public.task_status;
  alter type public.task_status_new rename to task_status;
end$$;

-- Rappel evolutivite : pour AJOUTER un statut plus tard sans swap complet,
--   ALTER TYPE public.task_status ADD VALUE '<nouvelle_valeur>' [BEFORE|AFTER '<autre>'];
-- (et mettre a jour le code frontend/backend en meme temps).
