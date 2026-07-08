/**
 * Badge de progression de la checklist (§4.2, extension) — composant PUR
 * `components/ui/subtask-progress.tsx`.
 *
 * Presentationnel et synchrone (utilisable serveur/client) -> directement testable en
 * Vitest + RTL, sans mock. On verifie son contrat d'affichage : il rend « done/total »
 * quand la tache a des sous-taches, et RIEN du tout sinon (il se protege lui-meme pour
 * rester simple a appeler cote appelant).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubtaskProgress } from "@/components/ui/subtask-progress";

describe("SubtaskProgress — badge d'avancement (§4.2)", () => {
  it("should_render_done_over_total_when_there_are_subtasks", () => {
    // GIVEN une checklist partiellement terminee (done < total)
    render(<SubtaskProgress progress={{ total: 3, done: 1 }} />);
    // THEN le badge affiche « 1/3 »
    const badge = screen.getByTestId("subtask-progress");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("1/3");
  });

  it("should_render_full_ratio_when_all_subtasks_done", () => {
    // GIVEN une checklist entierement terminee (done == total)
    render(<SubtaskProgress progress={{ total: 4, done: 4 }} />);
    // THEN « 4/4 » (le badge reste affiche, il ne disparait qu'a total=0)
    expect(screen.getByTestId("subtask-progress")).toHaveTextContent("4/4");
  });

  it("should_expose_an_accessible_label_describing_the_progress", () => {
    // GIVEN une progression 2 sur 5
    render(<SubtaskProgress progress={{ total: 5, done: 2 }} />);
    // THEN le libelle accessible (aria-label + title) decrit l'avancement en clair
    const label = "2 sur 5 sous-tâches terminées";
    const badge = screen.getByLabelText(label);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", label);
  });

  it("should_render_nothing_when_total_is_zero", () => {
    // GIVEN une tache SANS sous-tache (total = 0)
    const { container } = render(<SubtaskProgress progress={{ total: 0, done: 0 }} />);
    // THEN aucun badge n'est rendu (pas de « 0/0 ») : query renvoie null
    expect(screen.queryByTestId("subtask-progress")).toBeNull();
    expect(screen.queryByText("0/0")).toBeNull();
    // ET rien du tout n'est injecte dans le DOM (composant renvoie null)
    expect(container).toBeEmptyDOMElement();
  });

  it("should_render_nothing_when_total_is_negative", () => {
    // GIVEN une valeur aberrante (total <= 0) WHEN on rend THEN toujours rien (garde <=)
    const { container } = render(<SubtaskProgress progress={{ total: -1, done: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
