/**
 * Constantes des pieces jointes PDF (requirements.md §5).
 *
 * Extrait des Server Actions (`lib/api/attachment-actions.ts`) car un fichier
 * « use server » ne peut exporter QUE des fonctions async : les valeurs partagees
 * (limite de taille, type MIME) vivent donc ici, importables cote client comme serveur.
 */

/** Limite alignee sur le backend / le bucket Storage (10 Mo). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Seul type MIME accepte (validation front ; le backend re-valide via magic bytes). */
export const PDF_MIME = "application/pdf";
