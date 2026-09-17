import { describe, expect, it } from "vitest";
import { renderApplication } from "./server-entry";
import type { GlossaryResponse, GlossaryTerm } from "./models/glossary";

const shabbos: GlossaryTerm = {
  id: 1,
  term: "Shabbos",
  aleph_beis: "שבת",
  display_terms: { shabbos: "Shabbos", shabbat: "Shabbat" },
  variants: ["Shabbat"],
  meanings: ["the Jewish Sabbath"],
  context_note: "The weekly sacred day of rest.",
  category: "religious practice",
  language_origin: "mixed",
  yeshivish_example: "We are staying for Shabbos.",
  plain_english_example: "We are staying for the Sabbath.",
};

describe("server entry", () => {
  it("renders the homepage application content", async () => {
    const html = await renderApplication("/", {});

    expect(html).toContain("Translate a sentence");
  });

  it("renders a term page from one embedded glossary entry", async () => {
    const html = await renderApplication("/glossary/shabbos", {
      glossaryTerm: shabbos,
    });

    expect(html).toContain("<h1>Shabbos</h1>");
    expect(html).toContain("the Jewish Sabbath");
    expect(html).not.toContain("Loading glossary term");
  });

  it("renders every supplied glossary index link", async () => {
    const glossary: GlossaryResponse = { count: 1, results: [shabbos] };

    const html = await renderApplication("/glossary", { glossary });

    expect(html).toContain("Browse alphabetically");
    expect(html).toContain('href="/glossary/shabbos"');
  }, 15_000);
});