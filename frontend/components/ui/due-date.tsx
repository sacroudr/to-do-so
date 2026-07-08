import { AlertTriangle, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatDue, getDueUrgency, type DueUrgency } from "@/lib/tasks/due";
import type { TaskDueDate, TaskStatus } from "@/lib/types/domain";

/**
 * Affichage d'une echeance avec accent d'urgence (requirements.md §7).
 *
 * En retard -> rouge + icone, imminent (<= 2 j) -> ambre + icone, sinon neutre. Une
 * icone accompagne la couleur (a11y §1 : jamais la couleur seule) et un `title`
 * explicite l'etat au survol. Composant presentationnel, utilisable serveur/client.
 */
const URGENCY: Record<
  DueUrgency,
  { className: string; Icon: LucideIcon | null; title: string | null }
> = {
  overdue: { className: "text-danger font-semibold", Icon: AlertTriangle, title: "En retard" },
  soon: { className: "text-status-waiting font-medium", Icon: Clock, title: "Échéance imminente" },
  normal: { className: "text-muted-foreground", Icon: null, title: null },
  none: { className: "text-muted-foreground", Icon: null, title: null },
};

export function DueDate({
  due,
  statut,
  className = "",
  testId,
}: {
  due: TaskDueDate;
  statut?: TaskStatus;
  className?: string;
  testId?: string;
}) {
  const { className: urgencyClass, Icon, title } = URGENCY[getDueUrgency(due, statut)];
  return (
    <span
      data-testid={testId}
      title={title ?? undefined}
      className={`inline-flex items-center gap-1 ${urgencyClass} ${className}`}
    >
      {Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
      {formatDue(due)}
    </span>
  );
}
