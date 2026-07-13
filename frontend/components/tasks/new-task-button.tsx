"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import type { Project, TeamMember } from "@/lib/types/domain";

/**
 * Bouton d'ajout de tache (requirements.md §4.2) : ouvre le formulaire en mode
 * creation. Present dans l'en-tete des vues Kanban et Liste, ainsi que sur une fiche
 * projet (point 5) — dans ce cas `initialProjectId` pre-remplit le projet affiche.
 */
export function NewTaskButton({
  projects,
  members,
  initialProjectId,
}: {
  projects: Project[];
  members: TeamMember[];
  /** Projet pre-rempli a la creation (fiche projet, point 5). */
  initialProjectId?: string;
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
        Nouvelle tâche
      </button>

      <TaskFormDialog
        open={open}
        mode="create"
        projects={projects}
        members={members}
        initialProjectId={initialProjectId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
