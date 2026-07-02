import { Folder } from "lucide-react";
import Link from "next/link";

import { NewProjectButton } from "@/components/projects/new-project-button";
import { getBoardData } from "@/lib/api/board";

/**
 * Liste des projets / thematiques (requirements.md §4.7, table `projects` §5).
 *
 * Server Component : charge les projets reels + les taches (pour le compteur par
 * projet) via l'API. Le bouton « Nouveau projet » ouvre un formulaire de creation
 * (Server Action) — il ne s'agit plus d'un placeholder.
 */
export default async function ProjectsPage() {
  const { projects, tasks } = await getBoardData();

  const taskCountByProject = new Map<string, number>();
  for (const task of tasks) {
    if (task.projectId) {
      taskCountByProject.set(
        task.projectId,
        (taskCountByProject.get(task.projectId) ?? 0) + 1,
      );
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
        <NewProjectButton />
      </header>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun projet pour le moment. Creez-en un avec « Nouveau projet ».
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <Folder className="size-4 text-primary" aria-hidden />
                  <span className="font-medium text-foreground">{project.nom}</span>
                  <span className="ml-auto rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {taskCountByProject.get(project.id) ?? 0} tache(s)
                  </span>
                </div>
                {project.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
