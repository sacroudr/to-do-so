-- 20260713090100_task_status_6_states.sql
-- Reduction des statuts de tache : 9 -> 6 (point 1).
--
-- ⚠️ CETTE MIGRATION TOUCHE DES DONNEES EXISTANTES (public.tasks.statut) :
--    les statuts « a_qualifier », « waiting » et « archive » sont SUPPRIMES et remappes.
--    NE PAS appliquer sans confirmation explicite (voir le recap ci-dessous).
--    C'est l'utilisateur qui pousse lui-meme (`supabase db push`).
--
-- Statuts finaux, dans l'ordre du flux Kanban :
--   a_planifier, todo, in_progress, a_tester, a_corriger, done
-- Remap des donnees :
--   a_qualifier -> a_planifier
--   waiting     -> todo
--   archive     -> done      (+ completed_at renseigne : ces lignes basculent en Archive
--                             et NE reapparaissent PAS dans la colonne active « Terminé »)
--
-- Approche = SWAP d'enum (sur le modele de 20260707093000_task_status_9_states.sql) :
-- nouvel enum 6 valeurs -> drop default -> ALTER COLUMN USING CASE (remap) -> nouveau
-- default 'a_planifier' -> drop ancien type -> rename. GUARDEE / rejouable : si l'enum
-- ne contient plus « archive », la migration est deja appliquee -> skip.
--
-- SEQUENCE : s'applique APRES 20260713090000_task_completed_at.sql (la colonne
-- completed_at et son trigger existent deja).
--
-- --- Requete de recap LECTURE SEULE (a lancer AVANT, non executee ici) : volume par
--     ancien statut, pour mesurer l'impact du remap :
--       select statut, count(*) from public.tasks group by statut order by statut;

do $$
begin
  -- Idempotence : si « archive » n'est plus une valeur de l'enum, deja applique -> skip.
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'task_status' and e.enumlabel = 'archive'
  ) then
    raise notice 'task_status ne contient plus « archive » : reduction 9 -> 6 deja appliquee, skip.';
    return;
  end if;

  -- 1. Nouveau type enum avec les 6 valeurs, dans l'ordre du flux Kanban.
  create type public.task_status_new as enum (
    'a_planifier',
    'todo',
    'in_progress',
    'a_tester',
    'a_corriger',
    'done'
  );

  -- 2. Retirer le defaut AVANT l'ALTER TYPE (l'ancien defaut n'est pas castable
  --    automatiquement vers le nouveau type pendant la conversion de la colonne).
  alter table public.tasks alter column statut drop default;

  -- 3. Convertir la colonne avec le remap (a_qualifier/waiting/archive -> ...).
  alter table public.tasks
    alter column statut type public.task_status_new
    using (
      case statut::text
        when 'a_qualifier' then 'a_planifier'
        when 'waiting'     then 'todo'
        when 'archive'     then 'done'
        else statut::text
      end::public.task_status_new
    );

  -- 4. Nouveau defaut = premier statut du flux (« a planifier »). Aligne le default DB
  --    sur le default Pydantic backend (TaskStatus.A_PLANIFIER).
  alter table public.tasks alter column statut set default 'a_planifier';

  -- 5. Remplacer l'ancien type par le nouveau (on reprend le nom 'task_status').
  drop type public.task_status;
  alter type public.task_status_new rename to task_status;

  -- 6. Lignes anciennement « archive » (desormais « done ») : renseigner completed_at
  --    = coalesce(updated_at, now()) pour qu'elles soient traitees comme ARCHIVEES
  --    (done depuis > 10 min) et n'apparaissent pas dans la colonne active « Terminé ».
  --    On cible `completed_at is null` : les lignes deja 'done' AVANT cette migration
  --    ont deja recu leur completed_at (backfill de 20260713090000). La conversion
  --    d'enum (ALTER TABLE) ne declenche PAS le trigger set_completed_at ; il faut donc
  --    ce UPDATE explicite. Ce UPDATE, lui, declenche le trigger : old.statut='done'
  --    ET new.statut='done' -> aucune des branches ne s'active -> completed_at preserve.
  update public.tasks
    set completed_at = coalesce(updated_at, now())
    where statut = 'done' and completed_at is null;
end$$;

-- Rappel evolutivite : pour AJOUTER un statut plus tard sans swap complet,
--   ALTER TYPE public.task_status ADD VALUE '<nouvelle_valeur>' [BEFORE|AFTER '<autre>'];
-- (et mettre a jour le code frontend/backend en meme temps).
