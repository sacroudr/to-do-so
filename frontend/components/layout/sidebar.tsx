"use client";

import {
  BarChart3,
  Bell,
  Columns3,
  Folder,
  LayoutDashboard,
  List,
  LogOut,
  Shield,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { FUTURE_NAV, PRIMARY_NAV, USER_NAV, type NavItem } from "@/lib/config/navigation";

/**
 * Barre laterale (requirements.md §4.7).
 *
 * Composant PUREMENT presentationnel et pilote par la configuration
 * (lib/config/navigation.ts). Il n'importe volontairement PAS le SDK Supabase :
 * la deconnexion passe par un Route Handler (POST /auth/signout), ce qui garde la
 * coquille applicative legere et permet a l'app de demarrer sans dependance.
 *
 * Ajouter une section future (§2.2) = ajouter une entree dans la config + son icone
 * dans la table ci-dessous.
 */
const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  columns: Columns3,
  list: List,
  folder: Folder,
  bell: Bell,
  "bar-chart": BarChart3,
  shield: Shield,
  user: User,
};

function NavIcon({ name }: { name: string }) {
  const Icon = ICONS[name];
  return Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";

  if (!item.enabled) {
    return (
      <span
        className={`${base} cursor-not-allowed text-muted-foreground/60`}
        title="Fonctionnalite a venir"
        aria-disabled="true"
      >
        <NavIcon name={item.icon} />
        {item.label}
        <span className="ml-auto rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] uppercase">
          bientot
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${base} ${
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      <NavIcon name={item.icon} />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 py-5">
        <span className="text-lg font-semibold tracking-tight">To-Do-So</span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
        <div className="flex flex-col gap-1">
          {PRIMARY_NAV.items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {FUTURE_NAV.title ? (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              {FUTURE_NAV.title}
            </p>
          ) : null}
          {FUTURE_NAV.items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
        {USER_NAV.items.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        {/* Deconnexion : POST vers un Route Handler qui invalide la session Supabase. */}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-status-blocked/10 hover:text-status-blocked"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Se deconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
