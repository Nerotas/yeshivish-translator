export const PRONUNCIATION_PREFERENCES = ["shabbos", "shabbat"] as const;
export type PronunciationPreference =
  (typeof PRONUNCIATION_PREFERENCES)[number];

export interface GlossaryEntry {
  term: string;
  dialect_pattern?: string;
}

export const PRONUNCIATION_STORAGE_KEY = "pronunciationPreference";

function isPronunciationPreference(
  value: string | null,
): value is PronunciationPreference {
  return PRONUNCIATION_PREFERENCES.some((preference) => preference === value);
}

export function getSavedPronunciationPreference(): PronunciationPreference {
  try {
    const savedPreference = localStorage.getItem(PRONUNCIATION_STORAGE_KEY);
    return isPronunciationPreference(savedPreference)
      ? savedPreference
      : "shabbos";
  } catch {
    return "shabbos";
  }
}

export function resolveDialectTerm(
  pattern: string,
  preference: PronunciationPreference,
): string {
  return pattern.replace(
    /\[([^|\]]+)\|([^\]]+)\]/g,
    (_match, shabbos: string, shabbat: string) =>
      preference === "shabbos" ? shabbos : shabbat,
  );
}

export function getDisplayTerm(
  entry: GlossaryEntry,
  preference: PronunciationPreference,
): string {
  return entry.dialect_pattern
    ? resolveDialectTerm(entry.dialect_pattern, preference)
    : entry.term;
}
