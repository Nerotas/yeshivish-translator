import { describe, expect, it } from "vitest";
import type { GlossaryTerm } from "./models/glossary";
import {
  createAboutMetadata,
  createGlossaryMetadata,
  createGlossaryTermMetadata,
  createHomepageMetadata,
  createNotFoundMetadata,
  renderPageMetadataHtml,
  SITE_ORIGIN,
} from "./page-metadata";

const mazelTov: GlossaryTerm = {
  id: 1,
  term: "Mazel Tov",
  aleph_beis: "מזל טוב",
  display_terms: { shabbos: "Mazel Tov", shabbat: "Mazel Tov" },
  variants: ["Mazal Tov"],
  meanings: ["congratulations", "wishes for good fortune"],
  context_note: "Used to congratulate someone on a happy occasion.",
  category: "expression",
  language_origin: "Hebrew",
  yeshivish_example: "Mazel tov on the simcha.",
  plain_english_example: "Congratulations on the celebration.",
};

describe("page metadata", () => {
  it("defines distinct canonical metadata for the homepage and glossary", () => {
    const homepage = createHomepageMetadata();
    const glossary = createGlossaryMetadata();

    expect(homepage.canonicalUrl).toBe(SITE_ORIGIN);
    expect(glossary.canonicalUrl).toBe(`${SITE_ORIGIN}/glossary`);
    expect(homepage.title).not.toBe(glossary.title);
    expect(homepage.description).not.toBe(glossary.description);
  });

  it("defines canonical About metadata and noindex 404 metadata", () => {
    const about = createAboutMetadata();
    const notFound = createNotFoundMetadata();

    expect(about.canonicalUrl).toBe(`${SITE_ORIGIN}/about`);
    expect(about.structuredData).toMatchObject({ "@type": "AboutPage" });
    expect(notFound.canonicalUrl).toBeUndefined();
    expect(notFound.structuredData).toBeUndefined();
    expect(notFound.robots).toBe("noindex, nofollow");
    expect(renderPageMetadataHtml(notFound)).toContain(
      '<meta name="robots" content="noindex, nofollow" />',
    );
  });

  it("derives term metadata from published glossary content", () => {
    const metadata = createGlossaryTermMetadata(mazelTov);

    expect(metadata.title).toBe(
      'What Does "Mazel Tov" Mean? | Yeshivish Glossary',
    );
    expect(metadata.description).toContain("congratulations");
    expect(metadata.description).toContain("happy occasion");
    expect(metadata.canonicalUrl).toBe(`${SITE_ORIGIN}/glossary/mazel-tov`);
  });

  it("renders one canonical link and parseable JSON-LD", () => {
    const metadataHtml = renderPageMetadataHtml(
      createGlossaryTermMetadata(mazelTov),
    );
    const canonicalLinks = metadataHtml.match(/rel="canonical"/g) ?? [];
    const structuredDataText = metadataHtml.match(
      /<script id="page-structured-data" type="application\/ld\+json">(.+)<\/script>/,
    )?.[1];

    expect(canonicalLinks).toHaveLength(1);
    expect(structuredDataText).toBeDefined();
    expect(JSON.parse(structuredDataText ?? "")).toMatchObject({
      "@context": "https://schema.org",
    });
  });

  it("escapes visible metadata and structured data safely", () => {
    const unsafeTerm = { ...mazelTov, term: '<script>alert("x")</script>' };
    const metadataHtml = renderPageMetadataHtml(
      createGlossaryTermMetadata(unsafeTerm),
    );

    expect(metadataHtml).not.toContain("<script>alert");
    expect(metadataHtml).toContain("&lt;script&gt;");
    expect(metadataHtml).toContain("\\u003cscript\\u003e");
  });
});