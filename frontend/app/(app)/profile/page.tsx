import { apiFetch } from "@/lib/api/client";
import { createSupabaseServerClient, getAccessToken } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/domain";

/**
 * Profil utilisateur (requirements.md §4.7, table `profiles` §5).
 *
 * Server Component : l'email provient de la SESSION Supabase Auth (source de verite),
 * le nom de la table `profiles` (via l'API). Plus de valeurs statiques « — ».
 *
 * NOTE (donnee) : si le nom est vide en base pour un compte cree MANUELLEMENT dans le
 * dashboard Supabase (hors trigger `handle_new_user`), on retombe sur les
 * metadonnees Auth puis sur la partie locale de l'email. Un backfill SQL est fourni
 * dans le rapport pour corriger durablement les lignes `profiles` incompletes.
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

async function loadCurrentProfile(): Promise<Profile | null> {
  try {
    const accessToken = await getAccessToken();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const profiles = await apiFetch<Profile[]>("/api/v1/profiles", { accessToken });
    const profile = profiles.find((p) => p.id === user.id) ?? null;

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const metaNom = [meta?.nom, meta?.full_name, meta?.name].find(
      (v): v is string => typeof v === "string" && v.trim() !== "",
    );
    const email = user.email ?? profile?.email ?? null;

    return {
      id: user.id,
      email: email ?? "—",
      nom:
        profile?.nom?.trim() ||
        metaNom ||
        (email ? email.split("@")[0] ?? "—" : "—"),
      avatar: profile?.avatar ?? null,
    };
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  const profile = await loadCurrentProfile();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Informations de votre compte.</p>
      </header>

      {profile === null ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Impossible de charger votre profil. Verifiez votre connexion et reessayez.
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials(profile.nom) || "?"}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{profile.nom}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Nom</dt>
              <dd className="text-sm font-medium">{profile.nom}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium">{profile.email}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
