"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Modal } from "@/components/ui/modal";
import { createProjectAction } from "@/lib/api/project-actions";

/**
 * Formulaire de creation d'un projet (requirements.md §5).
 *
 * Coherent avec `task-form-dialog` (meme structure de modale, memes tokens de la
 * direction visuelle validee : palette slate + primary, coins arrondis, focus ring).
 * Champs : nom (obligatoire) et description.
 */
const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function ProjectFormDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reinitialise les champs a chaque ouverture (pattern « ajustement au rendu »).
  const [renderedOpen, setRenderedOpen] = useState(open);
  if (open !== renderedOpen) {
    setRenderedOpen(open);
    if (open) {
      setNom("");
      setDescription("");
      setError(null);
    }
  }

  if (!open) return null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProjectAction({
        nom: nom.trim(),
        description: description.trim() || null,
      });
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? "Une erreur est survenue.");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="project-dialog-title" className="max-w-md">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="project-dialog-title" className="text-lg font-semibold tracking-tight">
            Nouveau projet
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
          <div className="space-y-1">
            <label htmlFor="project-nom" className="text-sm font-medium">
              Nom <span className="text-status-blocked">*</span>
            </label>
            <input
              id="project-nom"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex. Sage 100"
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="project-description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="project-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          {error ? <p className="text-sm text-status-blocked">{error}</p> : null}

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
              {pending ? "Enregistrement..." : "Creer le projet"}
            </button>
          </div>
        </form>
    </Modal>
  );
}
