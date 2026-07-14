/**
 * Checklist de sous-taches (§4.2, extension) — Client Component
 * `components/tasks/task-subtasks.tsx`.
 *
 * C'est un Client Component SYNCHRONE (« use client », hooks) -> testable en Vitest +
 * RTL en mockant les Server Actions (`@/lib/api/subtask-actions`) et `next/navigation`.
 * On exerce la LOGIQUE d'interaction OPTIMISTE : chargement paresseux, ajout par
 * ENTREE, CHANGEMENT DE STATUT (+ compteur d'en-tete « terminé »), suppression, et
 * ROLLBACK sur echec serveur.
 *
 * ⚠️ MISE A JOUR (statut des sous-taches) : la case a cocher booleenne a ete remplacee
 * par un SELECTEUR de statut a 6 valeurs (comme les taches). Les assertions « checkbox /
 * toBeChecked » sont donc remplacees par des assertions sur le `<select>` (role combobox,
 * valeur = statut) et le titre barre UNIQUEMENT quand le statut est « done » (terminé).
 *
 * ⚠️ Non couvert ici (documente) :
 *   - Le glisser-deposer HTML5 natif est fragile en jsdom ; on TENTE un test (voir
 *     « reordonnancement ») mais la garantie robuste vit en E2E (Playwright, e2e/).
 *   - La mise a jour LIVE du badge de carte apres changement de statut depuis le detail
 *     dependant de `router.refresh()` + refetch serveur -> couvert en E2E. On verifie
 *     seulement ici l'appel a `router.refresh()` et le compteur LOCAL.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSubtasks } from "@/components/tasks/task-subtasks";
import { ToastProvider } from "@/components/ui/toast";
import type { Subtask } from "@/lib/types/domain";

/**
 * `TaskSubtasks` consomme `useToast` (feedback global §8) -> tout rendu doit se faire sous
 * un `<ToastProvider>` (monte dans la coquille applicative reelle). Les erreurs, jadis
 * inline, s'affichent desormais dans un toast : `screen.getByText(...)` les retrouve
 * puisque le toast est rendu dans l'arbre du provider.
 */
function renderWithToast(ui: ReactElement) {
  return render(ui, { wrapper: ToastProvider });
}

// `router.refresh` doit etre observable -> hoiste avant le mock de next/navigation.
const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Server Actions mockees (aucun appel reseau reel).
vi.mock("@/lib/api/subtask-actions", () => ({
  listSubtasksAction: vi.fn(),
  createSubtaskAction: vi.fn(),
  updateSubtaskStatusAction: vi.fn(),
  deleteSubtaskAction: vi.fn(),
  reorderSubtasksAction: vi.fn(),
}));

import {
  createSubtaskAction,
  deleteSubtaskAction,
  listSubtasksAction,
  reorderSubtasksAction,
  updateSubtaskStatusAction,
} from "@/lib/api/subtask-actions";

const TASK_ID = "t1";

function sub(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: "s1",
    taskId: TASK_ID,
    title: "Sous-tache",
    // Defaut « a faire » (= ancien is_done=false). Les tests « terminé » surchargent en "done".
    statut: "todo",
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
  // Chargement initial : etat visuel selon le STATUT (barre si « done »)
  // -------------------------------------------------------------------------
  it("should_render_loaded_items_with_done_state", async () => {
    // GIVEN une sous-tache terminee et une a faire
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "s1", title: "Terminee", statut: "done", position: 0 }),
      sub({ id: "s2", title: "A faire", statut: "todo", position: 1 }),
    ]);
    // WHEN le composant se monte (chargement paresseux)
    renderWithToast(<TaskSubtasks taskId={TASK_ID} />);
    // THEN l'item « done » est barre (line-through), l'item « todo » ne l'est pas ;
    const done = await screen.findByText("Terminee");
    expect(done).toHaveClass("line-through");
    const todo = screen.getByText("A faire");
    expect(todo).not.toHaveClass("line-through");
    // ET les selecteurs de statut refletent l'etat (valeur = statut courant)
    expect(screen.getByLabelText("Statut de « Terminee »")).toHaveValue("done");
    expect(screen.getByLabelText("Statut de « A faire »")).toHaveValue("todo");
    // ET le compteur d'en-tete indique 1/2 (une seule « terminée »)
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
    renderWithToast(<TaskSubtasks taskId={TASK_ID} />);
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
    renderWithToast(<TaskSubtasks taskId={TASK_ID} />);
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
    renderWithToast(<TaskSubtasks taskId={TASK_ID} />);
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
  // Changement de statut : appel + compteur local + titre barre a « done »
  // -------------------------------------------------------------------------
  it("should_change_status_update_counter_and_call_action", async () => {
    // GIVEN deux sous-taches « a faire »
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "s1", title: "A", statut: "todo", position: 0 }),
      sub({ id: "s2", title: "B", statut: "todo", position: 1 }),
    ]);
    vi.mocked(updateSubtaskStatusAction).mockResolvedValue({ ok: true });
    renderWithToast(<TaskSubtasks taskId={TASK_ID} />);
    await screen.findByText("A");
    expect(screen.getByText("0/2")).toBeInTheDocument();

    // WHEN on passe la premiere a « Terminé »
    const select = screen.getByLabelText("Statut de « A »");
    fireEvent.change(select, { target: { value: "done" } });

    // THEN l'action recoit (taskId, id, "done"), le compteur passe a 1/2, le titre est barre
    expect(updateSubtaskStatusAction).toHaveBeenCalledWith(TASK_ID, "s1", "done");
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("A")).toHaveClass("line-through");
    // ET a l'ok, l'etat est conserve et le tableau est rafraichi (badge de carte)
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
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
    renderWithToast(<TaskSubtasks taskId={TASK_ID} />);
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
  it("should_rollback_optimistic_status_and_show_error_on_failure", async () => {
    // GIVEN une sous-tache « a faire » et un serveur qui refuse la mise a jour
    vi.mocked(listSubtasksAction).mockResolvedValue([
      sub({ id: "s1", title: "A", statut: "todo", position: 0 }),
    ]);
    vi.mocked(updateSubtaskStatusAction).mockResolvedValue({
      ok: false,
      error: "La mise à jour de la sous-tâche a échoué.",
    });
    renderWithToast(<TaskSubtasks taskId={TASK_ID} />);
    await screen.findByText("A");
    const select = screen.getByLabelText("Statut de « A »");

    // WHEN on passe a « Terminé » (optimisme immediat : titre barre)
    fireEvent.change(select, { target: { value: "done" } });
    expect(updateSubtaskStatusAction).toHaveBeenCalledWith(TASK_ID, "s1", "done");
    expect(screen.getByText("A")).toHaveClass("line-through");

    // THEN a l'echec : l'optimisme est annule (retour a « todo », plus barre) ET le
    // message d'erreur s'affiche (dans le toast global)
    await waitFor(() =>
      expect(
        screen.getByText("La mise à jour de la sous-tâche a échoué."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("A")).not.toHaveClass("line-through");
    expect(select).toHaveValue("todo");
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
    renderWithToast(<TaskSubtasks taskId={TASK_ID} />);
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
