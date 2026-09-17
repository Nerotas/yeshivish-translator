export type PronunciationPreference = "shabbos" | "shabbat";

export interface PronunciationContextValue {
  preference: PronunciationPreference;
  setPreference: (preference: PronunciationPreference) => void;
}