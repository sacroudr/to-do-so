/**
 * Configuration Playwright (tests End-to-End).
 *
 * Conforme au guide officiel Next.js 16 « How to set up Playwright with Next.js »
 * (frontend/node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md).
 *
 * Les parcours Kanban (§4.3, drag & drop), Liste (§4.4, tri via l'UI), bascule (§4.5)
 * et filtres (§4.6) impliquent des Server Components async + interactions navigateur :
 * le guide recommande explicitement l'E2E plutot que l'unitaire pour ces cas.
 *
 * PREREQUIS d'execution (voir en-tetes des specs) :
 *   1. Un backend + un projet Supabase de TEST avec des donnees seedees.
 *   2. Une SESSION authentifiee (les routes sont protegees par proxy.ts qui redirige
 *      vers /login). A fournir via un global-setup Playwright (storageState) — non
 *      inclus ici car il depend des identifiants de l'environnement de test.
 *   3. Installer les navigateurs : `npx playwright install`.
 *
 * Tant que les fonctionnalites ne sont pas implementees, ces specs constituent la
 * cible TDD (elles echouent).
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // storageState: "e2e/.auth/user.json", // a produire via un global-setup (auth)
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Laisse Playwright demarrer le serveur si aucun n'est deja lance.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
