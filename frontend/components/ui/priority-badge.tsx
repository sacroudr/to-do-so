import { PRIORITY_BY_VALUE } from "@/lib/constants/task";
import type { TaskPriority } from "@/lib/types/domain";

/**
 * Pastille de priorite (requirements.md §7 — accent visuel selon la priorite).
 * Composant presentationnel, utilisable cote serveur comme client.
 */
const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-priority-low",
  medium: "bg-priority-medium",
  high: "bg-priority-high",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_BY_VALUE[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={`size-2 rounded-full ${PRIORITY_DOT[priority]}`} aria-hidden />
      {meta.label}
    </span>
  );
}
