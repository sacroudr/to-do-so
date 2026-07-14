"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Button } from "@/components/ui/button";

/**
 * Bouton d'ajout de projet (requirements.md §5) : ouvre le formulaire de creation.
 * Remplace l'ancien bouton placeholder (sans handler) de la page Projets.
 */
export function NewProjectButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        leftIcon={<Plus className="size-4" />}
        onClick={() => setOpen(true)}
      >
        Nouveau projet
      </Button>

      <ProjectFormDialog mode="create" open={open} onClose={() => setOpen(false)} />
    </>
  );
}
