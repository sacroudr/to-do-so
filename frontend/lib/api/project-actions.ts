"use server";

/**
 * Server Action de creation de projet (requirements.md §5).
 *
 * Meme pattern que `lib/api/actions.ts` (taches) : execution serveur, JWT via
 * getAccessToken, appel API FastAPI, puis revalidation des vues concernees. Les
 * projets alimentent le filtre projet (§4.6) et le selecteur du formulaire de tache,
 * d'ou la revalidation des vues Kanban / Liste en plus de la page Projets.
 */
import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api/client";
import { getAccessToken } from "@/lib/supabase/server";

export interface ProjectFormValues {
  nom: string;
  description: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const AFFECTED_PATHS = ["/projects", "/kanban", "/list", "/dashboard", "/archive"] as const;

export async function createProjectAction(
  values: ProjectFormValues,
): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch("/api/v1/projects", {
      method: "POST",
      accessToken,
      body: {
        nom: values.nom,
        description: values.description || null,
      },
    });
    for (const path of AFFECTED_PATHS) revalidatePath(path);
    return { ok: true };
  } catch {
    return { ok: false, error: "La création du projet a échoué." };
  }
}

/** Renomme / modifie la description d'un projet existant (§5). */
export async function updateProjectAction(
  projectId: string,
  values: ProjectFormValues,
): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      accessToken,
      body: {
        nom: values.nom,
        description: values.description || null,
      },
    });
    for (const path of AFFECTED_PATHS) revalidatePath(path);
    return { ok: true };
  } catch {
    return { ok: false, error: "La modification du projet a échoué." };
  }
}

/**
 * Supprime un projet ET ses taches en cascade (point 3). Le backend orchestre la
 * suppression : purge des objets Storage des pieces jointes, suppression des taches
 * (cascade sous-taches + lignes pieces jointes), puis du projet. Toutes les vues qui
 * exposent ces taches / ce projet sont revalidees.
 */
export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/projects/${projectId}`, {
      method: "DELETE",
      accessToken,
    });
    for (const path of AFFECTED_PATHS) revalidatePath(path);
    return { ok: true };
  } catch {
    return { ok: false, error: "La suppression du projet a échoué." };
  }
}
