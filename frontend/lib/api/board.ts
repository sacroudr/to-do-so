/**
 * Chargement des donnees du tableau (Kanban §4.3 / Liste §4.4 / Archive point 4) depuis
 * l'API FastAPI.
 *
 * Fonctions SERVEUR (utilisent `getAccessToken`, qui lit les cookies) : a appeler
 * depuis des Server Components. Elles recuperent les DTO bruts de l'API, puis
 * resolvent les relations (projet, responsables) en objets du domaine (`Task`) pour
 * l'affichage — l'API ne renvoyant que des identifiants (`project_id`, `assignee_ids`).
 *
 * Les responsables sont desormais des `team_members` (points 2 et 3), plus des comptes.
 */
import { apiFetch } from "@/lib/api/client";
import { getAccessToken } from "@/lib/supabase/server";
import type {
  Project,
  Task,
  TaskPriority,
  TaskStatus,
  TeamMember,
} from "@/lib/types/domain";

/** Forme brute d'une tache telle que renvoyee par l'API (`schemas.task.Task`). */
export interface TaskDTO {
  id: string;
  titre: string;
  description: string | null;
  project_id: string | null;
  due_date: string | null;
  due_date_text: string | null;
  statut: TaskStatus;
  priorite: TaskPriority;
  source: string | null;
  assignee_ids: string[];
  /** Compteurs de checklist resolus par l'API (badge de progression, §4.2 extension). */
  subtask_total: number;
  subtask_done: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Instant de passage a « done » (point 4) ; null tant que non terminee. */
  completed_at: string | null;
}

/** Forme brute d'une personne assignable telle que renvoyee par l'API (`TeamMember`). */
export interface TeamMemberDTO {
  id: string;
  first_name: string;
  last_name: string;
}

/** Filtres optionnels par responsable / projet (§4.6) + archive (point 4). */
export interface TaskFilters {
  assigneeId?: string | null;
  projectId?: string | null;
  /** true = ne charger QUE les taches archivees (done depuis > 10 min). Page Archive. */
  archived?: boolean;
}

/** Ensemble des donnees necessaires aux vues (taches enrichies + referentiels). */
export interface BoardData {
  tasks: Task[];
  projects: Project[];
  /** Personnes assignables (team_members) pour selecteur / filtre responsable. */
  members: TeamMember[];
}

function toMember(dto: TeamMemberDTO): TeamMember {
  return { id: dto.id, firstName: dto.first_name, lastName: dto.last_name };
}

function buildTasksQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.assigneeId) params.set("assignee", filters.assigneeId);
  if (filters.projectId) params.set("project", filters.projectId);
  if (filters.archived) params.set("archived", "true");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Resout un DTO en `Task` du domaine a l'aide des referentiels projets / responsables. */
function toTask(
  dto: TaskDTO,
  projectsById: Map<string, Project>,
  membersById: Map<string, TeamMember>,
): Task {
  const project = dto.project_id ? projectsById.get(dto.project_id) ?? null : null;
  const assignees = dto.assignee_ids
    .map((id) => membersById.get(id))
    .filter((m): m is TeamMember => m !== undefined);

  return {
    id: dto.id,
    titre: dto.titre,
    description: dto.description,
    projectId: dto.project_id,
    project,
    assignees,
    dueDate: { date: dto.due_date, text: dto.due_date_text },
    statut: dto.statut,
    priorite: dto.priorite,
    source: dto.source,
    subtaskProgress: {
      total: dto.subtask_total ?? 0,
      done: dto.subtask_done ?? 0,
    },
    createdAt: dto.created_at ?? "",
    updatedAt: dto.updated_at ?? "",
    completedAt: dto.completed_at ?? null,
  };
}

/**
 * Charge taches (filtrees §4.6 / archive point 4), projets et responsables en parallele,
 * puis enrichit les taches. Toutes les vues consomment cette meme source pour rester
 * coherentes.
 */
export async function getBoardData(filters: TaskFilters = {}): Promise<BoardData> {
  const accessToken = await getAccessToken();

  const [taskDtos, projects, memberDtos] = await Promise.all([
    apiFetch<TaskDTO[]>(`/api/v1/tasks${buildTasksQuery(filters)}`, { accessToken }),
    apiFetch<Project[]>("/api/v1/projects", { accessToken }),
    apiFetch<TeamMemberDTO[]>("/api/v1/team-members", { accessToken }),
  ]);

  const members = memberDtos.map(toMember);
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const membersById = new Map(members.map((m) => [m.id, m]));

  const tasks = taskDtos.map((dto) => toTask(dto, projectsById, membersById));
  return { tasks, projects, members };
}
