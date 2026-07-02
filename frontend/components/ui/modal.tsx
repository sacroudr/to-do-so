"use client";

import { useEffect, useRef } from "react";

/**
 * Coquille de modale accessible (§1 a11y — mutualisee par les dialogues).
 *
 * Prend en charge : voile + flou, fermeture au clic hors panneau, fermeture par
 * Echap, PIEGE DE FOCUS (Tab boucle a l'interieur), mise au point automatique du
 * premier champ a l'ouverture, et blocage du defilement de l'arriere-plan. Le panneau
 * porte `role="dialog"` + `aria-modal`, etiquete via `labelledBy` (id du titre) ou
 * `ariaLabel`.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  ariaLabel,
  labelledBy,
  className = "max-w-lg",
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function focusables(): HTMLElement[] {
      const panel = panelRef.current;
      if (!panel) return [];
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = focusables();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const panel = panelRef.current;

      if (event.shiftKey && (active === first || !panel?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Mise au point : champ marque en priorite, sinon 1er champ, sinon panneau.
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    target?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`my-8 w-full rounded-xl border border-border bg-surface shadow-lg outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
