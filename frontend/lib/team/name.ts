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
