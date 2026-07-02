import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` produit une sortie autonome pour la conteneurisation (Dockerfile).
  // Sans effet sur un deploiement Vercel, qui reste la cible principale (§6.1).
  output: "standalone",
};

export default nextConfig;
