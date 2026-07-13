/**
 * Constantes de la page Archive (point 2 : navigation en 2 temps par projet).
 *
 * Les taches archivees sans projet (project_id null) sont regroupees sous un segment
 * d'URL SENTINELLE (`/archive/none`) — un projet ne pouvant avoir cet id, il n'y a pas de
 * collision possible. Partage entre le niveau 1 (lien) et le niveau 2 (lecture du segment).
 */

/** Segment d'URL du regroupement « Sans projet » (taches archivees sans project_id). */
export const NO_PROJECT_SEGMENT = "none";

/** Libelle affiche pour le regroupement « Sans projet ». */
export const NO_PROJECT_LABEL = "Sans projet";
