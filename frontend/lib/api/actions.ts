"use server";

/**
 * Server Actions de mutation des taches (requirements.md §4.2).
 *
 * Elles s'executent cote serveur : elles recuperent le JWT (getAccessToken) et
 * appellent l'API FastAPI (qui verifie le token puis ecrit en base, §6.2). Apres
 * chaque mutation, on revalide les vues concernees pour rafraichir l'affichage.
 *
 * Les Client Components (bascule de statut, glisser-deposer Kanban, formulaire)
 * importent et invoquent ces fonctions.
 */
import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api/client";
import { getAccessToken } from "@/lib/supabase/server";
import type { TaskPriority, TaskStatus } from "@/lib/types/domain";

/** Valeurs d'un formulaire de creation / edition (§4.2). */
export interface TaskFormValues {
  titre: string;
  description: string | null;
  projectId: string | null;
  /** Nature de l'echeance : date precise OU texte libre (toggle, decision 1). */
  dueKind: "date" | "text";
  dueDate: string | null;
  dueText: string | null;
  statut: TaskStatus;
  priorite: TaskPriority;
  source: string | null;
  assigneeIds: string[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Vues a revalider apres une mutation (les deux vues + le tableau de bord). */
const AFFECTED_PATHS = ["/kanban", "/list", "/dashboard"] as const;

function revalidateBoard(): void {
  for (const path of AFFECTED_PATHS) {
    revalidatePath(path);
  }
}

/** Traduit les valeurs de formulaire vers le payload attendu par l'API (snake_case). */
function toApiPayload(values: TaskFormValues): Record<string, unknown> {
  const trimmedText = values.dueText?.trim() ?? "";
  return {
    titre: values.titre,
    description: values.description || null,
    project_id: values.projectId || null,
    due_date: values.dueKind === "date" ? values.dueDate || null : null,
    due_date_text: values.dueKind === "text" ? trimmedText || null : null,
    statut: values.statut,
    priorite: values.priorite,
    source: values.source || null,
    assignee_ids: values.assigneeIds,
  };
}

export async function createTaskAction(values: TaskFormValues): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch("/api/v1/tasks", {
      method: "POST",
      accessToken,
      body: toApiPayload(values),
    });
    revalidateBoard();
    return { ok: true };
  } catch {
    return { ok: false, error: "La creation de la tache a echoue." };
  }
}

export async function updateTaskAction(
  taskId: string,
  values: TaskFormValues,
): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      accessToken,
      body: toApiPayload(values),
    });
    revalidateBoard();
    return { ok: true };
  } catch {
    return { ok: false, error: "La modification de la tache a echoue." };
  }
}

/** Change uniquement le statut (glisser-deposer Kanban §4.3 / select Liste §4.4). */
export async function updateTaskStatusAction(
  taskId: string,
  statut: TaskStatus,
): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      accessToken,
      body: { statut },
    });
    revalidateBoard();
    return { ok: true };
  } catch {
    return { ok: false, error: "Le changement de statut a echoue." };
  }
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/tasks/${taskId}`, { method: "DELETE", accessToken });
    revalidateBoard();
    return { ok: true };
  } catch {
    return { ok: false, error: "La suppression de la tache a echoue." };
  }
}
