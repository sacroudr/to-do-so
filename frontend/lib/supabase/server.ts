/**
 * Client Supabase pour le contexte serveur (Server Components, Route Handlers,
 * Server Actions).
 *
 * IMPORTANT (Next.js 16) : `cookies()` est une API asynchrone et doit etre await
 * (breaking change v15/16 — cf. docs upgrading/version-16). Ce client lit / ecrit
 * la session via les cookies de la requete.
 *
 * Ce client sert a lire l'utilisateur cote serveur et a recuperer le JWT a
 * transmettre a l'API FastAPI. Il n'ecrit PAS directement en base : toute lecture /
 * ecriture metier passe par l'API Python qui verifie le JWT (§6.2).
 */
import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { supabaseEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` peut etre appele depuis un Server Component ou la mutation des
          // cookies est interdite. La rotation du token est alors geree par proxy.ts.
        }
      },
    },
  });
}

/** Recupere le JWT d'acces Supabase de la session courante (ou null). */
export async function getAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
