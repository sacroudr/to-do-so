/**
 * Vue Kanban — E2E (requirements.md §4.3).
 *
 * Criteres d'acceptation (§4.3) :
 *   - Colonnes correspondant aux differents statuts.
 *   - Chaque carte affiche titre, projet, responsable(s), echeance et priorite.
 *   - Changement de statut par glisser-deposer entre colonnes.
 *
 * CONTRAT DE SELECTEURS ASSUME (a implementer — voir « Points a clarifier ») :
 *   - Colonne de statut : [data-testid="kanban-column"][data-status="<statut>"]
 *   - Carte de tache    : [data-testid="task-card"][data-task-id="<id>"]
 *       * titre       : [data-testid="task-card-title"]
 *       * projet      : [data-testid="task-card-project"]
 *       * responsables: [data-testid="task-card-assignees"]
 *       * echeance    : [data-testid="task-card-due"]
 *       * priorite    : [data-testid="task-card-priority"]
 *
 * PREREQUIS : app lancee, session authentifiee, au moins une tache de test connue.
 */
import { expect, test } from "@playwright/test";

test.describe("Vue Kanban (§4.3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/kanban");
  });

  test("should_render_one_column_per_status", async ({ page }) => {
    // GIVEN la vue Kanban
    // THEN il existe une colonne pour chacun des 6 statuts (reduction 9 -> 6, point 1)
    for (const status of [
      "a_planifier",
      "todo",
      "in_progress",
      "a_tester",
      "a_corriger",
      "done",
    ]) {
      await expect(
        page.locator(`[data-testid="kanban-column"][data-status="${status}"]`),
      ).toBeVisible();
    }
  });

  test("should_display_all_required_fields_on_a_card", async ({ page }) => {
    // GIVEN une carte de tache
    const card = page.locator('[data-testid="task-card"]').first();
    await expect(card).toBeVisible();
    // THEN elle affiche titre, projet, responsable(s), echeance et priorite (§4.3)
    await expect(card.locator('[data-testid="task-card-title"]')).toBeVisible();
    await expect(card.locator('[data-testid="task-card-project"]')).toBeVisible();
    await expect(card.locator('[data-testid="task-card-assignees"]')).toBeVisible();
    await expect(card.locator('[data-testid="task-card-due"]')).toBeVisible();
    await expect(card.locator('[data-testid="task-card-priority"]')).toBeVisible();
  });

  test("should_update_status_when_card_is_dragged_to_another_column", async ({ page }) => {
    // GIVEN une carte dans la colonne "todo"
    const todoColumn = page.locator('[data-testid="kanban-column"][data-status="todo"]');
    const card = todoColumn.locator('[data-testid="task-card"]').first();
    await expect(card).toBeVisible();
    const taskId = await card.getAttribute("data-task-id");
    const inProgress = page.locator('[data-testid="kanban-column"][data-status="in_progress"]');

    // WHEN on la glisse-depose vers la colonne "in_progress"
    await card.dragTo(inProgress);

    // THEN la carte appartient desormais a la colonne "in_progress" (statut mis a jour)
    await expect(
      inProgress.locator(`[data-testid="task-card"][data-task-id="${taskId}"]`),
    ).toBeVisible();
    await expect(
      todoColumn.locator(`[data-testid="task-card"][data-task-id="${taskId}"]`),
    ).toHaveCount(0);

    // AND le changement persiste apres rechargement (persistance en base)
    await page.reload();
    await expect(
      page
        .locator('[data-testid="kanban-column"][data-status="in_progress"]')
        .locator(`[data-testid="task-card"][data-task-id="${taskId}"]`),
    ).toBeVisible();
  });
});
