import { BoardHeader } from "@/components/tasks/board-header";
import { TaskTable } from "@/components/tasks/task-table";
import { getBoardData } from "@/lib/api/board";

/**
 * Vue Liste (requirements.md §4.4).
 *
 * Server Component : memes donnees que le Kanban (filtres §4.6 communs), affichees en
 * tableau triable par le Client Component `TaskTable`. `searchParams` est asynchrone
 * (Next.js 16, breaking change).
 */
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { tasks, projects, profiles } = await getBoardData({
    assigneeId: firstValue(params.assignee),
    projectId: firstValue(params.project),
  });

  return (
    <div className="space-y-6">
      <BoardHeader title="Vue Liste" projects={projects} profiles={profiles} />
      <TaskTable tasks={tasks} projects={projects} profiles={profiles} />
    </div>
  );
}
