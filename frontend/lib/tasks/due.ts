/**
 * Utilitaires d'echeance (requirements.md §4.2 / §4.4).
 *
 * L'echeance est soit une date precise, soit une indication libre. Ces helpers
 * fournissent la NATURE de l'echeance (pour l'attribut `data-due-kind` de la vue
 * Liste) et un LIBELLE d'affichage coherent (locale fr).
 */
import type { TaskDueDate } from "@/lib/types/domain";

export type DueKind = "date" | "text" | "none";

export function getDueKind(due: TaskDueDate): DueKind {
  if (due.date) return "date";
  if (due.text) return "text";
  return "none";
}

/** Libelle d'affichage de l'echeance ; « — » si aucune. */
export function formatDue(due: TaskDueDate): string {
  if (due.date) {
    // `T00:00:00` (heure LOCALE) evite le decalage de fuseau d'un `new Date('YYYY-MM-DD')`.
    const parsed = new Date(`${due.date}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return due.date;
  }
  if (due.text) return due.text;
  return "—";
}
