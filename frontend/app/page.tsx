import { redirect } from "next/navigation";

/**
 * Racine de l'application. En phase 1, la page d'accueil est le tableau de bord.
 * L'authentification est prise en charge par proxy.ts : un visiteur non connecte
 * sera redirige vers /login avant meme d'atteindre /dashboard.
 */
export default function RootPage() {
  redirect("/dashboard");
}
