import { useQuery } from "@tanstack/react-query";
import {
  fetchGlossary,
  GLOSSARY_STALE_TIME_MS,
  glossaryQueryKey,
} from "./api";
import { useInitialPageData } from "./initial-page-data";

/** Keeps every glossary view on the same cache and retry policy. */
export function useGlossary() {
  const { glossary: initialGlossary } = useInitialPageData();

  return useQuery({
    queryKey: glossaryQueryKey,
    queryFn: fetchGlossary,
    initialData: initialGlossary,
    staleTime: GLOSSARY_STALE_TIME_MS,
    retry: 1,
  });
}