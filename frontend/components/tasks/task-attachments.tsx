"use client";

import { Download, Loader2, Paperclip, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import {
  listAttachmentsAction,
  uploadAttachmentAction,
} from "@/lib/api/attachment-actions";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants/attachment";
import type { TaskAttachment } from "@/lib/types/domain";

/**
 * Pieces jointes PDF d'une tache (requirements.md §5).
 *
 * Affiche la liste (nom, date d'ajout, auteur) + un bouton d'upload (PDF uniquement).
 * La liste est chargee paresseusement a l'ouverture (le composant n'est monte que dans
 * la vue detail / le formulaire d'edition), et rechargee apres chaque ajout. Le
 * telechargement utilise l'URL SIGNEE renvoyee par l'API (bucket prive).
 */
const PDF_MIME = "application/pdf";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TaskAttachments({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chargement paresseux a l'ouverture (`loading` demarre a `true`). On ne declenche
  // pas de setState synchrone dans l'effet : l'etat n'est mis a jour qu'apres la
  // resolution du fetch (motif « fetch puis set »).
  useEffect(() => {
    let active = true;
    void (async () => {
      const list = await listAttachmentsAction(taskId);
      if (!active) return;
      setItems(list);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [taskId]);

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // Reinitialise l'input pour permettre de re-selectionner le meme fichier.
    event.target.value = "";
    if (!file) return;

    setError(null);
    if (file.type !== PDF_MIME) {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Le fichier dépasse la taille maximale (10 Mo).");
      return;
    }

    const body = new FormData();
    body.append("file", file);

    setUploading(true);
    const result = await uploadAttachmentAction(taskId, body);
    if (result.ok) {
      setItems(await listAttachmentsAction(taskId));
    } else {
      setError(result.error ?? "L'envoi de la pièce jointe a échoué.");
    }
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          <Paperclip className="size-3.5" aria-hidden />
          Pièces jointes
        </h3>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-3.5" aria-hidden />
          )}
          Ajouter un PDF
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={handlePick}
            disabled={uploading}
          />
        </label>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement des pièces jointes…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune pièce jointe.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {attachment.fileName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(attachment.createdAt)}
                  {attachment.uploadedByName ? ` · ${attachment.uploadedByName}` : ""}
                </p>
              </div>
              {attachment.signedUrl ? (
                <a
                  href={attachment.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Télécharger ${attachment.fileName}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <Download className="size-4" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
