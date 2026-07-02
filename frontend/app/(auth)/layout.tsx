import { ListChecks } from "lucide-react";

/**
 * Layout du groupe (auth) — ecrans de connexion / recuperation.
 *
 * Groupe de routes entre parentheses : « (auth) » n'apparait PAS dans l'URL
 * (convention App Router). Pas de sidebar : ecran centre et epure. La marque (pastille
 * logo + nom) est placee AU-DESSUS de la carte, avec la MEME identite visuelle que la
 * sidebar (coherence produit). `min-h-dvh` garantit le centrage vertical plein ecran.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm">
            <ListChecks className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">To-Do-So</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivi des taches de l&apos;equipe
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acces reserve a l&apos;equipe — les comptes sont crees par l&apos;administrateur.
        </p>
      </div>
    </div>
  );
}
