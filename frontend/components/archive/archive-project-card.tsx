import { Folder, FolderX } from "lucide-react";
import Link from "next/link";

import { archivedTaskCountLabel } from "@/lib/i18n/plural";

/**
 * Carte de projet du niveau 1 de la page Archive (point 2).
 *
 * Presentation alignee sur `project-card` (surface, coins arrondis, icone + compteur),
 * mais SANS action d'edition / suppression : c'est un simple lien vers le niveau 2
 * (`/archive/{href}`), qui liste les taches archivees du projet. Le regroupement
 * « Sans projet » utilise une icone distincte (`FolderX`).
 */
export function ArchiveProjectCard({
  href,
  name,
  count,
  isNoProject = false,
}: {
  href: string;
  name: string;
  count: number;
  isNoProject?: boolean;
}) {
  const Icon = isNoProject ? FolderX : Folder;

  return (
    <Link
      href={href}
      className="flex h-full items-center gap-2 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md"
    >
      <Icon
        className={`size-4 ${isNoProject ? "text-muted-foreground" : "text-primary"}`}
        aria-hidden
      />
      <span className="font-medium text-foreground">{name}</span>
      <span className="ml-auto rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
        {archivedTaskCountLabel(count)}
      </span>
    </Link>
  );
}
