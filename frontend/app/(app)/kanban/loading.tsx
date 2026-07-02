/**
 * Squelette de chargement de la vue Kanban (§8). Reproduit l'en-tete + 5 colonnes,
 * afin d'eviter un ecran fige pendant le chargement / l'application d'un filtre.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-40 rounded bg-foreground/10" />
        <div className="h-9 w-64 rounded bg-foreground/5" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-64 flex-col gap-2 rounded-xl border-t-4 border-border bg-surface-muted/60 p-2"
          >
            <div className="mx-1 my-2 h-4 w-24 rounded bg-foreground/10" />
            <div className="h-20 rounded-xl bg-surface" />
            <div className="h-20 rounded-xl bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
