/**
 * Bascule entre les vues — E2E (requirements.md §4.5).
 *
 * Critere d'acceptation (§4.5) : « Un controle clairement visible permet a
 * l'utilisateur de choisir sa vue preferee (Kanban ou Liste) a tout moment. »
 *
 * La logique interne du controle (etat actif) est deja couverte en unitaire
 * (__tests__/view-switcher.test.tsx). Ici on valide le PARCOURS reel : le clic
 * change effectivement de vue, ET la vue choisie est memorisee pendant la session.
 *
 * CONTRAT ASSUME (a implementer) :
 *   - La vue choisie est persistee dans sessionStorage sous la cle
 *     `todoso:preferred-view` (valeurs "kanban" | "list"). sessionStorage (et non
 *     localStorage) : la preference se reinitialise a la fermeture de l'onglet (regle
 *     confirmee, §4.5).
 *   - Un point d'entree neutre des vues (`/board`) applique la derniere vue memorisee.
 *
 * PREREQUIS : app lancee, session authentifiee.
 */
const PREF_KEY = "todoso:preferred-view";
import { expect, test } from "@playwright/test";

test.describe("Bascule de vue (§4.5)", () => {
  test("should_switch_from_kanban_to_list_and_back", async ({ page }) => {
    // GIVEN l'utilisateur est sur la vue Kanban
    await page.goto("/kanban");
    await expect(page.getByRole("link", { name: "Kanban" })).toHaveAttribute("aria-current", "page");

    // WHEN il clique sur "Liste"
    await page.getByRole("link", { name: "Liste" }).click();
    // THEN il est sur la vue Liste (URL + controle actif)
    await expect(page).toHaveURL(/\/list$/);
    await expect(page.getByRole("link", { name: "Liste" })).toHaveAttribute("aria-current", "page");

    // WHEN il revient sur "Kanban"
    await page.getByRole("link", { name: "Kanban" }).click();
    // THEN il est de nouveau sur la vue Kanban
    await expect(page).toHaveURL(/\/kanban$/);
  });

  // -------------------------------------------------------------------------
  // Persistance : « vue preferee conservee pendant la session » (§4.5)
  // -------------------------------------------------------------------------
  test("should_persist_preferred_view_in_sessionStorage_within_the_tab", async ({ page }) => {
    // GIVEN l'utilisateur choisit la vue Liste
    await page.goto("/kanban");
    await page.getByRole("link", { name: "Liste" }).click();
    await expect(page).toHaveURL(/\/list$/);

    // THEN la preference est memorisee en sessionStorage
    expect(await page.evaluate((k) => sessionStorage.getItem(k), PREF_KEY)).toBe("list");

    // AND elle survit a la navigation dans le meme onglet (meme session)
    await page.goto("/dashboard");
    expect(await page.evaluate((k) => sessionStorage.getItem(k), PREF_KEY)).toBe("list");
  });

  test("should_reapply_last_chosen_view_when_returning_within_same_session", async ({ page }) => {
    // GIVEN une preference "list" memorisee pendant la session
    await page.goto("/kanban");
    await page.getByRole("link", { name: "Liste" }).click();
    await expect(page).toHaveURL(/\/list$/);

    // WHEN l'utilisateur quitte la zone board puis y revient via le point d'entree neutre
    await page.goto("/dashboard");
    await page.goto("/board");

    // THEN la derniere vue choisie (Liste) est reappliquee
    await expect(page).toHaveURL(/\/list$/);
    await expect(page.getByRole("link", { name: "Liste" })).toHaveAttribute("aria-current", "page");
  });

  test("should_not_leak_preferred_view_across_sessions", async ({ browser }) => {
    // GIVEN une session (onglet) ou l'utilisateur a choisi la vue Liste
    const first = await browser.newContext();
    const firstPage = await first.newPage();
    await firstPage.goto("/kanban");
    await firstPage.getByRole("link", { name: "Liste" }).click();
    await expect(firstPage).toHaveURL(/\/list$/);
    await first.close();

    // WHEN on ouvre une NOUVELLE session (nouvel onglet -> nouveau sessionStorage)
    const second = await browser.newContext();
    const secondPage = await second.newPage();
    await secondPage.goto("/board");

    // THEN la preference n'est pas heritee (sessionStorage est propre a l'onglet, §4.5)
    expect(await secondPage.evaluate((k) => sessionStorage.getItem(k), PREF_KEY)).toBeNull();
    await second.close();
  });
});
