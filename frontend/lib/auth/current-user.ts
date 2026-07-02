import { cache } from "react";

import { apiFetch } from "@/lib/api/client";
import { createSupabaseServerClient, getAccessToken } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/domain";

/**
 * Profil de l'utilisateur connecte (requirements.md §4.7, table `profiles` §5).
 *
 * Source de verite : l'email provient de la SESSION Supabase Auth, le nom de la table
 * `profiles` (via l'API). Repli sur les metadonnees Auth puis la partie locale de
 * l'email si le nom est vide (compte cree manuellement hors trigger `handle_new_user`).
 *
 * `cache()` memoise l'appel pour la DUREE D'UNE REQUETE : le layout (identite en pied
 * de sidebar) et la page Profil partagent ainsi un seul appel reseau. En cas d'echec
 * (session absente / API injoignable), renvoie `null` sans lever — l'UI degrade
 * proprement (sidebar sans carte utilisateur, page Profil avec message).
 */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
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
});
