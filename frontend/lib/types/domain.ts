/**
 * Types du domaine metier — alignes sur requirements.md (§4.2 et §5).
 *
 * Ces types decrivent le contrat de donnees partage cote frontend. Ils refletent
 * le schema Supabase (tables `profiles`, `projects`, `tasks`, `task_assignees`) et
 * doivent rester la source de verite des formes de donnees manipulees par l'UI.
 */

/** Statuts d'une tache — colonnes de la vue Kanban (§4.3), dans l'ordre du flux.
 *  Reduction 9 -> 6 (point 1) : retires a_qualifier, waiting, archive. */
export type TaskStatus =
  | "a_planifier"
  | "todo"
  | "in_progress"
  | "a_tester"
  | "a_corriger"
  | "done";

/** Niveaux de priorite d'une tache (§4.2). */
export type TaskPriority = "low" | "medium" | "high";

/** Table `profiles` : comptes membres de l'equipe (§5). Sert a l'IDENTITE connectee
 *  (sidebar, page Profil). N'est PLUS la source des responsables (voir TeamMember). */
export interface Profile {
  id: string;
  nom: string;
  email: string;
  avatar: string | null;
}

/**
 * Table `team_members` : personnes assignables a une tache (point 2), DECOUPLEES des
 * comptes Auth (`profiles`). Uniquement un nom (prenom + nom), pas d'email ni d'avatar :
 * qui peut se connecter (Profile) != qui peut etre responsable (TeamMember).
 */
export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
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

/** Piece jointe PDF d'une tache (table `task_attachments`, §5). */
export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Auteur de l'ajout (§5) + son nom resolu pour l'affichage. */
  uploadedBy: string | null;
  uploadedByName: string | null;
  createdAt: string | null;
  /** URL signee (bucket prive) pour le telechargement ; null si indisponible. */
  signedUrl: string | null;
}

/** Sous-tache (item de checklist) d'une tache (table `task_subtasks`, §4.2, extension). */
export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  /** Ordre d'affichage dans la checklist (0..n). */
  position: number;
  createdAt: string | null;
}

/**
 * Progression de la checklist d'une tache (§4.2, extension), resolue avec la LISTE des
 * taches pour alimenter le badge « done/total » sans requete par tache. Toujours
 * present (0/0 si la tache n'a pas de sous-tache) : le badge n'est affiche que si
 * `total > 0`.
 */
export interface SubtaskProgress {
  total: number;
  done: number;
}

/** Table `tasks` enrichie des relations resolues pour l'affichage. */
export interface Task {
  id: string;
  titre: string;
  description: string | null;
  projectId: string | null;
  project?: Project | null;
  /** Responsables (relation multiple via `task_assignees`, §5) — desormais des
   *  team_members (points 2 et 3), plus des comptes. */
  assignees: TeamMember[];
  dueDate: TaskDueDate;
  statut: TaskStatus;
  priorite: TaskPriority;
  /** Rattachement a la reunion / au compte rendu d'origine (§4.2). */
  source: string | null;
  /** Avancement de la checklist (badge « done/total », §4.2 extension). */
  subtaskProgress: SubtaskProgress;
  createdAt: string;
  updatedAt: string;
  /** Instant de passage a « done » (point 4) ; null tant que non terminee. Sert au
   *  filtre d'archive (done depuis > 10 min). */
  completedAt: string | null;
}
