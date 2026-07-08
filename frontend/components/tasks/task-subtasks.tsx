"use client";

import { GripVertical, ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type DragEvent, type KeyboardEvent } from "react";

import {
  createSubtaskAction,
  deleteSubtaskAction,
  listSubtasksAction,
  reorderSubtasksAction,
  toggleSubtaskAction,
} from "@/lib/api/subtask-actions";
import type { Subtask } from "@/lib/types/domain";

/**
 * Checklist de sous-taches d'une tache (§4.2, extension).
 *
 * Affiche la liste (case a cocher + titre barre une fois coche), un champ d'ajout
 * rapide (validation ENTREE, champ vide apres ajout), la suppression au survol
 * (corbeille en `--color-danger`) et le reordonnancement par glisser-deposer HTML5
 * natif — le MEME outillage que le Kanban, sans dependance supplementaire.
 *
 * Toutes les mutations sont OPTIMISTES (comme le changement de statut Kanban) : l'etat
 * local est mis a jour immediatement puis reconcilie ; en cas d'echec serveur on revient
 * a l'etat precedent et on affiche l'erreur. Un `router.refresh()` apres succes met a
 * jour le badge de progression sur les vues Kanban / Liste.
 *
 * La liste est chargee paresseusement a l'ouverture (le composant n'est monte que dans
 * la vue detail). Un identifiant `temp-*` marque une sous-tache creee localement mais
 * pas encore persistee : ses controles (cocher / supprimer / glisser) sont desactives
 * le temps de la reconciliation.
 */
const TEMP_PREFIX = "temp-";

function isPersisted(subtask: Subtask): boolean {
  return !subtask.id.startsWith(TEMP_PREFIX);
}

export function TaskSubtasks({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Chargement paresseux a l'ouverture (motif « fetch puis set », comme les pieces jointes).
  useEffect(() => {
    let active = true;
    void (async () => {
      const list = await listSubtasksAction(taskId);
      if (!active) return;
      setItems(list);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [taskId]);

  const doneCount = items.filter((s) => s.isDone).length;

  function addSubtask(): void {
    const title = newTitle.trim();
    if (!title) return;

    setNewTitle(""); // champ vide immediatement apres validation
    setError(null);

    const tempId = `${TEMP_PREFIX}${Date.now()}`;
    const optimistic: Subtask = {
      id: tempId,
      taskId,
      title,
      isDone: false,
      position: items.length,
      createdAt: null,
    };
    setItems((prev) => [...prev, optimistic]);

    startTransition(async () => {
      const result = await createSubtaskAction(taskId, title);
      if (result.ok && result.subtask) {
        // Remplace l'item temporaire par la ligne persistee (id/position reels).
        const created = result.subtask;
        setItems((prev) => prev.map((s) => (s.id === tempId ? created : s)));
        router.refresh();
      } else {
        setItems((prev) => prev.filter((s) => s.id !== tempId));
        setError(result.error ?? "L'ajout de la sous-tâche a échoué.");
      }
    });
  }

  function toggleSubtask(subtask: Subtask): void {
    if (!isPersisted(subtask)) return;
    const next = !subtask.isDone;
    setError(null);
    setItems((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, isDone: next } : s)));

    startTransition(async () => {
      const result = await toggleSubtaskAction(taskId, subtask.id, next);
      if (result.ok) {
        router.refresh();
      } else {
        setItems((prev) =>
          prev.map((s) => (s.id === subtask.id ? { ...s, isDone: subtask.isDone } : s)),
        );
        setError(result.error ?? "La mise à jour de la sous-tâche a échoué.");
      }
    });
  }

  function removeSubtask(subtask: Subtask): void {
    if (!isPersisted(subtask)) return;
    setError(null);
    const snapshot = items;
    setItems((prev) => prev.filter((s) => s.id !== subtask.id));

    startTransition(async () => {
      const result = await deleteSubtaskAction(taskId, subtask.id);
      if (result.ok) {
        router.refresh();
      } else {
        setItems(snapshot);
        setError(result.error ?? "La suppression de la sous-tâche a échoué.");
      }
    });
  }

  function handleDrop(target: Subtask): void {
    setOverId(null);
    const sourceId = draggedId;
    setDraggedId(null);
    if (!sourceId || sourceId === target.id) return;

    const fromIndex = items.findIndex((s) => s.id === sourceId);
    const toIndex = items.findIndex((s) => s.id === target.id);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setError(null);
    const snapshot = items;
    setItems(reordered);

    // On ne persiste que les ids reels (une creation en cours reste locale).
    const orderedIds = reordered.filter(isPersisted).map((s) => s.id);
    startTransition(async () => {
      const result = await reorderSubtasksAction(taskId, orderedIds);
      if (result.ok) {
        router.refresh();
      } else {
        setItems(snapshot);
        setError(result.error ?? "Le réordonnancement a échoué.");
      }
    });
  }

  function handleNewKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubtask();
    }
  }

  return (
    <div className="space-y-2" data-testid="task-subtasks">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          <ListChecks className="size-3.5" aria-hidden />
          Sous-tâches
        </h3>
        {items.length > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement des sous-tâches…</p>
      ) : (
        <ul className="space-y-1">
          {items.map((subtask) => {
            const persisted = isPersisted(subtask);
            const isDragged = draggedId === subtask.id;
            const isOver = overId === subtask.id && draggedId !== subtask.id;
            return (
              <li
                key={subtask.id}
                data-testid="subtask-item"
                draggable={persisted}
                onDragStart={(event: DragEvent<HTMLLIElement>) => {
                  setDraggedId(subtask.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setOverId(null);
                }}
                onDragOver={(event) => {
                  if (!draggedId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setOverId(subtask.id);
                }}
                onDragLeave={() => setOverId((id) => (id === subtask.id ? null : id))}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(subtask);
                }}
                className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                  isOver ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-foreground/5"
                } ${isDragged ? "opacity-50" : ""}`}
              >
                <span
                  aria-hidden
                  className={`text-muted-foreground/40 ${
                    persisted ? "cursor-grab group-hover:text-muted-foreground/70 active:cursor-grabbing" : ""
                  }`}
                >
                  <GripVertical className="size-3.5" />
                </span>

                <input
                  type="checkbox"
                  checked={subtask.isDone}
                  disabled={!persisted}
                  onChange={() => toggleSubtask(subtask)}
                  aria-label={`Marquer « ${subtask.title} » comme ${subtask.isDone ? "à faire" : "terminée"}`}
                  className="size-4 shrink-0 accent-primary"
                />

                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    subtask.isDone
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {subtask.title}
                </span>

                {persisted ? (
                  <button
                    type="button"
                    onClick={() => removeSubtask(subtask)}
                    aria-label={`Supprimer la sous-tâche « ${subtask.title} »`}
                    className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground/60" aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Ajout rapide : validation par ENTREE (pas de formulaire separe), champ vide apres ajout. */}
      <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="text"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={handleNewKeyDown}
          placeholder="Ajouter une sous-tâche…"
          aria-label="Ajouter une sous-tâche"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
