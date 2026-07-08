/**
 * Chargement des donnees du tableau (Kanban §4.3 / Liste §4.4) depuis l'API FastAPI.
 *
 * Fonctions SERVEUR (utilisent `getAccessToken`, qui lit les cookies) : a appeler
 * depuis des Server Components. Elles recuperent les DTO bruts de l'API, puis
 * resolvent les relations (projet, responsables) en objets du domaine (`Task`) pour
 * l'affichage — l'API ne renvoyant que des identifiants (`project_id`, `assignee_ids`).
 */
import { apiFetch } from "@/lib/api/client";
import { getAccessToken } from "@/lib/supabase/server";
import type {
  Profile,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
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
}

/** Filtres optionnels par responsable / projet (§4.6). */
export interface TaskFilters {
  assigneeId?: string | null;
  projectId?: string | null;
}

/** Ensemble des donnees necessaires aux deux vues (taches enrichies + referentiels). */
export interface BoardData {
  tasks: Task[];
  projects: Project[];
  profiles: Profile[];
}

function buildTasksQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.assigneeId) params.set("assignee", filters.assigneeId);
  if (filters.projectId) params.set("project", filters.projectId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Resout un DTO en `Task` du domaine a l'aide des referentiels projets / profils. */
function toTask(
  dto: TaskDTO,
  projectsById: Map<string, Project>,
  profilesById: Map<string, Profile>,
): Task {
  const project = dto.project_id ? projectsById.get(dto.project_id) ?? null : null;
  const assignees = dto.assignee_ids
    .map((id) => profilesById.get(id))
    .filter((p): p is Profile => p !== undefined);

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
  };
}

/**
 * Charge taches (filtrees §4.6), projets et profils en parallele, puis enrichit les
 * taches. Toutes les vues consomment cette meme source pour rester coherentes.
 */
export async function getBoardData(filters: TaskFilters = {}): Promise<BoardData> {
  const accessToken = await getAccessToken();

  const [taskDtos, projects, profiles] = await Promise.all([
    apiFetch<TaskDTO[]>(`/api/v1/tasks${buildTasksQuery(filters)}`, { accessToken }),
    apiFetch<Project[]>("/api/v1/projects", { accessToken }),
    apiFetch<Profile[]>("/api/v1/profiles", { accessToken }),
  ]);

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  const tasks = taskDtos.map((dto) => toTask(dto, projectsById, profilesById));
  return { tasks, projects, profiles };
}
