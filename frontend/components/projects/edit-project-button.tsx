"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import type { Project } from "@/lib/types/domain";

/**
 * Bouton « Modifier le projet » de l'en-tete du detail projet (requirements.md §5).
 * Ouvre le meme `ProjectFormDialog` en mode edition, pre-rempli.
 */
export function EditProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <Pencil className="size-4" />
        Modifier
      </button>

      <ProjectFormDialog
        open={open}
        mode="edit"
        project={project}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
