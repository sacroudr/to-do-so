"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types/domain";

/**
 * Bouton « Modifier le projet » de l'en-tete du detail projet (requirements.md §5).
 * Ouvre le meme `ProjectFormDialog` en mode edition, pre-rempli.
 */
export function EditProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        leftIcon={<Pencil className="size-4" />}
        onClick={() => setOpen(true)}
      >
        Modifier
      </Button>

      <ProjectFormDialog
        open={open}
        mode="edit"
        project={project}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
