export interface PublishedGlossaryEntry {
  term: string;
  aleph_beis: string;
  dialect_pattern?: string;
  variants: string[];
  meanings: string[];
  context_note: string;
  category?: string;
  language_origin?: string;
  yeshivish_example?: string;
  plain_english_example?: string;
}

export interface PublishedGlossaryDocument {
  entry_count: number;
  entries: PublishedGlossaryEntry[];
}