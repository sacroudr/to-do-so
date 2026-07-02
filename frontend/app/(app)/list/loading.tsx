/**
 * Squelette de chargement de la vue Liste (§8). Reproduit l'en-tete + un tableau de
 * lignes, pour un retour visuel immediat pendant le chargement / le tri / le filtre.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-40 rounded bg-foreground/10" />
        <div className="h-9 w-64 rounded bg-foreground/5" />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="h-11 border-b border-border bg-surface-muted" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <div className="h-4 flex-1 rounded bg-foreground/10" />
            <div className="h-4 w-24 rounded bg-foreground/5" />
            <div className="h-4 w-20 rounded bg-foreground/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
