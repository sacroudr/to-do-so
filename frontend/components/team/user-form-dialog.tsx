"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Modal } from "@/components/ui/modal";
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

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function UserFormDialog({ open, mode, member, onClose }: UserFormDialogProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(member?.firstName ?? "");
  const [lastName, setLastName] = useState(member?.lastName ?? "");
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
    }
  }

  if (!open) return null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    const values = { firstName: firstName.trim(), lastName: lastName.trim() };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTeamMemberAction(values)
          : await updateTeamMemberAction(member!.id, values);
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? "Une erreur est survenue.");
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
          <div className="space-y-1">
            <label htmlFor="user-first-name" className="text-sm font-medium">
              Prénom <span className="text-danger">*</span>
            </label>
            <input
              id="user-first-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="ex. Marie"
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="user-last-name" className="text-sm font-medium">
              Nom
            </label>
            <input
              id="user-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="ex. Dupont"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/5"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {pending
              ? "Enregistrement..."
              : mode === "create"
                ? "Créer l'utilisateur"
                : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
