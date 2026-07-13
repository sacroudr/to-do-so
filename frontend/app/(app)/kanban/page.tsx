import { BoardHeader } from "@/components/tasks/board-header";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { getBoardData } from "@/lib/api/board";

/**
 * Vue Kanban (requirements.md §4.3).
 *
 * Server Component : charge les taches (filtrees §4.6) + referentiels via l'API, puis
 * delegue l'affichage / le glisser-deposer au Client Component `KanbanBoard`.
 * `searchParams` est asynchrone (Next.js 16, breaking change).
 */
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { tasks, projects, members } = await getBoardData({
    assigneeId: firstValue(params.assignee),
    projectId: firstValue(params.project),
  });

  return (
    <div className="space-y-6">
      <BoardHeader title="Vue Kanban" projects={projects} members={members} />
      <KanbanBoard tasks={tasks} projects={projects} members={members} />
    </div>
  );
}
