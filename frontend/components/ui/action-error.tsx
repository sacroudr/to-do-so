"use client";

import { AlertCircle, X } from "lucide-react";

/**
 * Banniere d'erreur d'action (§8 — ne pas echouer en silence).
 *
 * Les mutations optimistes (glisser-deposer, changement de statut, suppression)
 * reviennent a l'etat serveur en cas d'echec : cette banniere explique POURQUOI plutot
 * que de laisser la carte « re-sauter » sans message. `role="alert"` -> annonce aux
 * lecteurs d'ecran (aria-live implicite).
 */
export function ActionError({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer"
        className="shrink-0 rounded p-0.5 hover:bg-danger/15"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
