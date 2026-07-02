"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { ActionError } from "@/components/ui/action-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DueDate } from "@/components/ui/due-date";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { deleteTaskAction, updateTaskStatusAction } from "@/lib/api/actions";
import { TASK_STATUSES } from "@/lib/constants/task";
import { getDueKind } from "@/lib/tasks/due";
import { sortTasks, type SortDirection, type TaskSortKey } from "@/lib/tasks/sort";
import type { Profile, Project, Task, TaskStatus } from "@/lib/types/domain";

/**
 * Vue Liste (requirements.md §4.4).
 *
 * Tableau de l'ensemble des taches, triable par echeance, priorite, statut ou
 * responsable (clic sur l'en-tete -> ascendant, re-clic -> descendant, avec
 * `aria-sort`). Memes donnees / actions que le Kanban (changement de statut en ligne,
 * edition, suppression).
 */
interface SortableColumn {
  /** Suffixe du data-testid (contrat E2E) : sort-<testid>. */
  testid: string;
  /** Cle de tri passee a `sortTasks`. */
  key: TaskSortKey;
  label: string;
}

const SORTABLE_COLUMNS: readonly SortableColumn[] = [
  { testid: "assignee", key: "assignee", label: "Responsable(s)" },
  { testid: "due", key: "dueDate", label: "Echeance" },
  { testid: "priorite", key: "priorite", label: "Priorite" },
  { testid: "statut", key: "statut", label: "Statut" },
] as const;

interface SortState {
  key: TaskSortKey;
  direction: SortDirection;
}

export function TaskTable({
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
  const [sort, setSort] = useState<SortState | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Resynchronise sur les donnees serveur (pattern « ajustement au rendu », sans effet).
  const [syncedProp, setSyncedProp] = useState<Task[]>(tasksProp);
  if (syncedProp !== tasksProp) {
    setSyncedProp(tasksProp);
    setTasks(tasksProp);
  }

  const displayedTasks = useMemo(
    () => (sort ? sortTasks(tasks, sort.key, sort.direction) : tasks),
    [tasks, sort],
  );

  function toggleSort(key: TaskSortKey): void {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  }

  function ariaSort(key: TaskSortKey): "ascending" | "descending" | "none" {
    if (sort?.key !== key) return "none";
    return sort.direction === "asc" ? "ascending" : "descending";
  }

  function SortIcon({ column }: { column: TaskSortKey }) {
    if (sort?.key !== column) {
      return <ChevronsUpDown className="size-3.5 text-muted-foreground/60" />;
    }
    return sort.direction === "asc" ? (
      <ArrowUp className="size-3.5 text-primary" />
    ) : (
      <ArrowDown className="size-3.5 text-primary" />
    );
  }

  function changeStatus(taskId: string, statut: TaskStatus): void {
    setActionError(null);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, statut } : t)));
    startTransition(async () => {
      const result = await updateTaskStatusAction(taskId, statut);
      if (result.ok) router.refresh();
      else {
        setTasks(tasksProp);
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
      if (result.ok) router.refresh();
      else {
        setTasks(tasksProp);
        setActionError(result.error ?? "La suppression de la tache a echoue.");
      }
    });
  }

  return (
    <>
      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table data-testid="task-table" className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Titre
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Projet
              </th>
              {SORTABLE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  data-testid={`sort-${col.testid}`}
                  aria-sort={ariaSort(col.key)}
                  className="px-4 py-3 font-medium"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    <SortIcon column={col.key} />
                  </button>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Aucune tache a afficher.
                </td>
              </tr>
            ) : (
              displayedTasks.map((task) => (
                <tr
                  key={task.id}
                  data-testid="task-row"
                  data-task-id={task.id}
                  data-due-kind={getDueKind(task.dueDate)}
                  data-project-id={task.projectId ?? ""}
                  data-assignee-ids={task.assignees.map((a) => a.id).join(",")}
                  className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{task.titre}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {task.project?.nom ?? "Sans projet"}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    {task.assignees.map((a) => a.nom).join(", ") || "Non assigne"}
                  </td>
                  <td className="px-4 py-3">
                    <DueDate
                      due={task.dueDate}
                      statut={task.statut}
                      className="text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priorite} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={task.statut} />
                      <select
                        data-testid="row-status-select"
                        aria-label="Changer le statut"
                        value={task.statut}
                        onChange={(e) => changeStatus(task.id, e.target.value as TaskStatus)}
                        className="cursor-pointer rounded-md border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingTask(task)}
                        aria-label="Modifier la tache"
                        className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(task)}
                        aria-label="Supprimer la tache"
                        className="rounded-md p-1 text-muted-foreground hover:bg-status-blocked/10 hover:text-status-blocked"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
