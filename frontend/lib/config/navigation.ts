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
}

export interface NavSection {
  /** Titre de groupe optionnel dans la sidebar. */
  title?: string;
  items: NavItem[];
}

/** Sections actives en phase 1 (MVP). */
export const PRIMARY_NAV: NavSection = {
  title: "Espace de travail",
  items: [
    { label: "Tableau de bord", href: "/dashboard", icon: "layout-dashboard" },
    { label: "Vue Kanban", href: "/kanban", icon: "columns" },
    { label: "Vue Liste", href: "/list", icon: "list" },
    { label: "Projets", href: "/projects", icon: "folder" },
    // Point 2 : personnes assignables (team_members) ; page Archive (taches terminees).
    { label: "Utilisateurs", href: "/users", icon: "users" },
    { label: "Archive", href: "/archive", icon: "archive" },
  ],
};

/** Section basse : profil + deconnexion (§4.7). */
export const USER_NAV: NavSection = {
  items: [{ label: "Profil", href: "/profile", icon: "user" }],
};
