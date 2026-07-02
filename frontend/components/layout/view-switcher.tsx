"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { rememberPreferredView, type PreferredView } from "@/lib/tasks/view-preference";

/**
 * Bascule Kanban / Liste (requirements.md §4.5).
 *
 * Controle clairement visible permettant de choisir sa vue a tout moment. La vue
 * active est deduite de l'URL courante. Un clic MEMORISE la vue choisie en
 * sessionStorage (decision 3) : le point d'entree neutre `/board` la reapplique, et
 * la preference se reinitialise a la fermeture de l'onglet.
 */
const VIEWS: readonly { href: string; label: string; view: PreferredView }[] = [
  { href: "/kanban", label: "Kanban", view: "kanban" },
  { href: "/list", label: "Liste", view: "list" },
] as const;

export function ViewSwitcher() {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {VIEWS.map((view) => {
        const active = pathname.startsWith(view.href);
        return (
          <Link
            key={view.href}
            href={view.href}
            aria-current={active ? "page" : undefined}
            onClick={() => rememberPreferredView(view.view)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-on-primary"
                : "text-muted-foreground hover:bg-foreground/5"
            }`}
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
