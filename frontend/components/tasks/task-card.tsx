import { Pencil, Trash2 } from "lucide-react";
import type { DragEvent } from "react";

import { PriorityBadge } from "@/components/ui/priority-badge";
import { PRIORITY_BY_VALUE } from "@/lib/constants/task";
import { formatDue } from "@/lib/tasks/due";
import type { Task } from "@/lib/types/domain";

/**
 * Carte de tache pour la vue Kanban (requirements.md §4.3).
 *
 * Affiche titre, projet, responsable(s), echeance et priorite. L'accent visuel de
 * priorite (§7) est une bordure gauche coloree. Les `data-testid` constituent le
 * contrat des tests E2E ; `data-*` (task-id, project-id, assignee-ids) servent au
 * glisser-deposer et aux filtres.
 */
export interface TaskCardProps {
  task: Task;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>, task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export function TaskCard({
  task,
  draggable = false,
  onDragStart,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const priorityAccent = PRIORITY_BY_VALUE[task.priorite].accentClassName;
  const assigneeNames = task.assignees.map((a) => a.nom).join(", ");

  return (
    <article
      data-testid="task-card"
      data-task-id={task.id}
      data-project-id={task.projectId ?? ""}
      data-assignee-ids={task.assignees.map((a) => a.id).join(",")}
      draggable={draggable}
      onDragStart={onDragStart ? (event) => onDragStart(event, task) : undefined}
      className={`group cursor-grab rounded-xl border border-border border-l-4 bg-surface p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${priorityAccent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          data-testid="task-card-title"
          className="text-sm font-semibold leading-snug text-foreground"
        >
          {task.titre}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(task)}
              aria-label="Modifier la tache"
              className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(task)}
              aria-label="Supprimer la tache"
              className="rounded-md p-1 text-muted-foreground hover:bg-status-blocked/10 hover:text-status-blocked"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <p data-testid="task-card-project" className="mt-2 text-xs text-muted-foreground">
        {task.project?.nom ?? "Sans projet"}
      </p>

      <p data-testid="task-card-assignees" className="mt-1 text-xs text-foreground/80">
        {assigneeNames || "Non assigne"}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span data-testid="task-card-due" className="text-xs text-muted-foreground">
          {formatDue(task.dueDate)}
        </span>
        <span data-testid="task-card-priority">
          <PriorityBadge priority={task.priorite} />
        </span>
      </div>
    </article>
  );
}
