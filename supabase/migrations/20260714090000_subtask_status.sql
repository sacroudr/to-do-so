-- 20260714090000_subtask_status.sql
-- Statut des sous-taches : remplace le booleen `is_done` par un STATUT a 6 valeurs,
-- IDENTIQUE a celui des taches principales (§4.2, extension).
--
-- ⚠️ CETTE MIGRATION TOUCHE DES DONNEES EXISTANTES (public.task_subtasks) :
--    la colonne `is_done` est convertie en `statut` puis SUPPRIMEE.
--    NE PAS appliquer sans confirmation explicite. C'est l'utilisateur qui pousse
--    lui-meme (`supabase db push`).
--
-- REUTILISATION de l'enum des taches : la colonne `statut` reprend EXACTEMENT le type
-- `public.task_status` (6 valeurs : a_planifier, todo, in_progress, a_tester, a_corriger,
-- done) cree/maintenu par 20260713090100_task_status_6_states.sql. Aucune variante n'est
-- introduite : meme type, memes libelles/valeurs que `public.tasks.statut`.
--
-- MAPPING BIJECTIF des lignes existantes (2 etats booleens -> 2 statuts) :
--   is_done = false  -> 'todo'  (« a faire »)   [= le nouveau DEFAULT de la colonne]
--   is_done = true   -> 'done'  (« termine »)
-- Le mapping est une bijection sur le sous-ensemble {todo, done} : aucune sous-tache
-- n'est perdue ni mal convertie (voir la requete de verification fournie avec la migration).
--
-- SEQUENCE SURE ET DETERMINISTE :
--   1. ADD COLUMN statut ... NOT NULL DEFAULT 'todo'  (toutes les lignes existantes
--      recoivent immediatement 'todo' -> NOT NULL satisfait des l'ajout ; le default
--      couvre aussi les futures insertions, equivalent de l'ancien `default false`).
--   2. BACKFILL : les lignes `is_done = true` passent a 'done'.
--   3. DROP COLUMN is_done (aucune dependance : vues/triggers/contraintes/RLS ne la
--      referencent pas ; le code backend/frontend est migre dans le meme lot).
-- L'enum lui-meme fait office de contrainte (valeurs bornees aux 6 statuts).
--
-- Guardee / rejouable : si la colonne `statut` existe deja, la migration est deja
-- appliquee et l'on sort sans rien faire.
--
-- PRECISION METIER : le statut d'une sous-tache n'a AUCUN impact sur l'archivage
-- automatique (qui ne concerne que les taches principales terminees depuis > 10 min).
-- Cette migration ne touche NI le trigger set_completed_at NI la logique d'archivage.

do $$
begin
  -- Idempotence : colonne deja presente -> deja applique -> skip.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'task_subtasks'
      and column_name = 'statut'
  ) then
    raise notice 'task_subtasks.statut existe deja : migration deja appliquee, skip.';
    return;
  end if;

  -- 1. Nouvelle colonne `statut` reprenant l'enum des taches, avec un defaut sur
  --    (« a faire ») pour les lignes existantes ET les futures insertions.
  alter table public.task_subtasks
    add column statut public.task_status not null default 'todo';

  -- 2. Backfill deterministe depuis `is_done` : true -> 'done' (false reste 'todo',
  --    deja pose par le default a l'etape 1).
  update public.task_subtasks
    set statut = 'done'
    where is_done = true;

  -- 3. Retrait de la colonne booleenne devenue obsolete.
  alter table public.task_subtasks
    drop column is_done;
end$$;

comment on column public.task_subtasks.statut is
  'Statut de la sous-tache (memes 6 valeurs que public.tasks.statut, enum public.task_status). Remplace l''ancien booleen is_done (false->todo, true->done).';
