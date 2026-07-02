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
}

/** Ordre = ordre des colonnes Kanban (§4.3). */
export const TASK_STATUSES: readonly StatusMeta[] = [
  {
    value: "todo",
    label: "A faire",
    badgeClassName: "bg-status-todo/15 text-status-todo",
    columnClassName: "border-status-todo/40",
  },
  {
    value: "in_progress",
    label: "En cours",
    badgeClassName: "bg-status-progress/15 text-status-progress",
    columnClassName: "border-status-progress/40",
  },
  {
    value: "waiting",
    label: "En attente",
    badgeClassName: "bg-status-waiting/15 text-status-waiting",
    columnClassName: "border-status-waiting/40",
  },
  {
    value: "blocked",
    label: "Bloque",
    badgeClassName: "bg-status-blocked/15 text-status-blocked",
    columnClassName: "border-status-blocked/40",
  },
  {
    value: "done",
    label: "Termine",
    badgeClassName: "bg-status-done/15 text-status-done",
    columnClassName: "border-status-done/40",
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
