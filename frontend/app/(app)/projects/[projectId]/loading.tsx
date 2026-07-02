/**
 * UI de chargement pour la route dynamique projet (recommande par la doc Next.js 16
 * pour activer le prefetch partiel et un retour visuel immediat).
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-foreground/10" />
      <div className="h-40 rounded-xl bg-foreground/5" />
    </div>
  );
}
