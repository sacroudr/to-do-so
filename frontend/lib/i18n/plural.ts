/**
 * Pluralisation FR minimale (sans dependance externe).
 *
 * Regle francaise : 0 et 1 prennent le SINGULIER (« 0 tache », « 1 tache »),
 * 2 et plus prennent le PLURIEL. On centralise ici pour eviter les libelles
 * codes en dur du type « {n} tache(s) ».
 */

/** Renvoie la forme singulier / pluriel adaptee au compte (regle FR). */
export function pluralize(count: number, singular: string, plural: string): string {
  return Math.abs(count) < 2 ? singular : plural;
}

/** Libelle « N tâche » / « N tâches » pour un compte de taches. */
export function taskCountLabel(count: number): string {
  return `${count} ${pluralize(count, "tâche", "tâches")}`;
}

/** Libelle « N tâche archivée » / « N tâches archivées » (page Archive, point 2). */
export function archivedTaskCountLabel(count: number): string {
  return `${count} ${pluralize(count, "tâche archivée", "tâches archivées")}`;
}
