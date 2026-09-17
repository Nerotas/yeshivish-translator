import type { GlossaryResponse, GlossaryTerm } from "./glossary";

export interface InitialPageData {
  glossary?: GlossaryResponse;
  glossaryTerm?: GlossaryTerm;
}