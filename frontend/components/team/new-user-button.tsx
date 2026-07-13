"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { UserFormDialog } from "@/components/team/user-form-dialog";

/**
 * Bouton d'ajout d'une personne assignable (point 2) : ouvre le formulaire de creation.
 * Modele identique a `new-project-button`.
 */
export function NewUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
      >
        <Plus className="size-4" />
        Nouvel utilisateur
      </button>

      <UserFormDialog open={open} mode="create" onClose={() => setOpen(false)} />
    </>
  );
}
