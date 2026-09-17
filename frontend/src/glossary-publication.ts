import { createGlossarySlug } from "./glossary-routing";
import type { GlossaryResponse, GlossaryTerm } from "./models/glossary";
import type {
  PublishedGlossaryDocument,
  PublishedGlossaryEntry,
} from "./models/published-glossary";
import { getDisplayTerm } from "./pronunciation";

function validatePublishedRoutes(entries: readonly PublishedGlossaryEntry[]) {
  const termBySlug = new Map<string, string>();

  for (const entry of entries) {
    const slug = createGlossarySlug(entry.term);
    if (!slug) {
      throw new Error(`Glossary term "${entry.term}" creates an empty slug.`);
    }

    const existingTerm = termBySlug.get(slug);
    if (existingTerm) {
      throw new Error(
        `Glossary terms "${existingTerm}" and "${entry.term}" share slug "${slug}".`,
      );
    }

    termBySlug.set(slug, entry.term);
  }
}

function toGlossaryTerm(
  entry: PublishedGlossaryEntry,
  index: number,
): GlossaryTerm {
  return {
    id: index + 1,
    term: entry.term,
    aleph_beis: entry.aleph_beis,
    display_terms: {
      shabbos: getDisplayTerm(entry, "shabbos"),
      shabbat: getDisplayTerm(entry, "shabbat"),
    },
    variants: [...entry.variants],
    meanings: [...entry.meanings],
    context_note: entry.context_note,
    category: entry.category ?? "",
    language_origin: entry.language_origin ?? "",
    yeshivish_example: entry.yeshivish_example ?? "",
    plain_english_example: entry.plain_english_example ?? "",
  };
}

/** Converts the versioned publication file into the frontend API contract. */
export function createPublishedGlossaryResponse(
  document: PublishedGlossaryDocument,
): GlossaryResponse {
  if (document.entry_count !== document.entries.length) {
    throw new Error(
      `Glossary declares ${document.entry_count} entries but contains ${document.entries.length}.`,
    );
  }

  validatePublishedRoutes(document.entries);

  return {
    count: document.entries.length,
    results: document.entries.map(toGlossaryTerm),
  };
}