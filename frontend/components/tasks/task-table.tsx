"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DueDate } from "@/components/ui/due-date";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { SubtaskProgress } from "@/components/ui/subtask-progress";
import { useToast } from "@/components/ui/toast";
import { deleteTaskAction, updateTaskStatusAction } from "@/lib/api/actions";
import { STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants/task";
import { getDueKind } from "@/lib/tasks/due";
import { sortTasks, type SortDirection, type TaskSortKey } from "@/lib/tasks/sort";
import { assigneesLabel } from "@/lib/team/name";
import type { Project, Task, TaskStatus, TeamMember } from "@/lib/types/domain";

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
  { testid: "assignee", key: "assignee", label: "Responsable" },
  { testid: "due", key: "dueDate", label: "Échéance" },
  { testid: "priorite", key: "priorite", label: "Priorité" },
  { testid: "statut", key: "statut", label: "Statut" },
] as const;

interface SortState {
  key: TaskSortKey;
  direction: SortDirection;
}

/**
 * Contexte d'affichage de la table. En `archive` (§ page Archive), l'edition d'une tache
 * terminee n'est pas pertinente (bouton crayon masque) et sortir une tache de « Terminé »
 * la DESARCHIVE — on le signale alors explicitement par une notification.
 */
export type TaskTableContext = "default" | "archive";

export function TaskTable({
  tasks: tasksProp,
  projects,
  members,
  context = "default",
}: {
  tasks: Task[];
  projects: Project[];
  members: TeamMember[];
  context?: TaskTableContext;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>(tasksProp);
  const [sort, setSort] = useState<SortState | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
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
    const previous = tasks.find((t) => t.id === taskId)?.statut;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, statut } : t)));
    startTransition(async () => {
      const result = await updateTaskStatusAction(taskId, statut);
      if (result.ok) {
        router.refresh();
        // Sortir une tache de « Terminé » depuis l'archive la desarchive (trigger DB).
        if (context === "archive" && previous === "done" && statut !== "done") {
          toast.info("Tâche sortie de l'archive.");
        } else {
          toast.success(`Statut mis à jour : « ${STATUS_BY_VALUE[statut].label} ».`);
        }
      } else {
        setTasks(tasksProp);
        toast.error(result.error ?? "Le changement de statut a échoué.");
      }
    });
  }

  function confirmDelete(): void {
    const task = pendingDelete;
    if (!task) return;
    setPendingDelete(null);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    startTransition(async () => {
      const result = await deleteTaskAction(task.id);
      if (result.ok) {
        router.refresh();
        toast.success(`Tâche « ${task.titre} » supprimée.`);
      } else {
        setTasks(tasksProp);
        toast.error(result.error ?? "La suppression de la tâche a échoué.");
      }
    });
  }

  return (
    <>
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
                  Aucune tâche à afficher.
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
                  onClick={() => setDetailTask(task)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailTask(task);
                        }}
                        className="text-left hover:text-primary"
                      >
                        {task.titre}
                      </button>
                      <SubtaskProgress progress={task.subtaskProgress} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {task.project?.nom ?? "Sans projet"}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    {assigneesLabel(task.assignees)}
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
                    {/*
                      Controle de statut UNIQUE (§ Simplicite) : une pastille de couleur
                      (indice visuel, jamais la couleur seule) + un select portant l'unique
                      libelle. Remplace le doublon badge lecture + select qui affichait deux
                      fois le statut.
                    */}
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`size-2 shrink-0 rounded-full ${STATUS_BY_VALUE[task.statut].dotClassName}`}
                      />
                      <select
                        data-testid="row-status-select"
                        aria-label="Changer le statut"
                        value={task.statut}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => changeStatus(task.id, e.target.value as TaskStatus)}
                        className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs font-medium outline-none focus:border-primary"
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
                      {context !== "archive" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTask(task);
                          }}
                          aria-label="Modifier la tâche"
                          className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        >
                          <Pencil className="size-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(task);
                        }}
                        aria-label="Supprimer la tâche"
                        className="rounded-md p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
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

      <TaskDetailDialog
        open={detailTask !== null}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onEdit={(task) => {
          setDetailTask(null);
          setEditingTask(task);
        }}
      />

      <TaskFormDialog
        open={editingTask !== null}
        mode="edit"
        task={editingTask}
        projects={projects}
        members={members}
        onClose={() => setEditingTask(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer la tâche"
        message={
          pendingDelete
            ? `La tâche « ${pendingDelete.titre} » sera définitivement supprimée.`
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
