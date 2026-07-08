import { notFound } from "next/navigation";

import { EditProjectButton } from "@/components/projects/edit-project-button";
import { TaskTable } from "@/components/tasks/task-table";
import { getBoardData } from "@/lib/api/board";

/**
 * Detail d'un projet : ses taches (vue filtree, §4.6).
 *
 * ATTENTION (breaking change Next.js 16) : `params` est une Promise et DOIT etre
 * await. On charge les taches filtrees sur le projet + les referentiels, puis on
 * reutilise `TaskTable` (memes actions que les vues principales). On utilise le helper
 * de types global `PageProps<'/...'>` genere par Next — aucun import necessaire.
 */
export default async function ProjectDetailPage(
  props: PageProps<"/projects/[projectId]">,
) {
  const { projectId } = await props.params;
  const { tasks, projects, profiles } = await getBoardData({ projectId });

  const project = projects.find((p) => p.id === projectId);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Projet</p>
          <h1 className="text-2xl font-semibold tracking-tight">{project.nom}</h1>
          {project.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          ) : null}
        </div>
        <EditProjectButton project={project} />
      </header>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucune tâche rattachée à ce projet.
        </div>
      ) : (
        <TaskTable tasks={tasks} projects={projects} profiles={profiles} />
      )}
    </div>
  );
}
