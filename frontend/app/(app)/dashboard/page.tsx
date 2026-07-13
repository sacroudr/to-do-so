import Link from "next/link";

import { DueDate } from "@/components/ui/due-date";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { getBoardData } from "@/lib/api/board";
import { TASK_STATUSES } from "@/lib/constants/task";
import { memberFullName } from "@/lib/team/name";
import type { Task } from "@/lib/types/domain";

/**
 * Tableau de bord / accueil (requirements.md §4.7, §10).
 *
 * Server Component : charge TOUTES les taches de l'equipe via l'API (aucun filtre)
 * puis calcule la synthese (compteurs par statut, echeances a venir, taches bloquees).
 * Les Server Actions de mutation revalident `/dashboard` : une tache creee / modifiee
 * apparait donc automatiquement, sans rechargement manuel.
 */
const MAX_UPCOMING = 6;

function upcomingTasks(tasks: Task[]): Task[] {
  const today = new Date().toISOString().slice(0, 10);
  // Etat terminal (termine) exclu des echeances a venir.
  return tasks
    .filter(
      (t) => t.dueDate.date && t.dueDate.date >= today && t.statut !== "done",
    )
    .sort((a, b) => (a.dueDate.date as string).localeCompare(b.dueDate.date as string))
    .slice(0, MAX_UPCOMING);
}

function TaskLine({ task }: { task: Task }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{task.titre}</p>
        <p className="truncate text-xs text-muted-foreground">
          {task.project?.nom ?? "Sans projet"}
          {task.assignees.length > 0
            ? ` · ${task.assignees.map(memberFullName).join(", ")}`
            : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <DueDate due={task.dueDate} statut={task.statut} className="text-xs tabular-nums" />
        <PriorityBadge priority={task.priorite} />
      </div>
    </li>
  );
}

export default async function DashboardPage() {
  const { tasks } = await getBoardData();

  const countByStatus = new Map<string, number>();
  for (const task of tasks) {
    countByStatus.set(task.statut, (countByStatus.get(task.statut) ?? 0) + 1);
  }

  const upcoming = upcomingTasks(tasks);
  // Les statuts « en attente » / « archive » ont ete retires (reduction 9 -> 6) ; on met
  // en avant le travail actif « En cours ».
  const inProgress = tasks.filter((t) => t.statut === "in_progress");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble des tâches de l&apos;équipe.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TASK_STATUSES.map((status) => (
          <Link
            key={status.value}
            href="/kanban"
            className="rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md"
          >
            <StatusBadge status={status.value} />
            <p className="mt-3 text-3xl font-semibold tabular-nums">
              {countByStatus.get(status.value) ?? 0}
            </p>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">Échéances à venir</h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune échéance datée à venir.
            </p>
          ) : (
            <ul className="mt-2">
              {upcoming.map((task) => (
                <TaskLine key={task.id} task={task} />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Tâches en cours
            {inProgress.length > 0 ? (
              <span className="ml-2 rounded-full bg-status-progress/15 px-2 py-0.5 text-xs text-status-progress">
                {inProgress.length}
              </span>
            ) : null}
          </h2>
          {inProgress.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Aucune tâche en cours.</p>
          ) : (
            <ul className="mt-2">
              {inProgress.map((task) => (
                <TaskLine key={task.id} task={task} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
