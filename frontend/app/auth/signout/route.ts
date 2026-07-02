import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Route Handler de deconnexion (POST /auth/signout).
 *
 * Invalide la session Supabase cote serveur puis redirige vers /login. Isole ici
 * (et non dans la sidebar) pour que la coquille applicative n'embarque pas le SDK
 * Supabase : ce handler n'est compile qu'a l'appel, pas au rendu des pages.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
