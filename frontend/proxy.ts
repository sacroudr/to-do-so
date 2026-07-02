/**
 * proxy.ts — garde de navigation (Next.js 16).
 *
 * ATTENTION (breaking change v16) : le fichier `middleware.ts` est deprecie et
 * renomme `proxy`. La fonction s'exporte sous le nom `proxy` (ou en export par
 * defaut) et s'execute sur le runtime Node.js (le runtime `edge` n'est PAS supporte
 * en proxy). Reference : node_modules/next/dist/docs/.../file-conventions/proxy.md
 *
 * Role : rediriger les visiteurs non authentifies vers /login et empecher un
 * utilisateur deja connecte d'atteindre les pages d'auth. La detection de session
 * se fait ici SANS SDK (simple presence du cookie d'auth Supabase) afin que
 * l'application demarre meme avant `npm install`. Pour un rafraichissement fin du
 * token, on peut faire evoluer ce proxy vers `createServerClient` de @supabase/ssr
 * (voir architecture.md, section « Flux d'authentification »).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Prefixes de routes publiques (accessibles sans session). */
const PUBLIC_ROUTES = ["/login", "/forgot-password"];

/**
 * Supabase stocke la session dans un cookie nomme `sb-<ref>-auth-token`
 * (potentiellement fragmente en `.0`, `.1`...). On teste sa presence.
 */
function hasSupabaseSession(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthenticated = hasSupabaseSession(request);

  // Non connecte sur une route protegee -> /login (avec redirection de retour).
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Deja connecte sur une page d'auth -> tableau de bord.
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Applique le proxy a toutes les routes SAUF :
   * - les routes d'API internes de Next (_next/static, _next/image)
   * - les fichiers de metadonnees et assets statiques
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
