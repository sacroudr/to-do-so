import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Profil utilisateur (requirements.md §4.7, table `profiles` §5).
 *
 * Server Component : reutilise `getCurrentUser` (l'email vient de la SESSION Supabase
 * Auth, le nom de la table `profiles`). Ce meme helper alimente l'identite en pied de
 * sidebar ; memoise par requete, il n'entraine pas de double appel reseau.
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ProfilePage() {
  const profile = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Informations de votre compte.</p>
      </header>

      {profile === null ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Impossible de charger votre profil. Vérifiez votre connexion et réessayez.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-4 border-b border-border p-6">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              {initials(profile.nom) || "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                {profile.nom}
              </p>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          {/* Details en liste de definitions : hierarchie label -> valeur claire (lecture seule). */}
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 px-6 py-3.5">
              <dt className="text-sm text-muted-foreground">Nom</dt>
              <dd className="truncate text-sm font-medium text-foreground">{profile.nom}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-6 py-3.5">
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="truncate text-sm font-medium text-foreground">{profile.email}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
