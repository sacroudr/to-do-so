/**
 * Squelette de chargement du tableau de bord (§8 — retour visuel immediat pendant
 * les appels API, plutot qu'un ecran fige). Reproduit la structure : 6 cartes de
 * statut + 2 panneaux (le bloc « En retard » est conditionnel, non esquisse).
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded bg-foreground/10" />
        <div className="h-4 w-72 rounded bg-foreground/5" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-border bg-surface" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
