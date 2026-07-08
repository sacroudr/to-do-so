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
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              {initials(profile.nom) || "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{profile.nom}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
