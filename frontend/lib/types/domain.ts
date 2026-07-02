/**
 * Types du domaine metier — alignes sur requirements.md (§4.2 et §5).
 *
 * Ces types decrivent le contrat de donnees partage cote frontend. Ils refletent
 * le schema Supabase (tables `profiles`, `projects`, `tasks`, `task_assignees`) et
 * doivent rester la source de verite des formes de donnees manipulees par l'UI.
 */

/** Statuts d'une tache — colonnes de la vue Kanban (§4.3). */
export type TaskStatus = "todo" | "in_progress" | "waiting" | "blocked" | "done";

/** Niveaux de priorite d'une tache (§4.2). */
export type TaskPriority = "low" | "medium" | "high";

/** Table `profiles` : comptes membres de l'equipe (§5). */
export interface Profile {
  id: string;
  nom: string;
  email: string;
  avatar: string | null;
}

/** Table `projects` : projets / thematiques regroupant des taches (§5). */
export interface Project {
  id: string;
  nom: string;
  description: string | null;
}

/**
 * L'echeance est soit une date precise, soit une indication libre (§4.2),
 * ex. « mi-juillet ». Regle produit : EXACTEMENT une des deux formes est renseignee
 * (jamais les deux, jamais aucune). On conserve donc les deux champs distincts.
 */
export interface TaskDueDate {
  /** Date ISO 8601 (YYYY-MM-DD) si l'echeance est precise, sinon null. */
  date: string | null;
  /** Indication libre saisie par l'utilisateur (ex. « mi-juillet »), sinon null. */
  text: string | null;
}

/** Table `tasks` enrichie des relations resolues pour l'affichage. */
export interface Task {
  id: string;
  titre: string;
  description: string | null;
  projectId: string | null;
  project?: Project | null;
  /** Responsables (relation multiple via `task_assignees`, §5). */
  assignees: Profile[];
  dueDate: TaskDueDate;
  statut: TaskStatus;
  priorite: TaskPriority;
  /** Rattachement a la reunion / au compte rendu d'origine (§4.2). */
  source: string | null;
  createdAt: string;
  updatedAt: string;
}
