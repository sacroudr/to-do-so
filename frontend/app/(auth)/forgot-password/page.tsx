"use client";

import Link from "next/link";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Recuperation de mot de passe oublie (requirements.md §4.1).
 *
 * Delegue a Supabase Auth (resetPasswordForEmail). Squelette fonctionnel.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(email);

    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm">
          Si un compte existe pour <span className="font-medium">{email}</span>, un email
          de reinitialisation vient d&apos;etre envoye.
        </p>
        <Link href="/login" className="text-sm text-status-progress hover:underline">
          Retour a la connexion
        </Link>
      </div>
    );
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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-status-progress px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Envoi..." : "Envoyer le lien de reinitialisation"}
      </button>

      <p className="text-center text-sm text-foreground/60">
        <Link href="/login" className="hover:underline">
          Retour a la connexion
        </Link>
      </p>
    </form>
  );
}
