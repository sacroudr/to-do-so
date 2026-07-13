/**
 * Garde anti open-redirect — source de verite UNIQUE pour la validation d'un chemin de
 * redirection (requirements.md §8 Securite).
 *
 * Un chemin de redirection provient TOUJOURS d'une entree non fiable (query string :
 * `?redirectedFrom=`, `?next=`). Sans filtre, une valeur comme `//evil.com` ou
 * `https://evil.com` provoquerait une redirection vers un domaine externe apres login
 * (open redirect / phishing). On n'autorise donc qu'un chemin INTERNE :
 *   - il doit commencer par `/` (chemin absolu applicatif) ;
 *   - MAIS pas par `//` (URL protocole-relative -> domaine externe) ;
 *   - NI par `/\` : plusieurs navigateurs normalisent l'antislash en `/`, donc
 *     `/\evil.com` est equivalent a `//evil.com` (meme contournement).
 * Toute valeur invalide (absente, externe, protocole-relative) retombe sur le tableau
 * de bord.
 *
 * Fonction PURE, sans effet de bord : reutilisable cote serveur (Route Handler du
 * callback) comme cote client (page de connexion). Ce n'est deliberement PAS un module
 * « use server » (qui ne pourrait exporter que des fonctions async).
 */

/** Destination de repli quand le chemin demande n'est pas un chemin interne sur. */
export const DEFAULT_SAFE_PATH = "/dashboard";

/**
 * Renvoie `path` s'il s'agit d'un chemin interne sur, sinon `DEFAULT_SAFE_PATH`.
 */
export function safeInternalPath(path: string | null | undefined): string {
  if (
    path &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/\\")
  ) {
    return path;
  }
  return DEFAULT_SAFE_PATH;
}
