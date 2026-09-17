import type { PronunciationPreference } from "./pronunciation";

/** Minimal glossary shape accepted by pronunciation helpers. */
export interface GlossaryEntry {
  term: string;
  dialect_pattern?: string;
}

/** Minimal glossary shape required to create and resolve public routes. */
export interface GlossaryRouteEntry {
  term: string;
}

/** Public glossary term returned by the backend API. */
export interface GlossaryTerm {
  id: number;
  term: string;
  aleph_beis: string;
  display_terms: Record<PronunciationPreference, string>;
  variants: string[];
  meanings: string[];
  context_note: string;
  category: string;
  language_origin: string;
  yeshivish_example: string;
  plain_english_example: string;
}

export interface GlossaryResponse {
  count: number;
  results: GlossaryTerm[];
}