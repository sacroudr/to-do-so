import { Sidebar } from "@/components/layout/sidebar";

/**
 * Coquille applicative (groupe (app)) — toutes les pages authentifiees.
 *
 * Fournit la navigation par sidebar (§4.7). Le groupe « (app) » n'apparait pas dans
 * l'URL. La protection d'acces est assuree en amont par proxy.ts.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
