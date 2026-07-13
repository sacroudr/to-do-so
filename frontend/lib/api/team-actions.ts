"use server";

/**
 * Server Action de creation d'une personne assignable (`team_members`, point 2).
 *
 * Meme pattern que `lib/api/project-actions.ts` : execution serveur, JWT via
 * getAccessToken, appel API FastAPI, puis revalidation des vues concernees. Les
 * personnes alimentent le selecteur de responsable (point 3) et le filtre par
 * responsable, d'ou la revalidation des vues Kanban / Liste en plus de la page
 * Utilisateurs.
 *
 * Regle « use server » : ce fichier n'exporte QUE des fonctions async (les types
 * exportes sont autorises). Les constantes vivent en module non exporte.
 */
import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api/client";
import { getAccessToken } from "@/lib/supabase/server";

export interface TeamMemberFormValues {
  firstName: string;
  lastName: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const AFFECTED_PATHS = ["/users", "/kanban", "/list"] as const;

export async function createTeamMemberAction(
  values: TeamMemberFormValues,
): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch("/api/v1/team-members", {
      method: "POST",
      accessToken,
      body: {
        first_name: values.firstName,
        last_name: values.lastName,
      },
    });
    for (const path of AFFECTED_PATHS) revalidatePath(path);
    return { ok: true };
  } catch {
    return { ok: false, error: "La création de l'utilisateur a échoué." };
  }
}

/** Renomme une personne assignable (prenom / nom) — point 1. */
export async function updateTeamMemberAction(
  memberId: string,
  values: TeamMemberFormValues,
): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/team-members/${memberId}`, {
      method: "PATCH",
      accessToken,
      body: {
        first_name: values.firstName,
        last_name: values.lastName,
      },
    });
    for (const path of AFFECTED_PATHS) revalidatePath(path);
    return { ok: true };
  } catch {
    return { ok: false, error: "La modification de l'utilisateur a échoué." };
  }
}

/**
 * Supprime une personne assignable (point 1). La cascade FK cote base retire la personne
 * des taches ou elle etait responsable (sans supprimer aucune tache), d'ou la
 * revalidation des vues Kanban / Liste en plus de la page Utilisateurs.
 */
export async function deleteTeamMemberAction(memberId: string): Promise<ActionResult> {
  try {
    const accessToken = await getAccessToken();
    await apiFetch(`/api/v1/team-members/${memberId}`, {
      method: "DELETE",
      accessToken,
    });
    for (const path of AFFECTED_PATHS) revalidatePath(path);
    return { ok: true };
  } catch {
    return { ok: false, error: "La suppression de l'utilisateur a échoué." };
  }
}
