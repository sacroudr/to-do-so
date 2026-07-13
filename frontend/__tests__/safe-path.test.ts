/**
 * Garde anti open-redirect partagee (`lib/auth/safe-path.ts`, requirements.md §8).
 *
 * Ces tests verrouillent le contrat reutilise par l'ecran de connexion ET le callback
 * d'authentification : seul un chemin INTERNE est conserve, toute valeur externe /
 * protocole-relative / absente retombe sur le tableau de bord.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_SAFE_PATH, safeInternalPath } from "@/lib/auth/safe-path";

describe("safeInternalPath — garde anti open-redirect (§8)", () => {
  it("should_keep_a_simple_internal_path", () => {
    expect(safeInternalPath("/dashboard/projets")).toBe("/dashboard/projets");
  });

  it("should_keep_an_internal_path_with_query_and_hash", () => {
    expect(safeInternalPath("/taches?statut=todo#top")).toBe("/taches?statut=todo#top");
  });

  it("should_fallback_when_path_is_null_or_empty", () => {
    // GIVEN aucune destination demandee (query absente) OR chaine vide
    expect(safeInternalPath(null)).toBe(DEFAULT_SAFE_PATH);
    expect(safeInternalPath(undefined)).toBe(DEFAULT_SAFE_PATH);
    expect(safeInternalPath("")).toBe(DEFAULT_SAFE_PATH);
  });

  it("should_reject_protocol_relative_urls", () => {
    // `//evil.com` -> le navigateur irait vers le domaine externe evil.com
    expect(safeInternalPath("//evil.com")).toBe(DEFAULT_SAFE_PATH);
    expect(safeInternalPath("//evil.com/phishing")).toBe(DEFAULT_SAFE_PATH);
  });

  it("should_reject_backslash_protocol_relative_urls", () => {
    // `/\evil.com` : plusieurs navigateurs normalisent `\` en `/`, donc equivalent
    // a `//evil.com` -> domaine externe. Doit retomber sur le tableau de bord.
    expect(safeInternalPath("/\\evil.com")).toBe(DEFAULT_SAFE_PATH);
    expect(safeInternalPath("/\\/evil.com")).toBe(DEFAULT_SAFE_PATH);
  });

  it("should_reject_absolute_external_urls", () => {
    expect(safeInternalPath("https://evil.com")).toBe(DEFAULT_SAFE_PATH);
    expect(safeInternalPath("http://evil.com/login")).toBe(DEFAULT_SAFE_PATH);
  });

  it("should_reject_paths_not_starting_with_slash", () => {
    // Un chemin relatif sans `/` initial n'est pas considere comme interne sur.
    expect(safeInternalPath("dashboard")).toBe(DEFAULT_SAFE_PATH);
  });
});
