import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import GlossaryIndex from "./GlossaryIndex";
import type { GlossaryTerm } from "./models/glossary";

const glossaryTerms: GlossaryTerm[] = [
  {
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
  },
  {
    id: 2,
    term: "Mazel Tov",
    aleph_beis: "מזל טוב",
    display_terms: { shabbos: "Mazel Tov", shabbat: "Mazel Tov" },
    variants: ["Mazal Tov"],
    meanings: ["congratulations"],
    context_note: "Used to congratulate someone.",
    category: "expression",
    language_origin: "Hebrew",
    yeshivish_example: "Mazel tov on the simcha.",
    plain_english_example: "Congratulations on the celebration.",
  },
];

function renderIndex(pronunciationPreference: "shabbos" | "shabbat") {
  return render(
    <MemoryRouter>
      <GlossaryIndex
        pronunciationPreference={pronunciationPreference}
        terms={glossaryTerms}
      />
    </MemoryRouter>,
  );
}

describe("GlossaryIndex", () => {
  it("renders every term as a canonical glossary link", () => {
    renderIndex("shabbos");

    expect(screen.getByRole("link", { name: "Mazel Tov" })).toHaveAttribute(
      "href",
      "/glossary/mazel-tov",
    );
    expect(screen.getByRole("link", { name: "Shabbos" })).toHaveAttribute(
      "href",
      "/glossary/shabbos",
    );
  });

  it("groups terms under linked alphabetical headings", () => {
    renderIndex("shabbos");

    const alphabet = screen.getByRole("navigation", {
      name: "Glossary alphabet",
    });
    expect(within(alphabet).getByRole("link", { name: "M" })).toHaveAttribute(
      "href",
      "#glossary-letter-m",
    );
    expect(within(alphabet).getByRole("link", { name: "S" })).toHaveAttribute(
      "href",
      "#glossary-letter-s",
    );
  });

  it("uses the selected pronunciation without changing the canonical URL", () => {
    renderIndex("shabbat");

    expect(screen.getByRole("link", { name: "Shabbat" })).toHaveAttribute(
      "href",
      "/glossary/shabbos",
    );
  });

  it("renders nothing for an empty glossary", () => {
    const { container } = render(
      <MemoryRouter>
        <GlossaryIndex pronunciationPreference="shabbos" terms={[]} />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});