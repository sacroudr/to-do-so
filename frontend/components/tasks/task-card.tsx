import { Pencil, Trash2 } from "lucide-react";
import type { DragEvent, KeyboardEvent } from "react";

import { DueDate } from "@/components/ui/due-date";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { SubtaskProgress } from "@/components/ui/subtask-progress";
import { PRIORITY_BY_VALUE } from "@/lib/constants/task";
import { assigneesLabel } from "@/lib/team/name";
import type { Task } from "@/lib/types/domain";

/**
 * Carte de tache pour la vue Kanban (requirements.md §4.3).
 *
 * Affiche titre, projet, responsable(s), echeance et priorite. L'accent visuel de
 * priorite (§7) est une bordure gauche coloree. Les `data-testid` constituent le
 * contrat des tests E2E ; `data-*` (task-id, project-id, assignee-ids) servent au
 * glisser-deposer et aux filtres.
 *
 * Un clic sur la carte ouvre le panneau de detail (§4.2, `onOpenDetail`), SANS
 * declencher le glisser-deposer ni les boutons crayon/corbeille (qui stoppent la
 * propagation). Acces clavier : la carte est focusable et reagit a Entree / Espace.
 */
export interface TaskCardProps {
  task: Task;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>, task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onOpenDetail?: (task: Task) => void;
}

export function TaskCard({
  task,
  draggable = false,
  onDragStart,
  onEdit,
  onDelete,
  onOpenDetail,
}: TaskCardProps) {
  const priorityAccent = PRIORITY_BY_VALUE[task.priorite].accentClassName;
  const assigneeNames = assigneesLabel(task.assignees);

  // Ouvre le detail au clavier UNIQUEMENT si le focus est sur la carte elle-meme
  // (pas sur un bouton interne), pour ne pas capturer Entree/Espace des actions.
  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (!onOpenDetail || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetail(task);
    }
  }

  return (
    <article
      data-testid="task-card"
      data-task-id={task.id}
      data-project-id={task.projectId ?? ""}
      data-assignee-ids={task.assignees.map((a) => a.id).join(",")}
      draggable={draggable}
      onDragStart={onDragStart ? (event) => onDragStart(event, task) : undefined}
      onClick={onOpenDetail ? () => onOpenDetail(task) : undefined}
      onKeyDown={onOpenDetail ? handleKeyDown : undefined}
      role={onOpenDetail ? "button" : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      aria-label={onOpenDetail ? `Voir le détail de la tâche ${task.titre}` : undefined}
      className={`group cursor-grab rounded-xl border border-border border-l-4 bg-surface p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:shadow-md active:cursor-grabbing ${priorityAccent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          data-testid="task-card-title"
          className="text-sm font-semibold leading-snug text-foreground"
        >
          {task.titre}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onEdit ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(task);
              }}
              aria-label="Modifier la tâche"
              className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(task);
              }}
              aria-label="Supprimer la tâche"
              className="rounded-md p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
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
        {assigneeNames}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <DueDate
            due={task.dueDate}
            statut={task.statut}
            testId="task-card-due"
            className="text-xs"
          />
          <SubtaskProgress progress={task.subtaskProgress} />
        </div>
        <span data-testid="task-card-priority">
          <PriorityBadge priority={task.priorite} />
        </span>
      </div>
    </article>
  );
}
