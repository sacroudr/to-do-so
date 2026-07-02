/**
 * Client Supabase pour les Client Components (navigateur).
 *
 * Utilise dans les composants marques "use client" (ex. formulaire de connexion).
 * L'authentification (email / mot de passe) est DELEGUEE a Supabase Auth : c'est ce
 * client qui appelle signInWithPassword / signOut / resetPasswordForEmail, et qui
 * gere la session (JWT) via les cookies geres par @supabase/ssr.
 *
 * Voir requirements.md §6.2 : le frontend delegue l'auth a Supabase Auth.
 */
import { createBrowserClient } from "@supabase/ssr";

import { supabaseEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey);
}
