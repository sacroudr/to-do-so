"use client";

import { Pencil, X } from "lucide-react";

import { TaskAttachments } from "@/components/tasks/task-attachments";
import { TaskSubtasks } from "@/components/tasks/task-subtasks";
import { DueDate } from "@/components/ui/due-date";
import { Modal } from "@/components/ui/modal";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { pluralize } from "@/lib/i18n/plural";
import type { Task } from "@/lib/types/domain";

/**
 * Panneau de detail d'une tache en LECTURE SEULE (requirements.md §4.2).
 *
 * Partage a l'identique par la vue Kanban (`kanban-board`) et la vue Liste
 * (`task-table`) : un clic sur une carte / une ligne l'ouvre et affiche TOUS les
 * champs (titre, description, projet, responsables, echeance, statut, priorite,
 * source, dates). Le bouton « Modifier » bascule vers le `TaskFormDialog` (mode
 * edition) via le callback `onEdit`. Les pieces jointes (§5) s'affichent ici aussi.
 */
function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function TaskDetailDialog({
  open,
  task,
  onClose,
  onEdit,
}: {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
}) {
  if (!open || task === null) return null;

  const assigneeNames = task.assignees.map((a) => a.nom).join(", ");

  return (
    <Modal open={open} onClose={onClose} labelledBy="task-detail-title" className="max-w-lg">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-2">
          <h2 id="task-detail-title" className="text-lg font-semibold tracking-tight">
            {task.titre}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.statut} />
            <PriorityBadge priority={task.priorite} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Projet">{task.project?.nom ?? "Sans projet"}</Field>
          <Field label={pluralize(task.assignees.length, "Responsable", "Responsables")}>
            {assigneeNames || "Non assigné"}
          </Field>
          <Field label="Échéance">
            <DueDate due={task.dueDate} statut={task.statut} className="text-sm" />
          </Field>
          <Field label="Source">{task.source ?? "—"}</Field>
          <Field label="Créée le">{formatDateTime(task.createdAt)}</Field>
          <Field label="Mise à jour le">{formatDateTime(task.updatedAt)}</Field>
        </dl>

        <div className="space-y-0.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            Description
          </dt>
          <dd className="whitespace-pre-wrap text-sm text-foreground">
            {task.description?.trim() ? (
              task.description
            ) : (
              <span className="text-muted-foreground">Aucune description.</span>
            )}
          </dd>
        </div>

        <div className="border-t border-border pt-4">
          <TaskSubtasks taskId={task.id} />
        </div>

        <div className="border-t border-border pt-4">
          <TaskAttachments taskId={task.id} />
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/5"
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
        >
          <Pencil className="size-4" />
          Modifier
        </button>
      </footer>
    </Modal>
  );
}
