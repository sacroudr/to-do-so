import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectCard } from "@/components/projects/project-card";
import { getBoardData } from "@/lib/api/board";

/**
 * Liste des projets / thematiques (requirements.md §4.7, table `projects` §5).
 *
 * Server Component : charge les projets reels + les taches (pour le compteur par
 * projet) via l'API. Le bouton « Nouveau projet » ouvre un formulaire de creation
 * (Server Action) — il ne s'agit plus d'un placeholder.
 *
 * Le compteur par projet inclut les taches ACTIVES ET ARCHIVEES (deux chargements en
 * parallele) : c'est le total EXACT que la suppression du projet supprimera (point 3),
 * afin que la modale de confirmation quantifie fidelement l'impact irreversible.
 */
export default async function ProjectsPage() {
  const [active, archived] = await Promise.all([
    getBoardData(),
    getBoardData({ archived: true }),
  ]);
  const { projects } = active;

  const taskCountByProject = new Map<string, number>();
  for (const task of [...active.tasks, ...archived.tasks]) {
    if (task.projectId) {
      taskCountByProject.set(
        task.projectId,
        (taskCountByProject.get(task.projectId) ?? 0) + 1,
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
        <NewProjectButton />
      </header>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun projet pour le moment. Créez-en un avec « Nouveau projet ».
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                taskCount={taskCountByProject.get(project.id) ?? 0}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
