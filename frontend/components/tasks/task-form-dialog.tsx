"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { TaskAttachments } from "@/components/tasks/task-attachments";
import { Modal } from "@/components/ui/modal";
import {
  createTaskAction,
  updateTaskAction,
  type TaskFormValues,
} from "@/lib/api/actions";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants/task";
import { getDueKind } from "@/lib/tasks/due";
import { memberFullName } from "@/lib/team/name";
import type { Project, Task, TaskPriority, TaskStatus, TeamMember } from "@/lib/types/domain";

/**
 * Formulaire de creation / edition d'une tache (requirements.md §4.2).
 *
 * Couvre TOUS les champs : titre, description, projet, responsables MULTIPLES,
 * echeance via un toggle explicite « date precise » / « texte libre » (decision 1),
 * statut, priorite, source. Soumission via Server Action (create/update).
 */
export interface TaskFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  task?: Task | null;
  /** Statut pre-rempli en mode creation (ex. colonne Kanban d'origine, §4.3). */
  initialStatus?: TaskStatus;
  /** Projet pre-rempli en mode creation (ex. fiche projet, point 5). */
  initialProjectId?: string;
  projects: Project[];
  members: TeamMember[];
  onClose: () => void;
}

/** Statut par defaut d'une nouvelle tache = premier statut (data-driven, pas de "todo" code en dur). */
const DEFAULT_STATUS: TaskStatus = TASK_STATUSES[0].value;

interface FormState {
  titre: string;
  description: string;
  projectId: string;
  dueKind: "date" | "text";
  dueDate: string;
  dueText: string;
  statut: TaskStatus;
  priorite: TaskPriority;
  source: string;
  assigneeIds: string[];
}

function initialState(
  task?: Task | null,
  initialStatus?: TaskStatus,
  initialProjectId?: string,
): FormState {
  const kind = task ? getDueKind(task.dueDate) : "none";
  return {
    titre: task?.titre ?? "",
    description: task?.description ?? "",
    projectId: task?.projectId ?? initialProjectId ?? "",
    dueKind: kind === "text" ? "text" : "date",
    dueDate: task?.dueDate.date ?? "",
    dueText: task?.dueDate.text ?? "",
    statut: task?.statut ?? initialStatus ?? DEFAULT_STATUS,
    priorite: task?.priorite ?? "medium",
    source: task?.source ?? "",
    assigneeIds: task?.assignees.map((a) => a.id) ?? [],
  };
}

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function TaskFormDialog({
  open,
  mode,
  task,
  initialStatus,
  initialProjectId,
  projects,
  members,
  onClose,
}: TaskFormDialogProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    initialState(task, initialStatus, initialProjectId),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reinitialise le formulaire a chaque ouverture / changement de tache cible OU de
  // statut / projet initial (creation rapide depuis une colonne Kanban §4.3 ou une fiche
  // projet point 5), via le pattern « ajustement d'etat au rendu » (recommande par React
  // plutot qu'un effet).
  const formKey = `${open}:${task?.id ?? "new"}:${initialStatus ?? ""}:${initialProjectId ?? ""}`;
  const [renderedKey, setRenderedKey] = useState(formKey);
  if (formKey !== renderedKey) {
    setRenderedKey(formKey);
    if (open) {
      setForm(initialState(task, initialStatus, initialProjectId));
      setError(null);
    }
  }

  if (!open) return null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAssignee(id: string): void {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(id)
        ? prev.assigneeIds.filter((a) => a !== id)
        : [...prev.assigneeIds, id],
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    const values: TaskFormValues = {
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      projectId: form.projectId || null,
      dueKind: form.dueKind,
      dueDate: form.dueDate || null,
      dueText: form.dueText || null,
      statut: form.statut,
      priorite: form.priorite,
      source: form.source.trim() || null,
      assigneeIds: form.assigneeIds,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTaskAction(values)
          : await updateTaskAction(task!.id, values);

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? "Une erreur est survenue.");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="task-dialog-title" className="max-w-lg">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="task-dialog-title" className="text-lg font-semibold tracking-tight">
            {mode === "create" ? "Nouvelle tâche" : "Modifier la tâche"}
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
            <label htmlFor="titre" className="text-sm font-medium">
              Titre <span className="text-danger">*</span>
            </label>
            <input
              id="titre"
              required
              value={form.titre}
              onChange={(e) => update("titre", e.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="project" className="text-sm font-medium">
                Projet
              </label>
              <select
                id="project"
                value={form.projectId}
                onChange={(e) => update("projectId", e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Aucun</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="source" className="text-sm font-medium">
                Source
              </label>
              <input
                id="source"
                value={form.source}
                onChange={(e) => update("source", e.target.value)}
                placeholder="CR réunion, etc."
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="statut" className="text-sm font-medium">
                Statut
              </label>
              <select
                id="statut"
                value={form.statut}
                onChange={(e) => update("statut", e.target.value as TaskStatus)}
                className={FIELD_CLASS}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="priorite" className="text-sm font-medium">
                Priorité
              </label>
              <select
                id="priorite"
                value={form.priorite}
                onChange={(e) => update("priorite", e.target.value as TaskPriority)}
                className={FIELD_CLASS}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Echeance : toggle explicite date precise / texte libre (decision 1). */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Échéance</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="dueKind"
                  checked={form.dueKind === "date"}
                  onChange={() => update("dueKind", "date")}
                  className="accent-primary"
                />
                Date précise
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="dueKind"
                  checked={form.dueKind === "text"}
                  onChange={() => update("dueKind", "text")}
                  className="accent-primary"
                />
                Texte libre
              </label>
            </div>
            {form.dueKind === "date" ? (
              <input
                type="date"
                aria-label="Date d'échéance"
                value={form.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
                className={FIELD_CLASS}
              />
            ) : (
              <input
                type="text"
                aria-label="Échéance en texte libre"
                placeholder="ex. mi-juillet, semaine prochaine"
                value={form.dueText}
                onChange={(e) => update("dueText", e.target.value)}
                className={FIELD_CLASS}
              />
            )}
          </fieldset>

          <div className="space-y-1">
            <span className="text-sm font-medium">Responsables</span>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {members.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">Aucun utilisateur.</p>
              ) : (
                members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.assigneeIds.includes(m.id)}
                      onChange={() => toggleAssignee(m.id)}
                      className="accent-primary"
                    />
                    {memberFullName(m)}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Pieces jointes PDF (§5) : uniquement en edition (la tache doit exister). */}
          {mode === "edit" && task ? (
            <div className="border-t border-border pt-4">
              <TaskAttachments taskId={task.id} />
            </div>
          ) : null}

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
              {pending ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
    </Modal>
  );
}
