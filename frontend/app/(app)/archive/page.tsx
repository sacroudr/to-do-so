import { ArchiveProjectCard } from "@/components/archive/archive-project-card";
import { getBoardData } from "@/lib/api/board";
import { NO_PROJECT_LABEL, NO_PROJECT_SEGMENT } from "@/lib/constants/archive";

/**
 * Page Archive — niveau 1 (point 2) : navigation par PROJET.
 *
 * Server Component : charge EXACTEMENT les taches archivees (statut « terminé » depuis
 * plus de 10 minutes, filtre dynamique cote backend). On regroupe ces taches par projet
 * et on n'affiche QUE les projets ayant au moins une tache archivée (un projet sans
 * archive « n'apparaît pas »), avec le compteur d'archives. Les taches archivées sans
 * projet sont regroupées sous « Sans projet ». Cliquer un projet mène au niveau 2
 * (`/archive/{projectId}`), qui liste ses tâches archivées.
 */
export default async function ArchivePage() {
  const { tasks, projects } = await getBoardData({ archived: true });

  // Compteur d'archives par projet (+ bucket « Sans projet » pour project_id null).
  const countByProject = new Map<string, number>();
  let noProjectCount = 0;
  for (const task of tasks) {
    if (task.projectId) {
      countByProject.set(task.projectId, (countByProject.get(task.projectId) ?? 0) + 1);
    } else {
      noProjectCount += 1;
    }
  }

  // Seuls les projets ayant >= 1 tache archivee (la liste `projects` est deja triee par
  // nom cote API, on conserve donc cet ordre).
  const archivedProjects = projects.filter((project) => countByProject.has(project.id));
  const hasArchives = archivedProjects.length > 0 || noProjectCount > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tâches terminées depuis plus de 10 minutes, regroupées par projet.
        </p>
      </header>

      {!hasArchives ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucune tâche archivée.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {archivedProjects.map((project) => (
            <li key={project.id}>
              <ArchiveProjectCard
                href={`/archive/${project.id}`}
                name={project.nom}
                count={countByProject.get(project.id) ?? 0}
              />
            </li>
          ))}
          {noProjectCount > 0 ? (
            <li key={NO_PROJECT_SEGMENT}>
              <ArchiveProjectCard
                href={`/archive/${NO_PROJECT_SEGMENT}`}
                name={NO_PROJECT_LABEL}
                count={noProjectCount}
                isNoProject
              />
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
