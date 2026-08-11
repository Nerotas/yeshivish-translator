import { describe, expect, it } from "vitest";
import { getDisplayTerm, resolveDialectTerm } from "./pronunciation";

describe("pronunciation helpers", () => {
  it.each([
    ["Shabb[os|at]", "shabbos", "Shabbos"],
    ["Shabb[os|at]", "shabbat", "Shabbat"],
    ["ba[s|t] mitzvah", "shabbos", "bas mitzvah"],
    ["ba[s|t] mitzvah", "shabbat", "bat mitzvah"],
  ] as const)("resolves %s in %s mode", (pattern, preference, expected) => {
    expect(resolveDialectTerm(pattern, preference)).toBe(expected);
  });

  it("supports multiple patterns", () => {
    expect(resolveDialectTerm("[bei|bei][s|t] midrash", "shabbat")).toBe(
      "beit midrash",
    );
  });

  it("leaves malformed patterns and unaffected entries unchanged", () => {
    expect(resolveDialectTerm("Shabb[os|at", "shabbat")).toBe("Shabb[os|at");
    expect(getDisplayTerm({ term: "mamesh" }, "shabbat")).toBe("mamesh");
  });

  it("uses the dialect pattern instead of the canonical term", () => {
    expect(
      getDisplayTerm(
        { term: "shacharis", dialect_pattern: "shachari[s|t]" },
        "shabbat",
      ),
    ).toBe("shacharit");
  });
});
