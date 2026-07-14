/**
 * Helpers d'affichage d'une personne assignable (`TeamMember`, points 2 et 3).
 *
 * Source unique du NOM COMPLET et des INITIALES derives de first_name / last_name
 * (team_members n'a pas d'avatar image : les cartes / lignes affichent des initiales).
 */
import type { TeamMember } from "@/lib/types/domain";

/** Nom complet « Prenom Nom » (espaces superflus nettoyes). */
export function memberFullName(member: TeamMember): string {
  return `${member.firstName} ${member.lastName}`.trim().replace(/\s+/g, " ");
}

/**
 * Libelle affiche pour une tache SANS aucun responsable. Les taches sont privees au
 * compte connecte (isolation par utilisateur) : une tache que je vois sans responsable
 * est forcement la mienne, donc on affiche « Moi » plutot que « Non assigne ».
 */
export const SELF_ASSIGNEE_LABEL = "Moi";

/** Libelle des responsables d'une tache : les noms complets joints, ou « Moi » si aucun. */
export function assigneesLabel(members: TeamMember[]): string {
  if (members.length === 0) return SELF_ASSIGNEE_LABEL;
  return members.map(memberFullName).join(", ");
}

/** Initiales (1 a 2 lettres majuscules) derivees du prenom + nom. */
export function memberInitials(member: TeamMember): string {
  const parts = [member.firstName, member.lastName]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
