"use server";

/**
 * Server Actions des sous-taches (checklist) d'une tache (§4.2, extension).
 *
 * S'executent cote serveur : recuperent le JWT (getAccessToken) et appellent l'API
 * FastAPI (qui verifie le token puis ecrit en base, §6.2). Apres chaque mutation, on
 * revalide les vues du tableau pour rafraichir le badge de progression « done/total ».
 *
 * ⚠️ Fichier « use server » : il ne peut EXPORTER que des fonctions async. Les
 * eventuelles constantes partagees vivraient dans `lib/constants/` (cf. le piege
 * documente pour les pieces jointes). Les `export interface` sont OK (effaces a la
 * compilation).
 */
import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api/client";
import { getAccessToken } from "@/lib/supabase/server";
import type { Subtask, TaskStatus } from "@/lib/types/domain";

/** Forme brute d'une sous-tache renvoyee par l'API (`schemas.subtask.Subtask`). */
interface SubtaskDTO {
  id: string;
  task_id: string;
  title: string;
  statut: TaskStatus;
  position: number;
  created_at: string | null;
}

export interface SubtaskActionResult {
  ok: boolean;
  error?: string;
}

/** Resultat d'une creation : renvoie la sous-tache creee pour reconcilier l'UI optimiste. */
export interface CreateSubtaskResult extends SubtaskActionResult {
  subtask?: Subtask;
}

/** Vues a revalider apres une mutation (les deux vues + le tableau de bord). */
const AFFECTED_PATHS = ["/kanban", "/list", "/dashboard"] as const;

function revalidateBoard(): void {
  for (const path of AFFECTED_PATHS) {
    revalidatePath(path);
  }
}

function toSubtask(dto: SubtaskDTO): Subtask {
  return {
    id: dto.id,
    taskId: dto.task_id,
    title: dto.title,
    statut: dto.statut,
    position: dto.position,
    createdAt: dto.created_at,
  };
}

/** Liste les sous-taches d'une tache (triees par position). Renvoie [] en cas d'echec. */
export async function listSubtasksAction(taskId: string): Promise<Subtask[]> {
  try {
    const accessToken = await getAccessToken();
    const dtos = await apiFetch<SubtaskDTO[]>(
      `/api/v1/tasks/${taskId}/subtasks`,
      { accessToken, cache: "no-store" },
    );
    return dtos.map(toSubtask);
  } catch {
    return [];
  }
}

/** Cree une sous-tache (title) en fin de liste ; renvoie la sous-tache creee. */
export async function createSubtaskAction(
  taskId: string,
  title: string,
): Promise<CreateSubtaskResult> {
  const cleaned = title.trim();
  if (!cleaned) {
    return { ok: false, error: "Le titre ne peut pas être vide." };
  }
  try {
    const accessToken = await getAccessToken();
    const dto = await apiFetch<SubtaskDTO>(`/api/v1/tasks/${taskId}/subtasks`, {
      method: "POST",
      accessToken,
      body: { title: cleaned },
    });
    revalidateBoard();
    return { ok: true, subtask: toSubtask(dto) };
  } catch {
    return { ok: false, error: "L'ajout de la sous-tâche a échoué." };
  }
}

/** Change le statut d'une sous-tache (parmi les 6, comme une tache principale). */
export async function updateSubtaskStatusAction(
  taskId: string,
  subtaskId: string,
  statut: TaskStatus,
): Promise<SubtaskActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PATCH",
      accessToken,
      body: { statut },
    });
    revalidateBoard();
    return { ok: true };
  } catch {
    return { ok: false, error: "La mise à jour de la sous-tâche a échoué." };
  }
}

/** Supprime une sous-tache. */
export async function deleteSubtaskAction(
  taskId: string,
  subtaskId: string,
): Promise<SubtaskActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "DELETE",
      accessToken,
    });
    revalidateBoard();
    return { ok: true };
  } catch {
    return { ok: false, error: "La suppression de la sous-tâche a échoué." };
  }
}

/** Reordonne les sous-taches selon la liste ORDONNEE d'ids (glisser-deposer). */
export async function reorderSubtasksAction(
  taskId: string,
  orderedIds: string[],
): Promise<SubtaskActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/tasks/${taskId}/subtasks/order`, {
      method: "PUT",
      accessToken,
      body: { ordered_ids: orderedIds },
    });
    revalidateBoard();
    return { ok: true };
  } catch {
    return { ok: false, error: "Le réordonnancement des sous-tâches a échoué." };
  }
}
