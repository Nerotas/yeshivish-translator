export type StructuredData = Record<string, unknown>;

export interface PageMetadata {
  title: string;
  description: string;
  canonicalUrl?: string;
  socialImageUrl: string;
  structuredData?: StructuredData;
  robots?: "index, follow" | "noindex, nofollow";
}