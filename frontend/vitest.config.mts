/**
 * Configuration Vitest (tests unitaires + composants).
 *
 * Conforme au guide officiel Next.js 16 « How to set up Vitest with Next.js »
 * (frontend/node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md) :
 *   - @vitejs/plugin-react pour compiler le JSX/TSX,
 *   - vite-tsconfig-paths pour resoudre l'alias `@/*` (tsconfig.json),
 *   - environnement jsdom pour rendre les composants.
 *
 * RAPPEL (guide Next.js) : les Server Components `async` ne sont PAS supportes par
 * Vitest. Kanban (§4.3) et Liste (§4.4) sont des Server Components -> leurs parcours
 * (drag & drop, tri via l'UI, filtres) sont couverts en E2E (Playwright, dossier e2e/).
 * Ici on teste : composants Client synchrones (ViewSwitcher §4.5) et utilitaires purs
 * (tri de la vue Liste §4.4).
 */
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Ne pas ramasser les specs Playwright (elles vivent dans e2e/).
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
});
