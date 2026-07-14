import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { DueDate } from "@/components/ui/due-date";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { getBoardData } from "@/lib/api/board";
import { TASK_STATUSES } from "@/lib/constants/task";
import { getDueUrgency } from "@/lib/tasks/due";
import { memberFullName } from "@/lib/team/name";
import type { Task } from "@/lib/types/domain";

/**
 * Tableau de bord / accueil (requirements.md §4.7, §10).
 *
 * Server Component : charge TOUTES les taches de l'equipe via l'API (aucun filtre)
 * puis calcule la synthese. HIERARCHIE (§ audit) : l'information la plus critique — les
 * taches EN RETARD — remonte tout en haut, dans un bloc proeminent en `--color-danger`,
 * avant les compteurs par statut (qui, eux, sont de simples raccourcis de navigation).
 * Les Server Actions de mutation revalident `/dashboard` : une tache creee / modifiee
 * apparait donc automatiquement, sans rechargement manuel.
 */
const MAX_UPCOMING = 6;

/** Taches EN RETARD : echeance datee depassee et tache non terminee (helper partage). */
function overdueTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => getDueUrgency(t.dueDate, t.statut) === "overdue")
    .sort((a, b) => (a.dueDate.date as string).localeCompare(b.dueDate.date as string));
}

/** Echeances A VENIR (datees, aujourd'hui inclus, hors taches terminees). */
function upcomingTasks(tasks: Task[]): Task[] {
  const today = new Date().toISOString().slice(0, 10);
  return tasks
    .filter((t) => t.dueDate.date && t.dueDate.date >= today && t.statut !== "done")
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

  const overdue = overdueTasks(tasks);
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

      {/*
        Element le plus PROEMINENT (Hierarchie) : le retard. Il etait auparavant
        totalement INVISIBLE (les echeances dépassées etaient exclues) ; il est desormais
        surface en tete, en couleur `--color-danger`, des qu'au moins une tache est en retard.
      */}
      {overdue.length > 0 ? (
        <section className="rounded-xl border border-l-4 border-danger/30 border-l-danger bg-danger/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertTriangle className="size-4" aria-hidden />
            En retard
            <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs tabular-nums">
              {overdue.length}
            </span>
          </h2>
          <ul className="mt-2">
            {overdue.map((task) => (
              <TaskLine key={task.id} task={task} />
            ))}
          </ul>
        </section>
      ) : null}

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
