/**
 * Squelette de chargement de la page Projets (§8). Reproduit l'en-tete + une grille
 * de cartes, pour un retour visuel immediat pendant le chargement des donnees.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded bg-foreground/10" />
        <div className="h-10 w-40 rounded-lg bg-foreground/5" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
