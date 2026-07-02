import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Coquille applicative (groupe (app)) — toutes les pages authentifiees.
 *
 * Fournit la navigation par sidebar (§4.7). Le groupe « (app) » n'apparait pas dans
 * l'URL. La protection d'acces est assuree en amont par proxy.ts. On resout ici
 * l'utilisateur connecte (memoise par requete, cf. `getCurrentUser`) pour afficher son
 * identite en pied de sidebar.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Hauteur de viewport EXPLICITE (h-dvh) plutot qu'une chaine de `flex-1` en
  // pourcentage : la coquille occupe tout l'ecran, la sidebar s'etire donc sur toute
  // la hauteur (pied profil / deconnexion cale en bas) et SEUL le contenu defile
  // (`overflow-y-auto` sur <main>), sans double barre de defilement.
  return (
    <div className="flex h-dvh">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
