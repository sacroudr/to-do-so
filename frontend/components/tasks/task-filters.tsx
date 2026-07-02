"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Profile, Project } from "@/lib/types/domain";

/**
 * Filtres par responsable / projet (requirements.md §4.6).
 *
 * Les filtres pilotent les query params `?assignee=<uuid>&project=<uuid>` de l'URL ;
 * la page (Server Component) recharge alors les taches filtrees cote API. Le meme
 * composant est utilise par le Kanban et par la Liste (§4.6 : filtres communs).
 */
const SELECT_CLASS =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary";

export function TaskFilters({
  projects,
  profiles,
}: {
  projects: Project[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const assignee = searchParams.get("assignee") ?? "";
  const project = searchParams.get("project") ?? "";

  function setParam(key: "assignee" | "project", value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        data-testid="filter-assignee"
        aria-label="Filtrer par responsable"
        value={assignee}
        onChange={(e) => setParam("assignee", e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Tous les responsables</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nom}
          </option>
        ))}
      </select>

      <select
        data-testid="filter-project"
        aria-label="Filtrer par projet"
        value={project}
        onChange={(e) => setParam("project", e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Tous les projets</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nom}
          </option>
        ))}
      </select>
    </div>
  );
}
