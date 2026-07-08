/**
 * Checklist de sous-taches (§4.2, extension) — Client Component
 * `components/tasks/task-subtasks.tsx`.
 *
 * C'est un Client Component SYNCHRONE (« use client », hooks) -> testable en Vitest +
 * RTL en mockant les Server Actions (`@/lib/api/subtask-actions`) et `next/navigation`.
 * On exerce la LOGIQUE d'interaction OPTIMISTE : chargement paresseux, ajout par
 * ENTREE, cochage (+ compteur d'en-tete), suppression, et ROLLBACK sur echec serveur.
 *
 * ⚠️ Non couvert ici (documente) :
 *   - Le glisser-deposer HTML5 natif est fragile en jsdom ; on TENTE un test (voir
 *     « reordonnancement ») mais la garantie robuste vit en E2E (Playwright, e2e/).
 *   - La mise a jour LIVE du badge de carte apres cochage depuis le detail dependant de
 *     `router.refresh()` + refetch serveur -> flux inter-composants, couvert en E2E. On
 *     verifie seulement ici l'appel a `router.refresh()` et le compteur LOCAL.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSubtasks } from "@/components/tasks/task-subtasks";
import type { Subtask } from "@/lib/types/domain";

// `router.refresh` doit etre observable -> hoiste avant le mock de next/navigation.
const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Server Actions mockees (aucun appel reseau reel).
vi.mock("@/lib/api/subtask-actions", () => ({
  listSubtasksAction: vi.fn(),
  createSubtaskAction: vi.fn(),
  toggleSubtaskAction: vi.fn(),
  deleteSubtaskAction: vi.fn(),
  reorderSubtasksAction: vi.fn(),
}));

import {
  createSubtaskAction,
  deleteSubtaskAction,
  listSubtasksAction,
  reorderSubtasksAction,
  toggleSubtaskAction,
} from "@/lib/api/subtask-actions";

const TASK_ID = "t1";

function sub(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: "s1",
    taskId: TASK_ID,
    title: "Sous-tache",
    isDone: false,
    position: 0,
    createdAt: null,
    ...overrides,
  };
}

/** Attend la fin du chargement paresseux (le texte de chargement disparait). */
async function waitForLoaded(): Promise<void> {
  await waitFor(() =>
    expect(screen.queryByText("Chargement des sous-tâches…")).toBeNull(),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Defaut sain : liste vide (chaque test surcharge au besoin).
  vi.mocked(listSubtasksAction).mockResolvedValue([]);
});

