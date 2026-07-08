import type { NextConfig } from "next";

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
};

export default nextConfig;
