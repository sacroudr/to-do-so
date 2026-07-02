/**
 * Client HTTP vers l'API FastAPI.
 *
 * Point central du contrat frontend <-> backend (requirements.md §6.2) :
 *   « le frontend joint un token JWT a chaque requete envoyee a l'API Python ».
 *
 * Ce module N'APPELLE PAS Supabase et NE contient PAS de logique metier : il se
 * contente d'attacher le header `Authorization: Bearer <jwt>` et de normaliser les
 * erreurs. Les fonctions metier (taches, projets...) s'appuieront dessus.
 */
import { apiEnv } from "@/lib/env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  /** JWT Supabase a transmettre. Cote serveur, obtenu via getAccessToken(). */
  accessToken?: string | null;
  body?: unknown;
}

export async function apiFetch<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { accessToken, body, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Content-Type", "application/json");
  if (accessToken) {
    finalHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiEnv.baseUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, `Requete API echouee: ${response.status}`, payload);
  }

  return payload as TResponse;
}
