import { ListChecks } from "lucide-react";

import type { SubtaskProgress as SubtaskProgressValue } from "@/lib/types/domain";

/**
 * Badge DISCRET d'avancement de la checklist (§4.2, extension).
 *
 * Volontairement NEUTRE (surface attenuee + texte secondaire) : ce n'est ni une
 * action de marque (pas de bleu `--primary`) ni un statut (pas de couleur de statut).
 * Il informe sans capter l'attention. Ne s'affiche que si la tache a des sous-taches
 * (`total > 0`) — le composant se protege lui-meme pour rester simple a appeler.
 * Composant presentationnel, utilisable cote serveur comme client.
 */
export function SubtaskProgress({
  progress,
  className = "",
}: {
  progress: SubtaskProgressValue;
  className?: string;
}) {
  if (progress.total <= 0) return null;

  const label = `${progress.done} sur ${progress.total} sous-tâches terminées`;
  return (
    <span
      data-testid="subtask-progress"
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground ${className}`}
    >
      <ListChecks className="size-3" aria-hidden />
      {progress.done}/{progress.total}
    </span>
  );
}
