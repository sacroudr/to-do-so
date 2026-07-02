"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { readPreferredView } from "@/lib/tasks/view-preference";

/**
 * Point d'entree neutre des vues (requirements.md §4.5, decision 3).
 *
 * Reapplique la derniere vue choisie pendant la session (sessionStorage) : Liste si
 * elle a ete memorisee, sinon Kanban par defaut. Ne MEMORISE rien (lecture seule) afin
 * qu'une premiere visite sans preference n'ecrive pas la cle.
 */
export default function BoardPage() {
  const router = useRouter();

  useEffect(() => {
    const preferred = readPreferredView();
    router.replace(preferred === "list" ? "/list" : "/kanban");
  }, [router]);

  return (
    <div className="p-6 text-sm text-muted-foreground">Chargement de votre vue...</div>
  );
}
