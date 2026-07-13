/**
 * Utilitaires d'echeance (requirements.md §4.2 / §4.4).
 *
 * L'echeance est soit une date precise, soit une indication libre. Ces helpers
 * fournissent la NATURE de l'echeance (pour l'attribut `data-due-kind` de la vue
 * Liste) et un LIBELLE d'affichage coherent (locale fr).
 */
import type { TaskDueDate, TaskStatus } from "@/lib/types/domain";

export type DueKind = "date" | "text" | "none";

export function getDueKind(due: TaskDueDate): DueKind {
  if (due.date) return "date";
  if (due.text) return "text";
  return "none";
}

/**
 * Urgence d'une echeance DATEE (requirements.md §7 — « accent visuel selon la
 * priorite OU l'urgence de l'echeance »). Ne s'applique qu'aux dates precises : une
 * echeance en texte libre n'est pas comparable, et une tache `done` n'est jamais en
 * retard. Fenetre « imminent » = aujourd'hui + 2 jours (0..2 jours restants).
 */
export type DueUrgency = "overdue" | "soon" | "normal" | "none";

const SOON_WINDOW_DAYS = 2;
const MS_PER_DAY = 86_400_000;

export function getDueUrgency(due: TaskDueDate, statut?: TaskStatus): DueUrgency {
  // Etat terminal (termine) : jamais « en retard ».
  if (statut === "done") return "none";
  if (!due.date) return "none";

  const target = new Date(`${due.date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);

  if (diffDays < 0) return "overdue";
  if (diffDays <= SOON_WINDOW_DAYS) return "soon";
  return "normal";
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