describe("TaskSubtasks — checklist optimiste (§4.2)", () => {
  // -------------------------------------------------------------------------
  // Chargement initial : etat visuel selon is_done
  // -------------------------------------------------------------------------
  it("should_render_loaded_items_with_done_state", async () => {
    // GIVEN une sous-tache faite et une a faire
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "s1", title: "Terminee", isDone: true, position: 0 }),
      sub({ id: "s2", title: "A faire", isDone: false, position: 1 }),
    ]);
    // WHEN le composant se monte (chargement paresseux)
    render(<TaskSubtasks taskId={TASK_ID} />);
    // THEN l'item fait est barre (line-through) et sa case cochee ;
    const done = await screen.findByText("Terminee");
    expect(done).toHaveClass("line-through");
    const todo = screen.getByText("A faire");
    expect(todo).not.toHaveClass("line-through");
    // ET les cases refletent l'etat (ordre DOM = ordre des items)
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked(); // Terminee
    expect(checkboxes[1]).not.toBeChecked(); // A faire
    // ET le compteur d'en-tete indique 1/2
    expect(screen.getByText("1/2")).toBeInTheDocument();
    // ET la liste a ete chargee pour CETTE tache
    expect(listSubtasksAction).toHaveBeenCalledWith(TASK_ID);
  });

  // -------------------------------------------------------------------------
  // Etat vide : section propre, sans compteur ni erreur
  // -------------------------------------------------------------------------
  it("should_render_empty_state_cleanly_without_counter_or_error", async () => {
    // GIVEN aucune sous-tache
    vi.mocked(listSubtasksAction).mockResolvedValue([]);
    // WHEN le composant se monte
    render(<TaskSubtasks taskId={TASK_ID} />);
    await waitForLoaded();
    // THEN l'en-tete et le champ d'ajout sont presents
    expect(screen.getByRole("heading", { name: /Sous-tâches/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Ajouter une sous-tâche")).toBeInTheDocument();
    // ET aucun compteur (pas de « x/y »), aucune erreur, aucun item, aucun crash
    expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull();
    expect(screen.queryByText(/échoué/i)).toBeNull();
    expect(screen.queryAllByTestId("subtask-item")).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Ajout rapide : optimisme immediat + ajout en FIN de liste
  // -------------------------------------------------------------------------
  it("should_add_optimistically_on_enter_and_append_at_end", async () => {
    // GIVEN une checklist avec un item existant
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "e1", title: "Existante", position: 0 }),
    ]);
    // La creation reste EN COURS : prouve que l'item apparait sans attendre la reponse.
    vi.mocked(createSubtaskAction).mockReturnValue(new Promise<never>(() => {}));
    render(<TaskSubtasks taskId={TASK_ID} />);
    await screen.findByText("Existante");

    // WHEN on saisit un titre puis ENTREE
    const input = screen.getByLabelText("Ajouter une sous-tâche");
    fireEvent.change(input, { target: { value: "Nouvelle étape" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // THEN l'item optimiste apparait IMMEDIATEMENT, en DERNIERE position (ajout en fin)
    const items = screen.getAllByTestId("subtask-item");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent("Nouvelle étape");
    // ET le champ est vide, et l'action recoit (taskId, title)
    expect(input).toHaveValue("");
    expect(createSubtaskAction).toHaveBeenCalledWith(TASK_ID, "Nouvelle étape");
  });

  it("should_not_add_when_title_is_blank_or_whitespace", async () => {
    // GIVEN une checklist vide
    render(<TaskSubtasks taskId={TASK_ID} />);
    await waitForLoaded();
    const input = screen.getByLabelText("Ajouter une sous-tâche");

    // WHEN on valide un titre vide puis un titre d'espaces
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    // THEN aucun appel, aucun item ajoute
    expect(createSubtaskAction).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId("subtask-item")).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Cochage : appel + compteur local + etat reflete a l'ok
  // -------------------------------------------------------------------------
  it("should_toggle_check_update_counter_and_call_action", async () => {
    // GIVEN deux sous-taches non faites
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "s1", title: "A", isDone: false, position: 0 }),
      sub({ id: "s2", title: "B", isDone: false, position: 1 }),
    ]);
    vi.mocked(toggleSubtaskAction).mockResolvedValue({ ok: true });
    render(<TaskSubtasks taskId={TASK_ID} />);
    await screen.findByText("A");
    expect(screen.getByText("0/2")).toBeInTheDocument();

    // WHEN on coche la premiere
    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);

    // THEN l'action recoit (taskId, id, next=true), le compteur passe a 1/2, case cochee
    expect(toggleSubtaskAction).toHaveBeenCalledWith(TASK_ID, "s1", true);
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    // ET a l'ok, l'etat est conserve et le tableau est rafraichi (badge de carte)
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(screen.getByText("A")).toHaveClass("line-through");
  });

  // -------------------------------------------------------------------------
  // Suppression : retrait apres ok, appel (taskId, id)
  // -------------------------------------------------------------------------
  it("should_remove_item_after_successful_delete", async () => {
    // GIVEN une sous-tache
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "s1", title: "Supprimable", position: 0 }),
    ]);
    vi.mocked(deleteSubtaskAction).mockResolvedValue({ ok: true });
    render(<TaskSubtasks taskId={TASK_ID} />);
    await screen.findByText("Supprimable");

    // WHEN on clique la corbeille (reperee par son aria-label)
    fireEvent.click(
      screen.getByRole("button", {
        name: "Supprimer la sous-tâche « Supprimable »",
      }),
    );

    // THEN l'item est retire et l'action recoit (taskId, id)
    await waitFor(() => expect(screen.queryByText("Supprimable")).toBeNull());
    expect(deleteSubtaskAction).toHaveBeenCalledWith(TASK_ID, "s1");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  // -------------------------------------------------------------------------
  // Robustesse : rollback + message d'erreur sur echec serveur
  // -------------------------------------------------------------------------
  it("should_rollback_optimistic_toggle_and_show_error_on_failure", async () => {
    // GIVEN une sous-tache et un serveur qui refuse la mise a jour
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "s1", title: "A", isDone: false, position: 0 }),
    ]);
    vi.mocked(toggleSubtaskAction).mockResolvedValue({
      ok: false,
      error: "La mise à jour de la sous-tâche a échoué.",
    });
    render(<TaskSubtasks taskId={TASK_ID} />);
    await screen.findByText("A");
    const checkbox = screen.getAllByRole("checkbox")[0];

    // WHEN on coche (optimisme immediat)
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // THEN a l'echec : l'optimisme est annule ET le message d'erreur s'affiche
    await waitFor(() =>
      expect(
        screen.getByText("La mise à jour de la sous-tâche a échoué."),
      ).toBeInTheDocument(),
    );
    expect(checkbox).not.toBeChecked();
    // ET on NE rafraichit PAS le tableau sur echec (pas de faux positif visuel)
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Reordonnancement (glisser-deposer HTML5 natif) — TENTATIVE en jsdom.
  // Si ce test devenait instable, le retirer et s'appuyer sur (a) la garantie
  // « ajout en fin » (test ci-dessus) + (b) la couverture E2E du DnD (Playwright).
  // -------------------------------------------------------------------------
  it("should_reorder_via_native_drag_and_drop", async () => {
    // GIVEN trois sous-taches persistees
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "a", title: "Alpha", position: 0 }),
      sub({ id: "b", title: "Beta", position: 1 }),
      sub({ id: "c", title: "Gamma", position: 2 }),
    ]);
    vi.mocked(reorderSubtasksAction).mockResolvedValue({ ok: true });
    render(<TaskSubtasks taskId={TASK_ID} />);
    await screen.findByText("Alpha");

    const items = screen.getAllByTestId("subtask-item");
    // dataTransfer stubbe (jsdom ne l'implemente pas).
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(),
    };

    // WHEN on glisse Alpha (index 0) et on le depose sur Gamma (index 2)
    fireEvent.dragStart(items[0], { dataTransfer });
    fireEvent.dragOver(items[2], { dataTransfer });
    fireEvent.drop(items[2], { dataTransfer });

    // THEN l'action recoit les ids REORDONNES : [b, c, a]
    expect(reorderSubtasksAction).toHaveBeenCalledWith(TASK_ID, ["b", "c", "a"]);
    // ET l'ordre du DOM a change en consequence
    const titlesAfter = screen
      .getAllByTestId("subtask-item")
      .map((li) => within(li).getByText(/Alpha|Beta|Gamma/).textContent);
    expect(titlesAfter).toEqual(["Beta", "Gamma", "Alpha"]);
  });
});
