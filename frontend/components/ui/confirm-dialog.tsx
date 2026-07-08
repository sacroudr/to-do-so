"use client";

import { AlertTriangle } from "lucide-react";

import { Modal } from "@/components/ui/modal";

/**
 * Dialogue de confirmation d'action destructive (§8 confirmation-dialogs).
 *
 * Remplace `window.confirm` (boite native qui rompt la direction visuelle) par une
 * modale coherente : icone d'alerte, action de confirmation en style « danger »
 * (rouge), et focus par defaut sur « Annuler » (choix sur par defaut). Herite du
 * piege de focus / Echap / blocage de scroll de `Modal`.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} ariaLabel={title} className="max-w-sm">
      <div className="p-5">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Suppression..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
