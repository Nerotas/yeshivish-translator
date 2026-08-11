import { type ReactNode, useLayoutEffect, useState } from "react";
import { PronunciationContext } from "./pronunciation-context";
import {
  getSavedPronunciationPreference,
  PRONUNCIATION_STORAGE_KEY,
  type PronunciationPreference,
} from "./pronunciation";

export function PronunciationProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<PronunciationPreference>(
    getSavedPronunciationPreference,
  );

  useLayoutEffect(() => {
    try {
      localStorage.setItem(PRONUNCIATION_STORAGE_KEY, preference);
    } catch {
      // The preference still applies for this session if storage is unavailable.
    }
  }, [preference]);

  return (
    <PronunciationContext.Provider value={{ preference, setPreference }}>
      {children}
    </PronunciationContext.Provider>
  );
}
