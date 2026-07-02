/**
 * Preference de vue Kanban / Liste (requirements.md §4.5).
 *
 * La vue choisie est memorisee en **sessionStorage** (et non localStorage) : elle
 * persiste pendant la session (l'onglet) puis se reinitialise a sa fermeture (regle
 * confirmee §4.5). La cle est un contrat partage avec les tests E2E.
 */
export const PREFERRED_VIEW_KEY = "todoso:preferred-view";

export type PreferredView = "kanban" | "list";

/** Memorise la vue choisie explicitement par l'utilisateur (via la bascule). */
export function rememberPreferredView(view: PreferredView): void {
  try {
    sessionStorage.setItem(PREFERRED_VIEW_KEY, view);
  } catch {
    // sessionStorage indisponible (SSR / mode prive) : la preference est simplement
    // non persistee, ce qui est un comportement degrade acceptable.
  }
}

/** Lit la derniere vue memorisee dans la session, ou null si aucune. */
export function readPreferredView(): PreferredView | null {
  try {
    const value = sessionStorage.getItem(PREFERRED_VIEW_KEY);
    return value === "kanban" || value === "list" ? value : null;
  } catch {
    return null;
  }
}
