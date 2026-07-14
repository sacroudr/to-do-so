"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  createProjectAction,
  updateProjectAction,
} from "@/lib/api/project-actions";
import type { Project } from "@/lib/types/domain";

/**
 * Formulaire de creation / edition d'un projet (requirements.md §5).
 *
 * Coherent avec `task-form-dialog` : meme structure de modale, memes tokens de la
 * direction visuelle validee (palette slate + primary, coins arrondis, focus ring), et
 * meme couple de modes `create` | `edit`. Champs : nom (obligatoire) et description.
 * En mode `edit`, le formulaire est PRE-REMPLI a partir du projet cible.
 */
export interface ProjectFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  /** Projet a editer (mode `edit` uniquement). */
  project?: Project | null;
  onClose: () => void;
}

export function ProjectFormDialog({
  open,
  mode,
  project,
  onClose,
}: ProjectFormDialogProps) {
  const router = useRouter();
  const toast = useToast();
  const [nom, setNom] = useState(project?.nom ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [pending, startTransition] = useTransition();

  // Reinitialise les champs a chaque ouverture / changement de projet cible, via le
  // pattern « ajustement d'etat au rendu » (comme task-form-dialog).
  const formKey = `${open}:${project?.id ?? "new"}`;
  const [renderedKey, setRenderedKey] = useState(formKey);
  if (formKey !== renderedKey) {
    setRenderedKey(formKey);
    if (open) {
      setNom(project?.nom ?? "");
      setDescription(project?.description ?? "");
    }
  }

  if (!open) return null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const values = { nom: nom.trim(), description: description.trim() || null };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProjectAction(values)
          : await updateProjectAction(project!.id, values);
      if (result.ok) {
        router.refresh();
        toast.success(
          mode === "create"
            ? `Projet « ${values.nom} » créé.`
            : `Projet « ${values.nom} » modifié.`,
        );
        onClose();
      } else {
        toast.error(result.error ?? "Une erreur est survenue.");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="project-dialog-title" className="max-w-md">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="project-dialog-title" className="text-lg font-semibold tracking-tight">
            {mode === "create" ? "Nouveau projet" : "Modifier le projet"}
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
          <Field label="Nom" htmlFor="project-nom" required>
            <Input
              id="project-nom"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex. Sage 100"
            />
          </Field>

          <Field label="Description" htmlFor="project-description">
            <Textarea
              id="project-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {mode === "create" ? "Créer le projet" : "Enregistrer"}
            </Button>
          </div>
        </form>
    </Modal>
  );
}
