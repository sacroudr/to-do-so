/**
 * Bascule de vue Kanban / Liste (requirements.md §4.5).
 *
 * Critere d'acceptation (§4.5) : « Un controle clairement visible permet a
 * l'utilisateur de choisir sa vue preferee (Kanban ou Liste) a tout moment. »
 *
 * ViewSwitcher est un Client Component synchrone (« use client », usePathname) : il
 * est donc testable via Vitest + React Testing Library (contrairement aux pages
 * Kanban/Liste qui sont des Server Components -> couvertes en E2E, cf. e2e/).
 *
 * On mocke `next/navigation.usePathname` pour simuler la vue active courante.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ViewSwitcher } from "@/components/layout/view-switcher";

// Chemin courant simule, pilote par chaque test.
let mockPathname = "/kanban";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("ViewSwitcher — bascule de vue (§4.5)", () => {
  beforeEach(() => {
    mockPathname = "/kanban";
  });

  it("should_render_both_view_controls", () => {
    // GIVEN l'utilisateur est sur une vue
    render(<ViewSwitcher />);
    // THEN les deux controles Kanban ET Liste sont visibles (choix a tout moment)
    const kanban = screen.getByRole("link", { name: "Kanban" });
    const liste = screen.getByRole("link", { name: "Liste" });
    expect(kanban).toBeInTheDocument();
    expect(liste).toBeInTheDocument();
    expect(kanban).toHaveAttribute("href", "/kanban");
    expect(liste).toHaveAttribute("href", "/list");
  });

  it("should_mark_kanban_active_when_on_kanban_view", () => {
    // GIVEN on est sur la vue Kanban
    mockPathname = "/kanban";
    // WHEN on affiche la bascule
    render(<ViewSwitcher />);
    // THEN Kanban est marquee active (aria-current) et Liste ne l'est pas
    expect(screen.getByRole("link", { name: "Kanban" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Liste" })).not.toHaveAttribute("aria-current");
  });

  it("should_mark_list_active_when_on_list_view", () => {
    // GIVEN on est sur la vue Liste
    mockPathname = "/list";
    // WHEN on affiche la bascule
    render(<ViewSwitcher />);
    // THEN Liste est marquee active et Kanban ne l'est pas
    expect(screen.getByRole("link", { name: "Liste" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Kanban" })).not.toHaveAttribute("aria-current");
  });

  it("should_expose_exactly_two_views", () => {
    // GIVEN la bascule
    render(<ViewSwitcher />);
    // THEN exactement deux controles de vue (Kanban, Liste)
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
