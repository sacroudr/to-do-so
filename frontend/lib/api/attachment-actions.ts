"use server";

/**
 * Server Action de LECTURE des pieces jointes PDF (requirements.md §5).
 *
 * Seule la lecture de la liste passe encore par une Server Action : elle est en lecture
 * seule (`cache: "no-store"`), sans corps volumineux, donc sans probleme de plafond.
 *
 * L'UPLOAD, lui, ne passe PLUS par ici : le fichier part DIRECTEMENT du navigateur vers
 * l'API FastAPI (cf. `components/tasks/task-attachments.tsx`). Faire transiter le fichier
 * par une Serverless Function Vercel butait sur son plafond DUR de ~4,5 Mo sur le corps des
 * requetes (que `serverActions.bodySizeLimit` ne peut pas outrepasser), ce qui rejetait les
 * PDF volumineux en production. Aucune revalidation de cache n'est necessaire : les pieces
 * jointes ne pilotent aucun badge des cartes Kanban/Liste/dashboard (le composant rafraichit
 * lui-meme sa propre liste apres un ajout).
 */
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
