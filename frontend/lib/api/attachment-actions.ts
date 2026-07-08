"use server";

/**
 * Server Actions des pieces jointes PDF (requirements.md §5).
 *
 * L'upload passe par une Server Action qui recoit un `FormData` (fichier) et le
 * RELAIE en multipart a l'API FastAPI (qui valide type/taille puis stocke). On
 * n'utilise PAS `apiFetch` ici : ce wrapper force `Content-Type: application/json`,
 * incompatible avec un envoi multipart (le boundary doit etre pose par `fetch`).
 */
import { revalidatePath } from "next/cache";

import { MAX_ATTACHMENT_BYTES, PDF_MIME } from "@/lib/constants/attachment";
import { apiEnv } from "@/lib/env";
import { getAccessToken } from "@/lib/supabase/server";
import type { TaskAttachment } from "@/lib/types/domain";

interface AttachmentDTO {
  id: string;
  task_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string | null;
  signed_url: string | null;
}

export interface UploadResult {
  ok: boolean;
  error?: string;
}

const AFFECTED_PATHS = ["/kanban", "/list", "/dashboard"] as const;

function toAttachment(dto: AttachmentDTO): TaskAttachment {
  return {
    id: dto.id,
    taskId: dto.task_id,
    fileName: dto.file_name,
    mimeType: dto.mime_type,
    sizeBytes: dto.size_bytes,
    uploadedBy: dto.uploaded_by,
    uploadedByName: dto.uploaded_by_name,
    createdAt: dto.created_at,
    signedUrl: dto.signed_url,
  };
}

/** Liste les pieces jointes d'une tache (§5). Renvoie [] en cas d'echec. */
export async function listAttachmentsAction(taskId: string): Promise<TaskAttachment[]> {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(
      `${apiEnv.baseUrl}/api/v1/tasks/${taskId}/attachments`,
      {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    const dtos = (await response.json()) as AttachmentDTO[];
    return dtos.map(toAttachment);
  } catch {
    return [];
  }
}

/** Televerse un PDF (multipart) pour une tache ; valide type/taille (§5). */
export async function uploadAttachmentAction(
  taskId: string,
  formData: FormData,
): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Aucun fichier sélectionné." };
  }
  // Pre-validation cote serveur (le backend re-valide via magic bytes + taille).
  if (file.type !== PDF_MIME) {
    return { ok: false, error: "Seuls les fichiers PDF sont acceptés." };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "Le fichier dépasse la taille maximale (10 Mo)." };
  }

  try {
    const accessToken = await getAccessToken();
    const body = new FormData();
    body.append("file", file, file.name);

    const response = await fetch(
      `${apiEnv.baseUrl}/api/v1/tasks/${taskId}/attachments`,
      {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body,
      },
    );

    if (!response.ok) {
      if (response.status === 413) {
        return { ok: false, error: "Le fichier dépasse la taille maximale (10 Mo)." };
      }
      if (response.status === 422) {
        return { ok: false, error: "Seuls les fichiers PDF sont acceptés." };
      }
      return { ok: false, error: "L'envoi de la pièce jointe a échoué." };
    }

    for (const path of AFFECTED_PATHS) revalidatePath(path);
    return { ok: true };
  } catch {
    return { ok: false, error: "L'envoi de la pièce jointe a échoué." };
  }
}
