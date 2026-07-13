-- 20260713090000_task_completed_at.sql
-- Horodatage d'achevement d'une tache (evolution « Archive », point 4).
--
-- ⚠️ NE PAS appliquer sans confirmation explicite (l'agent principal presente ce SQL
--    a l'utilisateur ; c'est lui qui pousse : `supabase db push`).
--
-- Objectif : `public.tasks.completed_at` memorise l'instant ou une tache passe a
-- « done ». Une tache est consideree ARCHIVEE (masquee des vues actives, visible
-- seulement dans la page Archive) des que : statut = 'done' ET completed_at
-- < now() - interval '10 minutes'. Le filtre d'archive est calcule a la LECTURE
-- (dynamique, cote API) ; cette colonne ne fait que fournir l'horloge.
--
-- Regles (implementees par trigger BEFORE INSERT OR UPDATE, idiomatique ici cf.
-- public.set_updated_at()) :
--   * passe a 'done' (INSERT en 'done' OU transition <>'done' -> 'done') : completed_at = now()
--   * quitte 'done' (statut <> 'done')                                    : completed_at = null
--   * reste 'done' sans changement                                        : completed_at PRESERVE
--     (ne PAS reinitialiser -> preserve l'horloge des 10 min).
--
-- Migration idempotente / rejouable (add column if not exists, backfill garde,
-- create or replace function, drop/create trigger).
--
-- SEQUENCE : ce fichier s'applique AVANT 20260713090100_task_status_6_states.sql,
-- qui remappe archive->done et renseigne completed_at pour ces lignes (voir ce fichier).
--
-- --- Requete de recap LECTURE SEULE (a lancer AVANT, non executee ici) : combien de
--     taches deja 'done' vont recevoir un completed_at par le backfill ci-dessous ?
--       select count(*) as done_a_backfiller
--       from public.tasks
--       where statut = 'done' and completed_at is null;

-- 1. Colonne d'horodatage d'achevement (nullable : une tache non terminee n'en a pas).
alter table public.tasks
  add column if not exists completed_at timestamptz;

comment on column public.tasks.completed_at is
  'Instant de passage a done ; alimente le filtre d''archive (done depuis > 10 min). '
  'Maintenu par le trigger public.set_completed_at().';

-- 2. Backfill des taches DEJA 'done' (historique) : completed_at = updated_at, pour un
--    comportement d'archive sensé sur l'existant. Fait AVANT la creation du trigger
--    (simple UPDATE, pas d'interaction). Garde `completed_at is null` -> rejouable.
update public.tasks
  set completed_at = updated_at
  where statut = 'done' and completed_at is null;

-- 3. Fonction de maintien de completed_at.
create or replace function public.set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.statut = 'done'
     and (tg_op = 'INSERT' or old.statut is distinct from 'done') then
    -- Passe a 'done' (creation directe en done, ou transition depuis un autre statut).
    new.completed_at := now();
  elsif new.statut <> 'done' then
    -- Quitte (ou n'atteint pas) 'done' : plus d'horodatage d'achevement.
    new.completed_at := null;
  end if;
  -- Cas restant (reste 'done' sans changement) : completed_at inchange (preserve).
  return new;
end;
$$;

-- 4. Trigger BEFORE INSERT OR UPDATE (coexiste avec tasks_set_updated_at ; both BEFORE,
--    independants — chacun ne touche que sa colonne).
drop trigger if exists tasks_set_completed_at on public.tasks;
create trigger tasks_set_completed_at
  before insert or update on public.tasks
  for each row execute function public.set_completed_at();
