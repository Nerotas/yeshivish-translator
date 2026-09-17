import type { GlossaryRouteEntry } from "./models/glossary";

export function createGlossarySlug(term: string): string {
  return term
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['\u2018\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findGlossaryEntryBySlug<T extends GlossaryRouteEntry>(
  entries: readonly T[],
  slug: string,
): T | undefined {
  return entries.find((entry) => createGlossarySlug(entry.term) === slug);
}