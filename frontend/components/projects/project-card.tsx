"use client";

import { Folder, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { taskCountLabel } from "@/lib/i18n/plural";
import type { Project } from "@/lib/types/domain";

/**
 * Carte de projet (requirements.md §5) : lien vers le detail + action d'edition.
 *
 * Le bouton crayon est un FRERE du `<Link>` (pas un enfant) et posseent un z-index
 * superieur : cliquer dessus ouvre le formulaire d'edition SANS declencher la
 * navigation vers le detail du projet. Coherent avec le crayon des cartes de tache
 * (apparait au survol / focus).
 */
export function ProjectCard({
  project,
  taskCount,
}: {
  project: Project;
  taskCount: number;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group relative">
      <Link
        href={`/projects/${project.id}`}
        className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md"
      >
        {/* pr-8 : reserve la place du crayon en surimpression, sans chevauchement. */}
        <div className="flex items-center gap-2 pr-8">
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

      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Modifier le projet"
        className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/5 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Pencil className="size-3.5" />
      </button>

      <ProjectFormDialog
        open={editing}
        mode="edit"
        project={project}
        onClose={() => setEditing(false)}
      />
    </div>
  );
}
