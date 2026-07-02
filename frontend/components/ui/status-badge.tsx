import { STATUS_BY_VALUE } from "@/lib/constants/task";
import type { TaskStatus } from "@/lib/types/domain";

/**
 * Pastille de statut (requirements.md §7 — une couleur par statut).
 * Composant presentationnel sans etat, utilisable cote serveur comme client.
 */
export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_BY_VALUE[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badgeClassName}`}
    >
      {meta.label}
    </span>
  );
}
