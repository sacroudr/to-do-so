"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { UserFormDialog } from "@/components/team/user-form-dialog";
import { Button } from "@/components/ui/button";

/**
 * Bouton d'ajout d'une personne assignable (point 2) : ouvre le formulaire de creation.
 * Modele identique a `new-project-button`.
 */
export function NewUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        leftIcon={<Plus className="size-4" />}
        onClick={() => setOpen(true)}
      >
        Nouvel utilisateur
      </Button>

      <UserFormDialog open={open} mode="create" onClose={() => setOpen(false)} />
    </>
  );
}
