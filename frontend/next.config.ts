import type { NextConfig } from "next";

/**
 * En-tetes de securite HTTP (requirements.md §8 Securite).
 *
 * Ajoutes via la cle `headers()` du next.config (cf. docs Next.js 16 —
 * api-reference/config/next-config-js/headers). Appliques a TOUTES les routes
 * (`/:path*`). Objectif : durcir les reponses (anti-clickjacking, anti-MIME-sniffing,
 * confidentialite du Referer, HTTPS force) sans rien casser du rendu.
 *
 * La CSP est volontairement en mode `Content-Security-Policy-Report-Only` (NON
 * bloquant) : on OBSERVE les violations reelles en production avant de durcir vers une
 * CSP applicative. `connect-src` doit autoriser les DEUX destinations que le navigateur
 * appelle EN DIRECT : Supabase (auth + Storage) et l'API FastAPI (upload PDF direct,
 * cf. lib/api/attachment-actions.ts). `style-src` inclut `'unsafe-inline'` car Next.js
 * injecte des styles inline (styled-jsx / CSS critique) ; on ne met PAS `'unsafe-inline'`
 * sur les scripts afin que le rapport revele honnetement le travail restant (nonce/hash)
 * avant un eventuel passage en mode bloquant.
 */

// Base URL de l'API FastAPI (surface navigateur, NEXT_PUBLIC_). Peut etre absente au
// build : dans ce cas on ne l'ajoute simplement pas a `connect-src`.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

const connectSrc = ["'self'", "https://*.supabase.co", apiBaseUrl]
  .filter((source): source is string => Boolean(source))
  .join(" ");

const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  `connect-src ${connectSrc}`,
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  // Anti-clickjacking (double a `frame-ancestors 'none'` de la CSP pour les vieux UA).
  { key: "X-Frame-Options", value: "DENY" },
  // Empeche le navigateur de "deviner" le type MIME (anti-XSS sur fichiers uploades).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ne fuit pas le chemin complet vers les origines tierces.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS (2 ans, sous-domaines inclus).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // CSP en observation (non bloquante) — voir commentaire d'en-tete.
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicyReportOnly },
];

const nextConfig: NextConfig = {
  // `standalone` produit une sortie autonome pour la conteneurisation (Dockerfile /
  // self-hosting). Sur Vercel (variable VERCEL=1 pendant le build), on laisse Vercel
  // gerer sa propre sortie : on desactive donc `standalone` pour eviter toute
  // interference avec la plateforme cible principale (§6.1).
  output: process.env.VERCEL ? undefined : "standalone",

  experimental: {
    serverActions: {
      // L'upload des pieces jointes PDF (§5) passe par une Server Action recevant le
      // fichier en FormData. La limite par defaut (1 Mo) doit etre relevee au-dessus de
      // la limite metier (10 Mo, + surcout multipart). Le backend applique la vraie
      // limite stricte de 10 Mo (413 si depassement).
      bodySizeLimit: "12mb",
    },
  },

  // En-tetes de securite appliques a toutes les routes (§8).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
