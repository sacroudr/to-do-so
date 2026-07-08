/**
 * Tri des taches pour la vue Liste (requirements.md §4.4).
 *
 * Fonction PURE : ne mute jamais le tableau d'entree (renvoie une copie triee).
 *
 * Ordres de reference :
 *   - priorite : low < medium < high (ordre de TASK_PRIORITIES)
 *   - statut   : ordre des colonnes Kanban (ordre de TASK_STATUSES) -> a_qualifier <
 *                a_planifier < todo < in_progress < waiting < a_tester < a_corriger <
 *                done < archive
 *   - responsable : alphabetique (locale fr) sur le nom du 1er responsable
 *   - echeance (regle confirmee, §4.4) :
 *       1. les taches avec une DATE precise (`dueDate.date`) d'abord, triees par date
 *          croissante ;
 *       2. puis les taches avec seulement un TEXTE libre (`dueDate.text`), a la suite,
 *          triees par date de creation (`createdAt`) croissante.
 *   Le sens `desc` inverse l'ordre croissant obtenu (l'ensemble est renverse).
 */
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants/task";
import type { Task } from "@/lib/types/domain";

export type TaskSortKey = "dueDate" | "priorite" | "statut" | "assignee";
export type SortDirection = "asc" | "desc";

const PRIORITY_ORDER: readonly string[] = TASK_PRIORITIES.map((p) => p.value);
const STATUS_ORDER: readonly string[] = TASK_STATUSES.map((s) => s.value);

/** Comparateur ASCENDANT pour une cle de tri donnee. */
function compareAscending(a: Task, b: Task, key: TaskSortKey): number {
  switch (key) {
    case "priorite":
      return PRIORITY_ORDER.indexOf(a.priorite) - PRIORITY_ORDER.indexOf(b.priorite);

    case "statut":
      return STATUS_ORDER.indexOf(a.statut) - STATUS_ORDER.indexOf(b.statut);

    case "assignee": {
      const nameA = a.assignees[0]?.nom ?? "";
      const nameB = b.assignees[0]?.nom ?? "";
      return nameA.localeCompare(nameB, "fr");
    }

    case "dueDate": {
      // Les taches datees passent avant celles a echeance en texte libre.
      const rankA = a.dueDate.date ? 0 : 1;
      const rankB = b.dueDate.date ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;

      // Meme categorie : dates entre elles (ISO -> ordre chronologique),
      // textes libres entre eux par date de creation croissante.
      if (rankA === 0) {
        return (a.dueDate.date as string).localeCompare(b.dueDate.date as string);
      }
      return a.createdAt.localeCompare(b.createdAt);
    }

    default:
      return 0;
  }
}

export function sortTasks(
  tasks: Task[],
  key: TaskSortKey,
  direction: SortDirection = "asc",
): Task[] {
  const factor = direction === "desc" ? -1 : 1;
  return [...tasks].sort((a, b) => factor * compareAscending(a, b, key));
}
