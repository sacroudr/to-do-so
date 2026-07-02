/**
 * Vue Liste — E2E (requirements.md §4.4).
 *
 * Criteres d'acceptation (§4.4) :
 *   - Affichage tabulaire de l'ensemble des taches.
 *   - Tri possible par echeance, priorite, statut ou responsable.
 *   - Memes donnees et actions que la vue Kanban.
 *
 * CONTRAT DE SELECTEURS ASSUME (a implementer — voir « Points a clarifier ») :
 *   - Tableau         : [data-testid="task-table"]
 *   - Ligne de tache  : [data-testid="task-row"][data-task-id="<id>"]
 *       -> attribut data-due-kind = "date" | "text" (nature de l'echeance)
 *   - En-tete triable : [data-testid="sort-<cle>"] avec cle ∈ {due,priorite,statut,assignee}
 *       -> aria-sort = "ascending" | "descending" | "none"
 *   - Action changement de statut sur une ligne : [data-testid="row-status-select"]
 *
 * PREREQUIS : app lancee, session authentifiee, plusieurs taches de test dont un
 * melange d'echeances datees ET en texte libre.
 *
 * Regle de tri « echeance » confirmee (§4.4) : les taches DATEES d'abord (par date
 * croissante), PUIS les taches a echeance en TEXTE LIBRE (par created_at croissant).
 */
import { expect, test } from "@playwright/test";

test.describe("Vue Liste (§4.4)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/list");
  });

  test("should_display_tasks_in_a_table", async ({ page }) => {
    // GIVEN la vue Liste
    // THEN un tableau de taches est affiche avec au moins une ligne
    await expect(page.locator('[data-testid="task-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-row"]').first()).toBeVisible();
  });

  for (const key of ["priorite", "statut", "assignee", "due"]) {
    test(`should_toggle_sort_indicator_when_clicking_${key}_header`, async ({ page }) => {
      // GIVEN un en-tete de colonne triable
      const header = page.locator(`[data-testid="sort-${key}"]`);
      await expect(header).toBeVisible();
      // WHEN on clique une fois
      await header.click();
      // THEN la colonne indique un tri ascendant
      await expect(header).toHaveAttribute("aria-sort", "ascending");
      // WHEN on clique de nouveau
      await header.click();
      // THEN le tri s'inverse (descendant)
      await expect(header).toHaveAttribute("aria-sort", "descending");
    });
  }

  test("should_place_dated_rows_before_text_only_rows_when_sorting_by_due", async ({ page }) => {
    // GIVEN un melange de taches datees et de taches a echeance en texte libre
    // WHEN on trie par echeance croissante
    await page.locator('[data-testid="sort-due"]').click();
    await expect(page.locator('[data-testid="sort-due"]')).toHaveAttribute("aria-sort", "ascending");

    // THEN toutes les lignes DATEES precedent toutes les lignes en TEXTE LIBRE
    // (regle confirmee §4.4). On verifie qu'aucune ligne datee n'apparait apres une
    // ligne en texte libre.
    const kinds = await page.locator('[data-testid="task-row"]').evaluateAll((rows) =>
      rows.map((r) => r.getAttribute("data-due-kind")),
    );
    const firstText = kinds.indexOf("text");
    if (firstText !== -1) {
      expect(kinds.slice(firstText).every((k) => k === "text")).toBe(true);
    }
  });

  test("should_offer_same_actions_as_kanban_change_status", async ({ page }) => {
    // GIVEN une ligne de tache
    const row = page.locator('[data-testid="task-row"]').first();
    // THEN un controle de changement de statut est disponible (memes actions qu'en Kanban, §4.4)
    await expect(row.locator('[data-testid="row-status-select"]')).toBeVisible();
  });
});
