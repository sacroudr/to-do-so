/**
 * Filtres par responsable / projet — E2E (requirements.md §4.6).
 *
 * Criteres d'acceptation (§4.6) :
 *   - Filtrage des taches par responsable.
 *   - Filtrage des taches par projet.
 *   - Ces filtres s'appliquent AUSSI BIEN a la vue Kanban qu'a la vue Liste.
 *
 * CONTRAT DE SELECTEURS ASSUME (a implementer — voir « Points a clarifier ») :
 *   - Filtre responsable : [data-testid="filter-assignee"] (select ; option = nom)
 *   - Filtre projet      : [data-testid="filter-project"]  (select ; option = nom)
 *   - Element de tache visible :
 *       * Kanban : [data-testid="task-card"] (attribut data-assignee-ids, data-project-id)
 *       * Liste  : [data-testid="task-row"]  (attribut data-assignee-ids, data-project-id)
 *
 * PREREQUIS : app lancee, session authentifiee, jeu de taches couvrant plusieurs
 * responsables et plusieurs projets (valeurs connues injectees ci-dessous).
 */
import { expect, test } from "@playwright/test";

// Valeurs de test a aligner sur le seed (placeholders explicites).
const RESPONSABLE = "Alice";
const PROJET = "Sage 100";

// Les filtres doivent se comporter identiquement sur les deux vues (§4.6).
for (const view of [
  { name: "Kanban", path: "/kanban", item: '[data-testid="task-card"]' },
  { name: "Liste", path: "/list", item: '[data-testid="task-row"]' },
]) {
  test.describe(`Filtres sur la vue ${view.name} (§4.6)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(view.path);
    });

    test(`should_filter_by_assignee_on_${view.name}`, async ({ page }) => {
      // GIVEN la vue affiche des taches de plusieurs responsables
      await expect(page.locator(view.item).first()).toBeVisible();
      // WHEN on selectionne un responsable dans le filtre
      await page.locator('[data-testid="filter-assignee"]').selectOption({ label: RESPONSABLE });
      // THEN toutes les taches visibles concernent ce responsable
      const items = page.locator(view.item);
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(items.nth(i)).toContainText(RESPONSABLE);
      }
    });

    test(`should_filter_by_project_on_${view.name}`, async ({ page }) => {
      // GIVEN la vue affiche des taches de plusieurs projets
      await expect(page.locator(view.item).first()).toBeVisible();
      // WHEN on selectionne un projet dans le filtre
      await page.locator('[data-testid="filter-project"]').selectOption({ label: PROJET });
      // THEN toutes les taches visibles appartiennent a ce projet
      const items = page.locator(view.item);
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(items.nth(i)).toContainText(PROJET);
      }
    });

    test(`should_combine_assignee_and_project_filters_on_${view.name}`, async ({ page }) => {
      // WHEN on applique les deux filtres simultanement
      await page.locator('[data-testid="filter-assignee"]').selectOption({ label: RESPONSABLE });
      await page.locator('[data-testid="filter-project"]').selectOption({ label: PROJET });
      // THEN chaque tache visible satisfait les DEUX criteres (ET logique)
      const items = page.locator(view.item);
      const count = await items.count();
      for (let i = 0; i < count; i++) {
        await expect(items.nth(i)).toContainText(RESPONSABLE);
        await expect(items.nth(i)).toContainText(PROJET);
      }
    });
  });
}
