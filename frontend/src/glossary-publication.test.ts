import { describe, expect, it } from "vitest";
import glossaryDocument from "../../backend/translator/glossary.json";
import { createPublishedGlossaryResponse } from "./glossary-publication";
import type { PublishedGlossaryDocument } from "./models/published-glossary";

describe("published glossary adapter", () => {
  it("converts the complete publication into frontend terms", () => {
    const glossary = createPublishedGlossaryResponse(
      glossaryDocument as PublishedGlossaryDocument,
    );
    const shabbos = glossary.results.find((entry) => entry.term === "Shabbos");

    expect(glossary.count).toBe(822);
    expect(shabbos?.display_terms).toEqual({
      shabbos: "Shabbos",
      shabbat: "Shabbat",
    });
    expect(shabbos?.aleph_beis).toBe("שבת");
  });

  it("rejects publication metadata that does not match its entries", () => {
    expect(() =>
      createPublishedGlossaryResponse({ entry_count: 1, entries: [] }),
    ).toThrow("declares 1 entries but contains 0");
  });

  it("reports colliding route slugs with both source terms", () => {
    const sharedFields = {
      aleph_beis: "בדיקה",
      variants: [],
      meanings: ["test"],
      context_note: "Test entry.",
    };

    expect(() =>
      createPublishedGlossaryResponse({
        entry_count: 2,
        entries: [
          { term: "Test term", ...sharedFields },
          { term: "Test-term", ...sharedFields },
        ],
      }),
    ).toThrow('"Test term" and "Test-term" share slug "test-term"');
  });
});