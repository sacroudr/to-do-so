/**
 * Setup global des tests Vitest.
 * Ajoute les matchers DOM (`toBeInTheDocument`, `toHaveAttribute`...) de
 * @testing-library/jest-dom et nettoie le DOM apres chaque test.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
