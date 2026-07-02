"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Ecran de connexion (requirements.md §4.1).
 *
 * L'authentification est DELEGUEE a Supabase Auth (email + mot de passe). Aucun mot
 * de passe ne transite ni n'est stocke par notre code : signInWithPassword gere le
 * hachage et l'emission du JWT cote Supabase (§8 Securite). Il n'y a PAS d'inscription
 * libre — les comptes sont crees en amont pour l'equipe (§4.1).
 *
 * Ceci est un squelette fonctionnel : la gestion fine des erreurs / etats de
 * chargement pourra etre enrichie lors de l'implementation.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError("Identifiants invalides. Veuillez reessayer.");
      return;
    }
    router.push(redirectedFrom);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-progress"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-progress"
        />
      </div>

      {error ? <p className="text-sm text-status-blocked">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-status-progress px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>

      <p className="text-center text-sm text-foreground/60">
        <Link href="/forgot-password" className="hover:underline">
          Mot de passe oublie ?
        </Link>
      </p>
    </form>
  );
}

/**
 * `useSearchParams` doit etre encapsule dans une frontiere <Suspense> (Next.js 16 :
 * evite le bailout CSR au prerendu statique de la page).
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
