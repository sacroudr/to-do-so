"use client";

import { GripVertical, ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type DragEvent, type KeyboardEvent } from "react";

import { useToast } from "@/components/ui/toast";
import {
  createSubtaskAction,
  deleteSubtaskAction,
  listSubtasksAction,
  reorderSubtasksAction,
  updateSubtaskStatusAction,
} from "@/lib/api/subtask-actions";
import { STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants/task";
import type { Subtask, TaskStatus } from "@/lib/types/domain";

/**
 * Checklist de sous-taches d'une tache (§4.2, extension).
 *
 * Chaque sous-tache porte desormais un STATUT a 6 valeurs, IDENTIQUE aux taches
 * principales : un selecteur compact (pastille de couleur de statut + select stylé,
 * meme palette `STATUS_BY_VALUE.dotClassName` que la vue Liste) remplace l'ancienne case
 * a cocher. Le titre n'est barre QUE lorsque le statut est « terminé » (`done`),
 * equivalent de l'ancien `is_done`. Champ d'ajout rapide (ENTREE), suppression au survol
 * (corbeille `--color-danger`), reordonnancement par glisser-deposer HTML5 natif.
 *
 * Toutes les mutations sont OPTIMISTES : l'etat local est mis a jour immediatement puis
 * reconcilie ; en cas d'echec serveur on revient a l'etat precedent et on affiche un TOAST
 * d'erreur (comme decide : pas de toast de succes a chaque changement dans la checklist —
 * le retour visuel du selecteur suffit). Un `router.refresh()` apres succes met a jour le
 * badge de progression « done/total » (statut « terminé ») sur les vues Kanban / Liste.
 *
 * Chargement paresseux a l'ouverture (le composant n'est monte que dans la vue detail).
 * Un identifiant `temp-*` marque une sous-tache creee localement mais pas encore persistee :
 * ses controles (statut / supprimer / glisser) sont desactives le temps de la reconciliation.
 */
const TEMP_PREFIX = "temp-";

/** Statut d'une sous-tache nouvellement creee = default DB (« a faire »/todo). */
const NEW_SUBTASK_STATUS: TaskStatus = "todo";

/** Statut terminal (titre barre + comptage du badge de progression). */
const DONE_STATUS: TaskStatus = "done";

function isPersisted(subtask: Subtask): boolean {
  return !subtask.id.startsWith(TEMP_PREFIX);
}

export function TaskSubtasks({ taskId }: { taskId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
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

  const doneCount = items.filter((s) => s.statut === DONE_STATUS).length;

  function addSubtask(): void {
    const title = newTitle.trim();
    if (!title) return;

    setNewTitle(""); // champ vide immediatement apres validation

    const tempId = `${TEMP_PREFIX}${Date.now()}`;
    const optimistic: Subtask = {
      id: tempId,
      taskId,
      title,
      statut: NEW_SUBTASK_STATUS,
      position: items.length,
      createdAt: null,
    };
    setItems((prev) => [...prev, optimistic]);

    startTransition(async () => {
      const result = await createSubtaskAction(taskId, title);
      if (result.ok && result.subtask) {
        // Remplace l'item temporaire par la ligne persistee (id/position/statut reels).
        const created = result.subtask;
        setItems((prev) => prev.map((s) => (s.id === tempId ? created : s)));
        router.refresh();
        toast.success("Sous-tâche ajoutée.");
      } else {
        setItems((prev) => prev.filter((s) => s.id !== tempId));
        toast.error(result.error ?? "L'ajout de la sous-tâche a échoué.");
      }
    });
  }

  // Le selecteur donne deja un retour visuel immediat (pastille + libelle + titre barre
  // si « terminé ») : on ne notifie donc que l'ECHEC (avec rollback), pas chaque succes.
  function changeSubtaskStatus(subtask: Subtask, statut: TaskStatus): void {
    if (!isPersisted(subtask) || subtask.statut === statut) return;
    const previous = subtask.statut;
    setItems((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, statut } : s)));

    startTransition(async () => {
      const result = await updateSubtaskStatusAction(taskId, subtask.id, statut);
      if (result.ok) {
        router.refresh();
      } else {
        setItems((prev) =>
          prev.map((s) => (s.id === subtask.id ? { ...s, statut: previous } : s)),
        );
        toast.error(result.error ?? "La mise à jour de la sous-tâche a échoué.");
      }
    });
  }

  function removeSubtask(subtask: Subtask): void {
    if (!isPersisted(subtask)) return;
    const snapshot = items;
    setItems((prev) => prev.filter((s) => s.id !== subtask.id));

    startTransition(async () => {
      const result = await deleteSubtaskAction(taskId, subtask.id);
      if (result.ok) {
        router.refresh();
        toast.success("Sous-tâche supprimée.");
      } else {
        setItems(snapshot);
        toast.error(result.error ?? "La suppression de la sous-tâche a échoué.");
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
        toast.error(result.error ?? "Le réordonnancement a échoué.");
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

      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement des sous-tâches…</p>
      ) : (
        <ul className="space-y-1">
          {items.map((subtask) => {
            const persisted = isPersisted(subtask);
            const isDragged = draggedId === subtask.id;
            const isOver = overId === subtask.id && draggedId !== subtask.id;
            const isDone = subtask.statut === DONE_STATUS;
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

                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isDone ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {subtask.title}
                </span>

                {/*
                  Selecteur de statut compact (§ statut sous-tache) : pastille de couleur
                  PLEINE (indice visuel, jamais la couleur seule) + select portant l'unique
                  libelle. Place juste a GAUCHE de la corbeille. Meme palette de statut que
                  les taches principales (dotClassName).
                */}
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${STATUS_BY_VALUE[subtask.statut].dotClassName}`}
                />
                <select
                  value={subtask.statut}
                  disabled={!persisted}
                  onChange={(e) => changeSubtaskStatus(subtask, e.target.value as TaskStatus)}
                  aria-label={`Statut de « ${subtask.title} »`}
                  className="shrink-0 cursor-pointer rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-medium outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>

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
