"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Recuperation de mot de passe oublie (requirements.md §4.1).
 *
 * Delegue a Supabase Auth (resetPasswordForEmail). Meme direction visuelle que l'ecran
 * de connexion (champ a icone, bouton primaire, etats de chargement / succes styles).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    // Le lien de l'email revient sur /auth/callback (echange du code -> session),
    // qui redirige ensuite vers /reset-password (saisie du nouveau mot de passe).
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    // On NE confirme « envoye » que si Supabase n'a pas renvoye d'erreur. Supabase
    // repond deja « succes » pour un email inexistant (anti-enumeration) : ce garde-fou
    // ne fait donc que surfacer les VRAIES erreurs (quota d'envoi 429, SMTP, reseau),
    // qui etaient auparavant masquees par un « email envoye » toujours affiche.
    if (resetError) {
      setError(
        resetError.status === 429
          ? "Trop de demandes en peu de temps. Patientez quelques minutes puis réessayez."
          : "L'envoi de l'email a échoué. Réessayez dans un instant ; si le problème persiste, contactez l'administrateur.",
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Vérifiez votre boîte mail</h2>
          <p className="text-sm text-muted-foreground">
            Si un compte existe pour{" "}
            <span className="font-medium text-foreground">{email}</span>, un lien de
            réinitialisation vient d&apos;être envoyé.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Mot de passe oublié</h2>
        <p className="text-sm text-muted-foreground">
          Entrez votre email pour recevoir un lien de réinitialisation.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9 pr-3"
          />
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      <Button type="submit" loading={loading} className="w-full">
        Envoyer le lien de réinitialisation
      </Button>

      <p className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
