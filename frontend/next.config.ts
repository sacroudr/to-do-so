import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` produit une sortie autonome pour la conteneurisation (Dockerfile /
  // self-hosting). Sur Vercel (variable VERCEL=1 pendant le build), on laisse Vercel
  // gerer sa propre sortie : on desactive donc `standalone` pour eviter toute
  // interference avec la plateforme cible principale (§6.1).
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
