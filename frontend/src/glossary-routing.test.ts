import { describe, expect, it } from "vitest";
import glossaryDocument from "../../backend/translator/glossary.json";
import {
  createGlossarySlug,
  findGlossaryEntryBySlug,
} from "./glossary-routing";

describe("glossary routing", () => {
  it.each([
    ["Mazel Tov", "mazel-tov"],
    ["ST'M", "stm"],
    ["Tishrei / Tishri", "tishrei-tishri"],
    ["chavrusa", "chavrusa"],
  ])("creates the canonical slug for %s", (term, expectedSlug) => {
    expect(createGlossarySlug(term)).toBe(expectedSlug);
  });

  it("finds an entry by its exact canonical slug", () => {
    const entries = [
      { term: "Mazel Tov", meanings: ["congratulations"] },
      { term: "Shabbos", meanings: ["the Jewish Sabbath"] },
    ];

    expect(findGlossaryEntryBySlug(entries, "shabbos")).toBe(entries[1]);
    expect(findGlossaryEntryBySlug(entries, "missing-term")).toBeUndefined();
  });

  it("creates one non-empty, unique slug for every published term", () => {
    const slugs = glossaryDocument.entries.map((entry) =>
      createGlossarySlug(entry.term),
    );

    expect(slugs).not.toContain("");
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});