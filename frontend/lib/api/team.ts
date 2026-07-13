/**
 * Chargement des personnes assignables (`team_members`, point 2) depuis l'API FastAPI.
 *
 * Fonction SERVEUR (lit les cookies via `getAccessToken`) : a appeler depuis un Server
 * Component (page Utilisateurs). Distincte de `getBoardData` qui charge aussi taches /
 * projets ; ici on ne veut que la liste des personnes.
 */
import { apiFetch } from "@/lib/api/client";
import type { TeamMemberDTO } from "@/lib/api/board";
import { getAccessToken } from "@/lib/supabase/server";
import type { TeamMember } from "@/lib/types/domain";

export async function getTeamMembers(): Promise<TeamMember[]> {
  const accessToken = await getAccessToken();
  const dtos = await apiFetch<TeamMemberDTO[]>("/api/v1/team-members", { accessToken });
  return dtos.map((dto) => ({
    id: dto.id,
    firstName: dto.first_name,
    lastName: dto.last_name,
  }));
}
