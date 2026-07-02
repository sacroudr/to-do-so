"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";

import { TaskCard } from "@/components/tasks/task-card";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { ActionError } from "@/components/ui/action-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTaskAction, updateTaskStatusAction } from "@/lib/api/actions";
import { TASK_STATUSES } from "@/lib/constants/task";
import type { Profile, Project, Task, TaskStatus } from "@/lib/types/domain";

/**
 * Vue Kanban (requirements.md §4.3).
 *
 * Une colonne par statut ; les cartes se glissent-deposent d'une colonne a l'autre
 * (API HTML5 native) pour changer de statut, avec mise a jour OPTIMISTE puis
 * persistance via Server Action (revert en cas d'echec). Memes actions que la Liste
 * (edition, suppression).
 */
const DRAG_MIME = "text/plain";

export function KanbanBoard({
  tasks: tasksProp,
  projects,
  profiles,
}: {
  tasks: Task[];
  projects: Project[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(tasksProp);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Resynchronise sur les donnees serveur (apres revalidation / navigation) via le
  // pattern « ajustement d'etat au rendu » : quand la reference des taches serveur
  // change, on realigne l'etat local (sans effet -> pas de rendu en cascade).
  const [syncedProp, setSyncedProp] = useState<Task[]>(tasksProp);
  if (syncedProp !== tasksProp) {
    setSyncedProp(tasksProp);
    setTasks(tasksProp);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, task: Task): void {
    event.dataTransfer.setData(DRAG_MIME, task.id);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: TaskStatus): void {
    event.preventDefault();
    setOverStatus(null);
    const taskId = event.dataTransfer.getData(DRAG_MIME);
    moveTask(taskId, status);
  }

  function moveTask(taskId: string, status: TaskStatus): void {
    const current = tasks.find((t) => t.id === taskId);
    if (!current || current.statut === status) return;

    // Mise a jour optimiste.
    setActionError(null);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, statut: status } : t)),
    );

    startTransition(async () => {
      const result = await updateTaskStatusAction(taskId, status);
      if (result.ok) {
        router.refresh();
      } else {
        setTasks(tasksProp); // revert vers l'etat serveur
        setActionError(result.error ?? "Le changement de statut a echoue.");
      }
    });
  }

  function confirmDelete(): void {
    const task = pendingDelete;
    if (!task) return;
    setPendingDelete(null);
    setActionError(null);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    startTransition(async () => {
      const result = await deleteTaskAction(task.id);
      if (result.ok) {
        router.refresh();
      } else {
        setTasks(tasksProp);
        setActionError(result.error ?? "La suppression de la tache a echoue.");
      }
    });
  }

  return (
    <>
      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((t) => t.statut === status.value);
          const isOver = overStatus === status.value;
          return (
            <section
              key={status.value}
              data-testid="kanban-column"
              data-status={status.value}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverStatus(status.value);
              }}
              onDragLeave={() => setOverStatus((s) => (s === status.value ? null : s))}
              onDrop={(e) => handleDrop(e, status.value)}
              className={`flex min-h-64 flex-col rounded-xl border-t-4 bg-surface-muted/60 transition-colors ${status.columnClassName} ${
                isOver ? "ring-2 ring-primary/40" : ""
              }`}
            >
              <header className="flex items-center justify-between px-3 py-3">
                <span className="text-sm font-semibold">{status.label}</span>
                <span className="rounded-full bg-foreground/5 px-2 text-xs text-muted-foreground">
                  {columnTasks.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2 px-2 pb-3">
                {columnTasks.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                    Aucune tache
                  </p>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      draggable
                      onDragStart={handleDragStart}
                      onEdit={setEditingTask}
                      onDelete={setPendingDelete}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <TaskFormDialog
        open={editingTask !== null}
        mode="edit"
        task={editingTask}
        projects={projects}
        profiles={profiles}
        onClose={() => setEditingTask(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer la tache"
        message={
          pendingDelete
            ? `La tache « ${pendingDelete.titre} » sera definitivement supprimee.`
            : ""
        }
        confirmLabel="Supprimer"
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
