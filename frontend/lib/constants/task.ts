/**
 * Palette et libelles des statuts / priorites (requirements.md §7).
 *
 * « Une couleur associee a chaque statut de tache. » Les couleurs sont exposees
 * comme variables de theme dans app/globals.css (@theme) et referencees ici via
 * des classes utilitaires Tailwind v4, afin qu'un seul endroit definisse la palette.
 */
import type { TaskPriority, TaskStatus } from "@/lib/types/domain";

export interface StatusMeta {
  value: TaskStatus;
  label: string;
  /** Classes Tailwind pour les pastilles / colonnes Kanban. */
  badgeClassName: string;
  columnClassName: string;
  /** Pastille de couleur PLEINE (indice visuel du statut a cote d'un controle, vue Liste). */
  dotClassName: string;
}

/**
 * Ordre = ordre des colonnes Kanban (§4.3), du plus amont au plus terminal.
 * 6 statuts (reduction 9 -> 6, point 1). Les valeurs techniques restent en anglais /
 * snake_case ; les libelles FR (accentues) vivent ici. `sort.ts` derive STATUS_ORDER
 * de ce tableau.
 */
export const TASK_STATUSES: readonly StatusMeta[] = [
  {
    value: "a_planifier",
    label: "À planifier",
    badgeClassName: "bg-status-plan/15 text-status-plan",
    columnClassName: "border-status-plan/40",
    dotClassName: "bg-status-plan",
  },
  {
    value: "todo",
    label: "À faire",
    badgeClassName: "bg-status-todo/15 text-status-todo",
    columnClassName: "border-status-todo/40",
    dotClassName: "bg-status-todo",
  },
  {
    value: "in_progress",
    label: "En cours",
    badgeClassName: "bg-status-progress/15 text-status-progress",
    columnClassName: "border-status-progress/40",
    dotClassName: "bg-status-progress",
  },
  {
    value: "a_tester",
    label: "À tester",
    badgeClassName: "bg-status-test/15 text-status-test",
    columnClassName: "border-status-test/40",
    dotClassName: "bg-status-test",
  },
  {
    value: "a_corriger",
    label: "À corriger",
    badgeClassName: "bg-status-fix/15 text-status-fix",
    columnClassName: "border-status-fix/40",
    dotClassName: "bg-status-fix",
  },
  {
    value: "done",
    label: "Terminé",
    badgeClassName: "bg-status-done/15 text-status-done",
    columnClassName: "border-status-done/40",
    dotClassName: "bg-status-done",
  },
] as const;

export interface PriorityMeta {
  value: TaskPriority;
  label: string;
  /** Accent visuel selon la priorite (§7). */
  accentClassName: string;
}

export const TASK_PRIORITIES: readonly PriorityMeta[] = [
  { value: "low", label: "Basse", accentClassName: "border-l-priority-low" },
  { value: "medium", label: "Moyenne", accentClassName: "border-l-priority-medium" },
  { value: "high", label: "Haute", accentClassName: "border-l-priority-high" },
] as const;

export const STATUS_BY_VALUE: Record<TaskStatus, StatusMeta> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s]),
) as Record<TaskStatus, StatusMeta>;

export const PRIORITY_BY_VALUE: Record<TaskPriority, PriorityMeta> = Object.fromEntries(
  TASK_PRIORITIES.map((p) => [p.value, p]),
) as Record<TaskPriority, PriorityMeta>;
