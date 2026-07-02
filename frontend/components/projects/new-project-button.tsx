"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";

/**
 * Bouton d'ajout de projet (requirements.md §5) : ouvre le formulaire de creation.
 * Remplace l'ancien bouton placeholder (sans handler) de la page Projets.
 */
export function NewProjectButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
      >
        <Plus className="size-4" />
        Nouveau projet
      </button>

      <ProjectFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
