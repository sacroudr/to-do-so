"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import type { Profile, Project } from "@/lib/types/domain";

/**
 * Bouton d'ajout de tache (requirements.md §4.2) : ouvre le formulaire en mode
 * creation. Present dans l'en-tete des vues Kanban et Liste.
 */
export function NewTaskButton({
  projects,
  profiles,
}: {
  projects: Project[];
  profiles: Profile[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
      >
        <Plus className="size-4" />
        Nouvelle tache
      </button>

      <TaskFormDialog
        open={open}
        mode="create"
        projects={projects}
        profiles={profiles}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
