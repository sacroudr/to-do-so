import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Callback d'authentification Supabase — flux PKCE / « code » (requirements.md §4.1).
 *
 * Les liens envoyes par email (reinitialisation de mot de passe, lien magique) reviennent
 * ici avec un `?code=...`. On l'ECHANGE contre une session (pose les cookies) via
 * `exchangeCodeForSession`, puis on redirige vers `next`. Le verifieur PKCE est stocke en
 * cookie par `@supabase/ssr` (client navigateur), donc lisible ici cote serveur — et
 * comme c'est une Route Handler, l'ecriture des cookies de session est autorisee.
 *
 * Sans cette route, le `code` n'etait jamais echange : aucune session n'etait etablie et
 * la premiere page protegee (dashboard) appelait l'API sans JWT -> 401.
 */
function safeNext(next: string | null): string {
  // Anti open-redirect : on n'autorise que des chemins internes.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code absent, ou echange en echec (lien expire / ouvert dans un autre navigateur
  // que celui d'origine, ou vérifieur PKCE absent) : retour connexion avec un indice.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
