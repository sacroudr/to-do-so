"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Frontiere d'erreur des pages authentifiees (§8 — robustesse).
 *
 * Capture les exceptions levees au rendu / au chargement des donnees (p. ex. API
 * injoignable ou 500 lors de `getBoardData`) et affiche un ecran de secours style
 * avec une action « Reessayer » (`reset()` re-execute le rendu du segment), plutot
 * que l'overlay brut de Next. Doit etre un Client Component (contrat Next.js).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Journalisation cote client (visible en console navigateur / outils de suivi).
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-surface p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Une erreur est survenue</h1>
        <p className="text-sm text-muted-foreground">
          Le chargement de cette page a échoué. Vérifiez votre connexion, puis
          réessayez.
        </p>
      </div>
      <Button type="button" leftIcon={<RotateCw className="size-4" aria-hidden />} onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
