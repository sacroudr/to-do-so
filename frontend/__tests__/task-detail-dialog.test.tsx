/**
 * Panneau de detail d'une tache (§4.2) — Client Component
 * `components/tasks/task-detail-dialog.tsx`.
 *
 * Test de NON-REGRESSION apres l'ajout de la checklist : le detail embarque desormais
 * `TaskSubtasks` + `TaskAttachments`, mais doit continuer d'afficher tous les champs de
 * la tache principale et de router « Modifier » / « Fermer » correctement.
 *
 * On mocke les Server Actions des deux sous-composants et `next/navigation` (utilise par
 * `TaskSubtasks`). Ces deux enfants sont des Client Components synchrones -> le detail
 * reste testable en Vitest (contrairement aux vues Kanban/Liste, Server Components -> E2E).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog";
import type { Task } from "@/lib/types/domain";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Les enfants chargent leurs donnees a l'ouverture -> on neutralise le reseau.
vi.mock("@/lib/api/subtask-actions", () => ({
  listSubtasksAction: vi.fn().mockResolvedValue([]),
  createSubtaskAction: vi.fn(),
  toggleSubtaskAction: vi.fn(),
  deleteSubtaskAction: vi.fn(),
  reorderSubtasksAction: vi.fn(),
}));

// L'upload ne passe plus par une Server Action (il part direct du navigateur vers l'API) :
// seule la lecture `listAttachmentsAction` reste a neutraliser ici.
vi.mock("@/lib/api/attachment-actions", () => ({
  listAttachmentsAction: vi.fn().mockResolvedValue([]),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    titre: "Préparer la réunion",
    description: "Ordre du jour à finaliser",
    projectId: "proj-1",
    project: { id: "proj-1", nom: "Refonte Site", description: null },
    // Responsable = team_member (points 2/3) : prenom + nom (plus de compte/email).
    assignees: [{ id: "p1", firstName: "Alice", lastName: "Martin" }],
    dueDate: { date: "2026-07-20", text: null },
    statut: "in_progress",
    priorite: "high",
    source: "Réunion du 1er juillet",
    subtaskProgress: { total: 0, done: 0 },
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-05T00:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskDetailDialog — detail lecture seule (§4.2)", () => {
  it("should_render_nothing_when_closed_or_task_is_null", () => {
    // GIVEN un dialogue ferme (ou sans tache) WHEN on rend THEN aucun dialogue
    const { rerender } = render(
      <TaskDetailDialog open={false} task={makeTask()} onClose={vi.fn()} onEdit={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <TaskDetailDialog open task={null} onClose={vi.fn()} onEdit={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should_display_all_main_task_fields", async () => {
    // GIVEN une tache complete ouverte dans le detail
    render(
      <TaskDetailDialog open task={makeTask()} onClose={vi.fn()} onEdit={vi.fn()} />,
    );
    // On attend le reglage des enfants (listes vides) pour eviter les warnings act.
    await screen.findByText("Aucune pièce jointe.");

    // THEN le titre, le statut, la priorite, le projet, le responsable, la source et la
    // description de la tache PRINCIPALE sont affiches.
    expect(screen.getByRole("heading", { name: "Préparer la réunion" })).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument(); // statut in_progress
    expect(screen.getByText("Haute")).toBeInTheDocument(); // priorite high
    expect(screen.getByText("Refonte Site")).toBeInTheDocument(); // projet
    expect(screen.getByText("Alice Martin")).toBeInTheDocument(); // responsable
    expect(screen.getByText("Réunion du 1er juillet")).toBeInTheDocument(); // source
    expect(screen.getByText("Ordre du jour à finaliser")).toBeInTheDocument(); // description
  });

  it("should_embed_the_subtasks_and_attachments_sections", async () => {
    // GIVEN le detail ouvert
    render(
      <TaskDetailDialog open task={makeTask()} onClose={vi.fn()} onEdit={vi.fn()} />,
    );
    await screen.findByText("Aucune pièce jointe.");
    // THEN la section Sous-taches (checklist) ET la section Pieces jointes sont montees
    expect(screen.getByTestId("task-subtasks")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sous-tâches/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Pièces jointes/i })).toBeInTheDocument();
  });

  it("should_call_onEdit_with_the_task_when_clicking_Modifier", async () => {
    // GIVEN le detail ouvert
    const onEdit = vi.fn();
    const task = makeTask();
    render(<TaskDetailDialog open task={task} onClose={vi.fn()} onEdit={onEdit} />);
    await screen.findByText("Aucune pièce jointe.");
    // WHEN on clique « Modifier »
    fireEvent.click(screen.getByRole("button", { name: /Modifier/ }));
    // THEN onEdit est appele avec la tache courante (bascule vers l'edition)
    expect(onEdit).toHaveBeenCalledWith(task);
  });

  it("should_call_onClose_when_clicking_Fermer", async () => {
    // GIVEN le detail ouvert
    const onClose = vi.fn();
    render(<TaskDetailDialog open task={makeTask()} onClose={onClose} onEdit={vi.fn()} />);
    await screen.findByText("Aucune pièce jointe.");
    // WHEN on clique un controle « Fermer » (croix d'en-tete ou bouton de pied)
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" })[0]);
    // THEN onClose est appele
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
