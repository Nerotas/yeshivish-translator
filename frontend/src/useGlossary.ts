import { useQuery } from "@tanstack/react-query";
import {
  fetchGlossary,
  GLOSSARY_STALE_TIME_MS,
  glossaryQueryKey,
} from "./api";

/** Keeps every glossary view on the same cache and retry policy. */
export function useGlossary() {
  return useQuery({
    queryKey: glossaryQueryKey,
    queryFn: fetchGlossary,
    staleTime: GLOSSARY_STALE_TIME_MS,
    retry: 1,
  });
}