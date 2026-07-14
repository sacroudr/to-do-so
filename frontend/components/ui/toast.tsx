"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Systeme de notifications global (§8 — feedback : succes / erreur / info).
 *
 * Unique source de retour transitoire de l'application. Il REMPLACE les mecanismes
 * heterogenes precedents (banniere `ActionError`, `<p className="text-danger">` inline,
 * detournement du message des `ConfirmDialog`) et couvre enfin le SUCCES partout
 * (creation / modification / suppression, upload, cochage, glisser-deposer Kanban...).
 *
 * A11y (skill design + WCAG) : la zone est une region `aria-live="polite"` qui n'accapare
 * JAMAIS le focus ; chaque toast porte une ICONE distincte (la couleur n'est jamais le seul
 * indicateur) et le MESSAGE reste en `text-foreground` (contraste garanti, la couleur de
 * variante n'habille que l'icone et le liseré). Auto-disparition apres `AUTO_DISMISS_MS`,
 * fermeture manuelle possible. Monte une seule fois, dans la coquille applicative.
 */
export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

export interface ToastApi {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Duree d'affichage avant disparition automatique (skill : 3–5 s). */
const AUTO_DISMISS_MS = 4000;

const VARIANT_META: Record<
  ToastVariant,
  { Icon: typeof CheckCircle2; accentClass: string; iconClass: string }
> = {
  success: { Icon: CheckCircle2, accentClass: "border-l-success", iconClass: "text-success" },
  error: { Icon: AlertCircle, accentClass: "border-l-danger", iconClass: "text-danger" },
  info: { Icon: Info, accentClass: "border-l-primary", iconClass: "text-primary" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number): void => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant = "info"): void => {
      const id = (nextId.current += 1);
      setItems((prev) => [...prev, { id, variant, message }]);
      // Disparition automatique ; la fermeture manuelle rend l'id introuvable -> no-op.
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {items.map((item) => {
          const { Icon, accentClass, iconClass } = VARIANT_META[item.variant];
          return (
            <div
              key={item.id}
              role="status"
              className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-l-4 border-border bg-surface px-3.5 py-3 text-sm text-foreground shadow-lg ${accentClass}`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} aria-hidden />
              <span className="flex-1">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Fermer la notification"
                className="-mr-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Accede a l'API de notifications. Doit etre appele sous un `<ToastProvider>` (monte dans
 * la coquille applicative `app/(app)/layout.tsx`) — l'erreur explicite signale un oubli.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast doit être utilisé à l'intérieur d'un <ToastProvider>.");
  }
  return ctx;
}
