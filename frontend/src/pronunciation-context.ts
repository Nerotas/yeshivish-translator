import { createContext, useContext } from "react";
import type { PronunciationPreference } from "./pronunciation";

export interface PronunciationContextValue {
  preference: PronunciationPreference;
  setPreference: (preference: PronunciationPreference) => void;
}

export const PronunciationContext =
  createContext<PronunciationContextValue | null>(null);

export function usePronunciationPreference(): PronunciationContextValue {
  const context = useContext(PronunciationContext);

  if (!context) {
    throw new Error(
      "usePronunciationPreference must be used within PronunciationProvider.",
    );
  }

  return context;
}
