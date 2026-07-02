/**
 * Configuration de la barre laterale (requirements.md §4.7).
 *
 * La navigation est PILOTEE PAR LA DONNEE : ajouter une section future (§2.2 —
 * notifications, statistiques, roles, historique...) revient a ajouter une entree
 * ici, sans toucher au composant Sidebar. C'est le point d'extensibilite exige
 * par le critere de succes §10 (« pas de refonte de l'architecture »).
 */

export interface NavItem {
  /** Libelle affiche dans la sidebar. */
  label: string;
  /** Route Next.js (App Router). */
  href: string;
  /** Nom d'icone (a mapper vers une librairie d'icones lors de l'implementation UI). */
  icon: string;
  /** false = section prevue mais desactivee en phase 1 (§2.2). */
  enabled: boolean;
}

export interface NavSection {
  /** Titre de groupe optionnel dans la sidebar. */
  title?: string;
  items: NavItem[];
}

/** Sections actives en phase 1 (MVP). */
export const PRIMARY_NAV: NavSection = {
  items: [
    { label: "Tableau de bord", href: "/dashboard", icon: "layout-dashboard", enabled: true },
    { label: "Vue Kanban", href: "/kanban", icon: "columns", enabled: true },
    { label: "Vue Liste", href: "/list", icon: "list", enabled: true },
    { label: "Projets", href: "/projects", icon: "folder", enabled: true },
  ],
};

/**
 * Sections envisagees (§2.2). Presentes mais desactivees : elles reservent la place
 * dans la navigation et montrent l'intention d'evolution sans etre routables en phase 1.
 */
export const FUTURE_NAV: NavSection = {
  title: "A venir",
  items: [
    { label: "Notifications", href: "/notifications", icon: "bell", enabled: false },
    { label: "Statistiques", href: "/stats", icon: "bar-chart", enabled: false },
    { label: "Administration", href: "/admin", icon: "shield", enabled: false },
  ],
};

/** Section basse : profil + deconnexion (§4.7). */
export const USER_NAV: NavSection = {
  items: [{ label: "Profil", href: "/profile", icon: "user", enabled: true }],
};
