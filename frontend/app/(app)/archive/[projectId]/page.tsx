import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TaskTable } from "@/components/tasks/task-table";
import { getBoardData } from "@/lib/api/board";
import { NO_PROJECT_LABEL, NO_PROJECT_SEGMENT } from "@/lib/constants/archive";

/**
 * Page Archive — niveau 2 (point 2) : tâches archivées d'UN projet.
 *
 * ATTENTION (breaking change Next.js 16) : `params` est une Promise et DOIT etre await.
 * On charge toutes les taches archivees puis on les filtre sur le projet cible — ce
 * chemin unique gere aussi bien un vrai projet que le regroupement « Sans projet »
 * (`/archive/none`, project_id null), que le filtre backend `project` ne saurait cibler.
 * On reutilise `TaskTable` (comme la vue Liste) : sortir une tache de « terminé » depuis
 * cette vue la desarchive (le trigger DB remet completed_at a null) et elle quitte l'archive.
 */
export default async function ArchiveProjectPage(
  props: PageProps<"/archive/[projectId]">,
) {
  const { projectId } = await props.params;
  const { tasks, projects, members } = await getBoardData({ archived: true });

  const isNoProject = projectId === NO_PROJECT_SEGMENT;
  const project = isNoProject ? null : projects.find((p) => p.id === projectId);
  // Un id de projet inconnu (et different du sentinelle « none ») -> 404.
  if (!isNoProject && !project) notFound();

  const scopedTasks = tasks.filter((task) =>
    isNoProject ? task.projectId === null : task.projectId === projectId,
  );

  const title = isNoProject ? NO_PROJECT_LABEL : project!.nom;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <Link
          href="/archive"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Archive
        </Link>
        <div>
          <p className="text-sm text-muted-foreground">Archive</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tâches terminées depuis plus de 10 minutes.
          </p>
        </div>
      </header>

      {scopedTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucune tâche archivée pour ce projet.
        </div>
      ) : (
        <TaskTable tasks={scopedTasks} projects={projects} members={members} />
      )}
    </div>
  );
}
