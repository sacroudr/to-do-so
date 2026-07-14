"use client";

import { Folder, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteProjectAction } from "@/lib/api/project-actions";
import { pluralize, taskCountLabel } from "@/lib/i18n/plural";
import type { Project } from "@/lib/types/domain";

/**
 * Carte de projet (requirements.md §5) : lien vers le detail + actions edition / suppression.
 *
 * Les boutons crayon (edition) et corbeille (suppression) sont des FRERES du `<Link>`
 * (pas des enfants) et possedent un z-index superieur : cliquer dessus n'entraine PAS la
 * navigation vers le detail. Coherent avec le crayon des cartes de tache (apparait au
 * survol / focus). La suppression ouvre une modale de confirmation BLOQUANTE indiquant
 * CLAIREMENT le nombre de taches supprimees avec le projet (action irreversible, §8).
 *
 * `taskCount` = nombre TOTAL de taches rattachees au projet (actives + archivees), fourni
 * par la page Projets : c'est exactement ce que la cascade supprimera.
 */
export function ProjectCard({
  project,
  taskCount,
}: {
  project: Project;
  taskCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete(): void {
    startTransition(async () => {
      const result = await deleteProjectAction(project.id);
      if (result.ok) {
        setConfirming(false);
        router.refresh();
        toast.success(`Projet « ${project.nom} » supprimé.`);
      } else {
        toast.error(result.error ?? "La suppression du projet a échoué.");
      }
    });
  }

  // Message de confirmation : quantifie precisement l'impact irreversible de la cascade.
  const deletionImpact =
    taskCount > 0
      ? `${taskCountLabel(taskCount)} ${pluralize(taskCount, "sera", "seront")} définitivement supprimée${pluralize(taskCount, "", "s")} avec ce projet, ainsi que leurs sous-tâches et pièces jointes.`
      : "Ce projet ne contient aucune tâche.";

  return (
    <div className="group relative">
      <Link
        href={`/projects/${project.id}`}
        className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md"
      >
        {/* pr-16 : reserve la place des deux icones en surimpression, sans chevauchement. */}
        <div className="flex items-center gap-2 pr-16">
          <Folder className="size-4 text-primary" aria-hidden />
          <span className="font-medium text-foreground">{project.nom}</span>
          <span className="ml-auto rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
            {taskCountLabel(taskCount)}
          </span>
        </div>
        {project.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        ) : null}
      </Link>

      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Modifier le projet"
          className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Supprimer le projet"
          className="rounded-md p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <ProjectFormDialog
        open={editing}
        mode="edit"
        project={project}
        onClose={() => setEditing(false)}
      />

      <ConfirmDialog
        open={confirming}
        title={`Supprimer « ${project.nom} »`}
        message={`Cette action est irréversible. ${deletionImpact}`}
        confirmLabel="Supprimer"
        pending={pending}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
