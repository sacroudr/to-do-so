/**
 * Validation centralisee des variables d'environnement cote frontend.
 *
 * Regle projet : AUCUNE valeur de configuration n'est ecrite en dur. Tout passe
 * par des variables d'environnement (voir .env.example). Les variables exposees au
 * navigateur DOIVENT etre prefixees `NEXT_PUBLIC_` (cf. docs Next.js 16 —
 * environment-variables). On echoue tot et clairement si une variable manque.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Variable d'environnement manquante: ${name}. Copiez .env.example vers .env.local et renseignez-la.`,
    );
  }
  return value;
}

/** URL et cle publique du projet Supabase (surface navigateur, donc NEXT_PUBLIC_). */
export const supabaseEnv = {
  url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  anonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
};

/** Base URL de l'API FastAPI vers laquelle le frontend enverra le JWT. */
export const apiEnv = {
  baseUrl: required("NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL),
};
