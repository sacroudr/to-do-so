/**
 * Tri de la vue Liste (requirements.md §4.4).
 *
 * Critere d'acceptation (§4.4) : « Tri possible par echeance, priorite, statut ou
 * responsable. »
 *
 * TDD : ces tests ciblent l'utilitaire pur `sortTasks` (lib/tasks/sort.ts), ecrit en
 * scaffold non implemente -> etat ROUGE attendu tant que le tri n'est pas code.
 * On teste UNIQUEMENT les ordres BIEN DEFINIS. Le cas « echeance en texte libre melangee
 * a des dates precises » est volontairement laisse en `test.todo` (ambiguite, voir
 * « Points a clarifier ») : aucune assertion approximative n'est ecrite dessus.
 */
import { describe, expect, it } from "vitest";

import { sortTasks } from "@/lib/tasks/sort";
import type { Task, TaskPriority, TaskStatus, TeamMember } from "@/lib/types/domain";

// Responsable = team_member (points 2/3) : le tri par responsable derive du nom complet.
function member(firstName: string): TeamMember {
  return { id: `m-${firstName}`, firstName, lastName: "" };
}

function makeTask(
  id: string,
  overrides: Partial<Task> = {},
): Task {
  return {
    id,
    titre: `Tache ${id}`,
    description: null,
    projectId: null,
    project: null,
    assignees: [],
    dueDate: { date: null, text: null },
    statut: "todo" as TaskStatus,
    priorite: "medium" as TaskPriority,
    source: null,
    subtaskProgress: { total: 0, done: 0 },
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe("sortTasks — vue Liste (§4.4)", () => {
  // -------------------------------------------------------------------------
  // Tri par priorite
  // -------------------------------------------------------------------------
  it("should_order_by_priority_ascending_when_key_is_priorite", () => {
    // GIVEN des taches dans le desordre de priorite
    const tasks = [
      makeTask("high", { priorite: "high" }),
      makeTask("low", { priorite: "low" }),
      makeTask("medium", { priorite: "medium" }),
    ];
    // WHEN on trie par priorite croissante
    const sorted = sortTasks(tasks, "priorite", "asc");
    // THEN low < medium < high
    expect(ids(sorted)).toEqual(["low", "medium", "high"]);
  });

  it("should_order_by_priority_descending_when_direction_is_desc", () => {
    const tasks = [
      makeTask("low", { priorite: "low" }),
      makeTask("high", { priorite: "high" }),
      makeTask("medium", { priorite: "medium" }),
    ];
    const sorted = sortTasks(tasks, "priorite", "desc");
    expect(ids(sorted)).toEqual(["high", "medium", "low"]);
  });

  // -------------------------------------------------------------------------
  // Tri par statut (ordre des colonnes Kanban)
  // -------------------------------------------------------------------------
  it("should_order_by_status_following_kanban_column_order", () => {
    // GIVEN les 6 statuts melanges (reduction 9 -> 6 : plus de a_qualifier/waiting/archive)
    const tasks = [
      makeTask("done", { statut: "done" }),
      makeTask("a_corriger", { statut: "a_corriger" }),
      makeTask("todo", { statut: "todo" }),
      makeTask("in_progress", { statut: "in_progress" }),
      makeTask("a_tester", { statut: "a_tester" }),
      makeTask("a_planifier", { statut: "a_planifier" }),
    ];
    // WHEN on trie par statut
    const sorted = sortTasks(tasks, "statut", "asc");
    // THEN ordre = celui des colonnes Kanban (TASK_STATUSES)
    expect(ids(sorted)).toEqual([
      "a_planifier",
      "todo",
      "in_progress",
      "a_tester",
      "a_corriger",
      "done",
    ]);
  });

  // -------------------------------------------------------------------------
  // Tri par responsable (alphabetique)
  // -------------------------------------------------------------------------
  it("should_order_by_first_assignee_name_alphabetically", () => {
    // GIVEN des taches avec des responsables differents
    const tasks = [
      makeTask("charlie", { assignees: [member("Charlie")] }),
      makeTask("alice", { assignees: [member("Alice")] }),
      makeTask("bob", { assignees: [member("Bob")] }),
    ];
    // WHEN on trie par responsable
    const sorted = sortTasks(tasks, "assignee", "asc");
    // THEN Alice < Bob < Charlie
    expect(ids(sorted)).toEqual(["alice", "bob", "charlie"]);
  });

  // -------------------------------------------------------------------------
  // Tri par echeance — uniquement des DATES PRECISES (cas bien defini)
  // -------------------------------------------------------------------------
  it("should_order_precise_due_dates_chronologically", () => {
    // GIVEN uniquement des echeances en dates precises
    const tasks = [
      makeTask("jul20", { dueDate: { date: "2026-07-20", text: null } }),
      makeTask("jul05", { dueDate: { date: "2026-07-05", text: null } }),
      makeTask("jul12", { dueDate: { date: "2026-07-12", text: null } }),
    ];
    // WHEN on trie par echeance croissante
    const sorted = sortTasks(tasks, "dueDate", "asc");
    // THEN de la plus proche a la plus lointaine
    expect(ids(sorted)).toEqual(["jul05", "jul12", "jul20"]);
  });

  it("should_not_mutate_the_input_array", () => {
    // GIVEN un tableau source
    const tasks = [
      makeTask("b", { priorite: "high" }),
      makeTask("a", { priorite: "low" }),
    ];
    const snapshot = ids(tasks);
    // WHEN on trie
    sortTasks(tasks, "priorite", "asc");
    // THEN le tableau d'origine est inchange (fonction pure)
    expect(ids(tasks)).toEqual(snapshot);
  });

  // -------------------------------------------------------------------------
  // Echeances MIXTES : dates precises + texte libre (regle confirmee, §4.4)
  // -------------------------------------------------------------------------
  it("should_place_dated_tasks_first_then_text_only_by_created_at", () => {
    // GIVEN un melange de taches datees et de taches a echeance en texte libre
    const tasks = [
      makeTask("text_created_02", {
        dueDate: { date: null, text: "mi-juillet" },
        createdAt: "2026-07-02T00:00:00Z",
      }),
      makeTask("date_jul20", { dueDate: { date: "2026-07-20", text: null } }),
      makeTask("text_created_01", {
        dueDate: { date: null, text: "semaine prochaine" },
        createdAt: "2026-07-01T00:00:00Z",
      }),
      makeTask("date_jul05", { dueDate: { date: "2026-07-05", text: null } }),
    ];
    // WHEN on trie par echeance croissante
    const sorted = sortTasks(tasks, "dueDate", "asc");
    // THEN d'abord les datees (par date croissante), PUIS les textes libres
    // (par created_at croissant), a la suite.
    expect(ids(sorted)).toEqual([
      "date_jul05",
      "date_jul20",
      "text_created_01",
      "text_created_02",
    ]);
  });
});
