import { createGlossarySlug } from "./glossary-routing";
import type { GlossaryTerm } from "./models/glossary";
import type { PageMetadata, StructuredData } from "./models/page-metadata";

export const SITE_ORIGIN = "https://www.yeshivish-translator.com";
export const SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/torah-scroll.svg`;

const GLOSSARY_URL = `${SITE_ORIGIN}/glossary`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const GLOSSARY_ID = `${GLOSSARY_URL}#defined-term-set`;

function absoluteUrl(pathname: string): string {
  return pathname === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${pathname}`;
}

function baseMetadata(
  title: string,
  description: string,
  pathname: string,
  structuredData: StructuredData,
): PageMetadata {
  return {
    title,
    description,
    canonicalUrl: absoluteUrl(pathname),
    socialImageUrl: SOCIAL_IMAGE_URL,
    structuredData,
  };
}

export function createHomepageMetadata(): PageMetadata {
  const title = "Yeshivish Translator - Translate Yeshivish to Plain English";
  const description =
    "Translate Yeshivish and Jewish terminology into plain English and explore a glossary of Yiddish, Hebrew, Aramaic, and Jewish terminology.";

  return baseMetadata(title, description, "/", {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "Yeshivish Translator",
        url: SITE_ORIGIN,
        description,
      },
      {
        "@type": "WebApplication",
        name: "Yeshivish Translator",
        url: SITE_ORIGIN,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        description,
      },
    ],
  });
}

export function createGlossaryMetadata(): PageMetadata {
  const title = "Yeshivish Glossary - Jewish, Hebrew, Yiddish & Aramaic Terms";
  const description =
    "Browse Yeshivish and Jewish words and expressions with definitions, alternate spellings, origins, context, and plain-English examples.";

  return baseMetadata(title, description, "/glossary", {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": GLOSSARY_ID,
    name: "Yeshivish Glossary",
    url: GLOSSARY_URL,
    description,
  });
}

function createTermDescription(term: GlossaryTerm): string {
  const meanings = term.meanings.join("; ");
  return `${term.term}: ${meanings}. ${term.context_note}`;
}

export function createGlossaryTermMetadata(term: GlossaryTerm): PageMetadata {
  const slug = createGlossarySlug(term.term);
  const pathname = `/glossary/${slug}`;
  const canonicalUrl = absoluteUrl(pathname);
  const title = `What Does "${term.term}" Mean? | Yeshivish Glossary`;
  const description = createTermDescription(term);
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;

  return baseMetadata(title, description, pathname, {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description,
        isPartOf: { "@id": WEBSITE_ID },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "DefinedTerm",
        "@id": `${canonicalUrl}#term`,
        name: term.term,
        alternateName: term.variants,
        description: term.meanings.join("; "),
        inDefinedTermSet: { "@id": GLOSSARY_ID },
        url: canonicalUrl,
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Yeshivish Translator",
            item: SITE_ORIGIN,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Yeshivish Glossary",
            item: GLOSSARY_URL,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: term.term,
            item: canonicalUrl,
          },
        ],
      },
    ],
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serializeStructuredData(structuredData: StructuredData): string {
  return JSON.stringify(structuredData)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

/** Produces the complete route-specific head fragment used by static pages. */
export function renderPageMetadataHtml(metadata: PageMetadata): string {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonicalUrl = escapeHtml(metadata.canonicalUrl);
  const socialImageUrl = escapeHtml(metadata.socialImageUrl);

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${socialImageUrl}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${socialImageUrl}" />`,
    `<script id="page-structured-data" type="application/ld+json">${serializeStructuredData(metadata.structuredData)}</script>`,
  ].join("\n");
}