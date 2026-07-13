import { Suspense } from "react";

import { ViewSwitcher } from "@/components/layout/view-switcher";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskFilters } from "@/components/tasks/task-filters";
import type { Project, TeamMember } from "@/lib/types/domain";

/**
 * En-tete commun aux vues Kanban et Liste : titre + filtres (§4.6) + bascule de vue
 * (§4.5) + ajout de tache (§4.2). Mutualise pour garantir une presentation coherente.
 *
 * `TaskFilters` lit les query params via `useSearchParams` -> encapsule dans
 * <Suspense> (exigence Next.js pour les hooks de navigation cote client).
 */
export function BoardHeader({
  title,
  projects,
  members,
}: {
  title: string;
  projects: Project[];
  members: TeamMember[];
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <Suspense fallback={null}>
          <TaskFilters projects={projects} members={members} />
        </Suspense>
        <ViewSwitcher />
        <NewTaskButton projects={projects} members={members} />
      </div>
    </header>
  );
}
