/**
 * Layout du groupe (auth) — ecrans de connexion / recuperation.
 *
 * Groupe de routes entre parentheses : « (auth) » n'apparait PAS dans l'URL
 * (convention App Router). Ce layout n'affiche PAS la sidebar : les pages d'auth
 * sont volontairement epurees et centrees.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">To-Do-So</h1>
          <p className="mt-1 text-sm text-foreground/60">Suivi des taches de l&apos;equipe</p>
        </div>
        {children}
      </div>
    </div>
  );
}
