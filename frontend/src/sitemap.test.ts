import { describe, expect, it } from "vitest";
import { createSitemapXml } from "./sitemap";

describe("sitemap", () => {
  it("renders canonical production URLs without invented last-modified dates", () => {
    const sitemap = createSitemapXml([
      "/",
      "/about",
      "/glossary",
      "/glossary/mazel-tov",
    ]);

    expect(sitemap).toContain(
      "<loc>https://www.yeshivish-translator.com</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://www.yeshivish-translator.com/glossary/mazel-tov</loc>",
    );
    expect(sitemap).not.toContain("<lastmod>");
  });

  it("rejects duplicate routes", () => {
    expect(() => createSitemapXml(["/glossary", "/glossary"])).toThrow(
      "Sitemap routes must be unique.",
    );
  });

  it("escapes XML-sensitive route characters", () => {
    expect(createSitemapXml(["/search?a=one&b=two"])).toContain(
      "/search?a=one&amp;b=two",
    );
  });
});