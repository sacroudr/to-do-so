"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  createTeamMemberAction,
  updateTeamMemberAction,
} from "@/lib/api/team-actions";
import type { TeamMember } from "@/lib/types/domain";

/**
 * Formulaire de creation / edition d'une personne assignable (`team_members`, point 1).
 *
 * Coherent avec `project-form-dialog` : meme structure de modale, memes tokens de la
 * direction visuelle validee (palette slate + primary) et meme couple de modes
 * `create` | `edit`. Formulaire MINIMAL : uniquement prenom + nom. AUCUNE notion de mot
 * de passe / email / compte (decouple de l'auth) : qui peut se connecter (profiles) !=
 * qui peut etre responsable (team_members). En mode `edit`, les champs sont PRE-REMPLIS.
 */
export interface UserFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  /** Personne a editer (mode `edit` uniquement). */
  member?: TeamMember | null;
  onClose: () => void;
}

export function UserFormDialog({ open, mode, member, onClose }: UserFormDialogProps) {
  const router = useRouter();
  const toast = useToast();
  const [firstName, setFirstName] = useState(member?.firstName ?? "");
  const [lastName, setLastName] = useState(member?.lastName ?? "");
  const [pending, startTransition] = useTransition();

  // Reinitialise les champs a chaque ouverture / changement de cible, via le pattern
  // « ajustement d'etat au rendu » (comme project-form-dialog).
  const formKey = `${open}:${member?.id ?? "new"}`;
  const [renderedKey, setRenderedKey] = useState(formKey);
  if (formKey !== renderedKey) {
    setRenderedKey(formKey);
    if (open) {
      setFirstName(member?.firstName ?? "");
      setLastName(member?.lastName ?? "");
    }
  }

  if (!open) return null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const values = { firstName: firstName.trim(), lastName: lastName.trim() };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTeamMemberAction(values)
          : await updateTeamMemberAction(member!.id, values);
      if (result.ok) {
        router.refresh();
        const fullName = `${values.firstName} ${values.lastName}`.trim();
        toast.success(
          mode === "create"
            ? `Utilisateur « ${fullName} » créé.`
            : `Utilisateur « ${fullName} » modifié.`,
        );
        onClose();
      } else {
        toast.error(result.error ?? "Une erreur est survenue.");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="user-dialog-title" className="max-w-md">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 id="user-dialog-title" className="text-lg font-semibold tracking-tight">
          {mode === "create" ? "Nouvel utilisateur" : "Modifier l'utilisateur"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" htmlFor="user-first-name" required>
            <Input
              id="user-first-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="ex. Marie"
            />
          </Field>

          <Field label="Nom" htmlFor="user-last-name">
            <Input
              id="user-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="ex. Dupont"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={pending}>
            {mode === "create" ? "Créer l'utilisateur" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
