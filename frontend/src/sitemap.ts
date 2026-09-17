import { SITE_ORIGIN } from "./page-metadata";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Creates a sitemap from canonical paths and rejects accidental duplicates. */
export function createSitemapXml(pathnames: readonly string[]): string {
  const uniquePathnames = new Set(pathnames);
  if (uniquePathnames.size !== pathnames.length) {
    throw new Error("Sitemap routes must be unique.");
  }

  const urls = pathnames
    .map((pathname) => {
      const url = pathname === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${pathname}`;
      return `  <url><loc>${escapeXml(url)}</loc></url>`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}