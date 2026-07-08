"use client";

import {
  BarChart3,
  Bell,
  Columns3,
  Folder,
  LayoutDashboard,
  List,
  ListChecks,
  LogOut,
  Shield,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  FUTURE_NAV,
  PRIMARY_NAV,
  USER_NAV,
  type NavItem,
  type NavSection,
} from "@/lib/config/navigation";
import type { Profile } from "@/lib/types/domain";

/**
 * Barre laterale (requirements.md §4.7).
 *
 * Composant PUREMENT presentationnel et pilote par la configuration
 * (lib/config/navigation.ts). Il n'importe volontairement PAS le SDK Supabase :
 * l'identite affichee en pied lui est fournie par le layout (Server Component), et la
 * deconnexion passe par un Route Handler (POST /auth/signout). Ajouter une section
 * future (§2.2) = ajouter une entree dans la config + son icone dans la table ci-dessous.
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

const NAV_BASE =
  "group/link relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (!item.enabled) {
    return (
      <span
        className={`${NAV_BASE} cursor-not-allowed text-muted-foreground/50`}
        title="Fonctionnalité à venir"
        aria-disabled="true"
      >
        <NavIcon name={item.icon} />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          bientôt
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${NAV_BASE} ${
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary"
        />
      ) : null}
      <NavIcon name={item.icon} />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function NavGroup({
  section,
  isActive,
}: {
  section: NavSection;
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {section.title ? (
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {section.title}
        </p>
      ) : null}
      {section.items.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({ user }: { user?: Profile | null }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const profileHref = USER_NAV.items[0]?.href ?? "/profile";
  const profileActive = isActive(profileHref);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      {/* Marque : pastille logo + nom de produit. */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-on-primary">
          <ListChecks className="size-5" aria-hidden />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">To-Do-So</span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
        <NavGroup section={PRIMARY_NAV} isActive={isActive} />
        <NavGroup section={FUTURE_NAV} isActive={isActive} />
      </nav>

      <div className="border-t border-border p-3">
        {user ? (
          <Link
            href={profileHref}
            aria-current={profileActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
              profileActive ? "bg-primary/10" : "hover:bg-foreground/5"
            }`}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(user.nom) || <User className="size-4" aria-hidden />}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={`truncate text-sm font-medium ${
                  profileActive ? "text-primary" : "text-foreground"
                }`}
              >
                {user.nom}
              </span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          </Link>
        ) : (
          USER_NAV.items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))
        )}

        {/* Deconnexion : POST vers un Route Handler qui invalide la session Supabase. */}
        <form action="/auth/signout" method="post" className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Se déconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
