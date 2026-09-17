import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PageMetadata from "./PageMetadata";
import {
  createGlossaryMetadata,
  createHomepageMetadata,
} from "./page-metadata";

const originalHead = document.head.innerHTML;

afterEach(() => {
  document.head.innerHTML = originalHead;
});

describe("PageMetadata", () => {
  it("updates existing metadata during client-side navigation", async () => {
    const { rerender } = render(
      <PageMetadata metadata={createHomepageMetadata()} />,
    );
    const glossaryMetadata = createGlossaryMetadata();

    rerender(<PageMetadata metadata={glossaryMetadata} />);

    await waitFor(() => {
      expect(document.title).toBe(glossaryMetadata.title);
    });
    expect(
      document.head.querySelector('meta[name="description"]'),
    ).toHaveAttribute("content", glossaryMetadata.description);
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      glossaryMetadata.canonicalUrl,
    );
    expect(document.head.querySelector('meta[property="og:url"]')).toHaveAttribute(
      "content",
      glossaryMetadata.canonicalUrl,
    );

    const structuredData = document.head.querySelector(
      "#page-structured-data",
    );
    expect(JSON.parse(structuredData?.textContent ?? "")).toMatchObject({
      "@type": "DefinedTermSet",
    });
  });
});