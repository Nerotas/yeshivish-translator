import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const frontendDirectory = join(fileURLToPath(new URL("..", import.meta.url)));
const repositoryDirectory = join(frontendDirectory, "..");
const distributionDirectory = join(frontendDirectory, "dist");
const canonicalOrigin = "https://www.yeshivish-translator.com";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(relativePath) {
  return readFileSync(join(distributionDirectory, relativePath), "utf8");
}

function pageFileForPath(pathname) {
  return pathname === "/"
    ? join(distributionDirectory, "index.html")
    : join(distributionDirectory, pathname.slice(1), "index.html");
}

function canonicalUrlForPath(pathname) {
  return pathname === "/" ? canonicalOrigin : `${canonicalOrigin}${pathname}`;
}

function readPublishedTermSlugs() {
  const glossaryDocument = JSON.parse(
    readFileSync(
      join(repositoryDirectory, "backend", "translator", "glossary.json"),
      "utf8",
    ),
  );
  assert(
    glossaryDocument.entry_count === glossaryDocument.entries.length,
    "Published glossary entry_count does not match its entries.",
  );

  return glossaryDocument.entries.map((entry) =>
    entry.term
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/['\u2018\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );
}

function parseHtml(filePath) {
  return new JSDOM(readFileSync(filePath, "utf8")).window.document;
}

function parseSitemapUrls() {
  const xml = new JSDOM(readText("sitemap.xml"), {
    contentType: "application/xml",
  }).window.document;
  assert(!xml.querySelector("parsererror"), "sitemap.xml is not valid XML.");
  return [...xml.querySelectorAll("loc")].map((location) =>
    location.textContent.trim(),
  );
}

function assertIndexablePage(pathname, seenTitles, seenCanonicalUrls) {
  const filePath = pageFileForPath(pathname);
  assert(existsSync(filePath), `Missing generated page for ${pathname}.`);

  const document = parseHtml(filePath);
  const title = document.querySelector("title")?.textContent.trim();
  const description = document
    .querySelector('meta[name="description"]')
    ?.getAttribute("content")
    ?.trim();
  const canonicalLinks = document.querySelectorAll('link[rel="canonical"]');
  const structuredDataScripts = document.querySelectorAll(
    'script[type="application/ld+json"]',
  );

  assert(title, `${pathname} does not have a title.`);
  assert(description, `${pathname} does not have a meta description.`);
  assert(
    canonicalLinks.length === 1,
    `${pathname} must have exactly one canonical URL.`,
  );
  assert(
    structuredDataScripts.length === 1,
    `${pathname} must have exactly one JSON-LD block.`,
  );

  const canonicalUrl = canonicalLinks[0].getAttribute("href");
  assert(
    canonicalUrl === canonicalUrlForPath(pathname),
    `${pathname} has unexpected canonical URL ${canonicalUrl}.`,
  );
  assert(!seenTitles.has(title), `Duplicate page title: ${title}.`);
  assert(
    !seenCanonicalUrls.has(canonicalUrl),
    `Duplicate canonical URL: ${canonicalUrl}.`,
  );
  seenTitles.add(title);
  seenCanonicalUrls.add(canonicalUrl);

  for (const script of structuredDataScripts) {
    JSON.parse(script.textContent);
  }

  return document;
}

function assertInternalLinksResolve(documentsByPath) {
  for (const [sourcePath, document] of documentsByPath) {
    const internalLinks = document.querySelectorAll('a[href^="/"]');
    for (const link of internalLinks) {
      const pathname = new URL(link.getAttribute("href"), canonicalOrigin)
        .pathname;
      assert(
        documentsByPath.has(pathname),
        `${sourcePath} links to missing internal page ${pathname}.`,
      );
    }
  }
}

function assertCrawlerFiles(expectedCanonicalUrls) {
  const sitemapUrls = parseSitemapUrls();
  assert(
    sitemapUrls.length === expectedCanonicalUrls.size,
    `Sitemap has ${sitemapUrls.length} URLs; expected ${expectedCanonicalUrls.size}.`,
  );
  assert(
    new Set(sitemapUrls).size === sitemapUrls.length,
    "Sitemap contains duplicate URLs.",
  );
  for (const expectedUrl of expectedCanonicalUrls) {
    assert(sitemapUrls.includes(expectedUrl), `Sitemap is missing ${expectedUrl}.`);
  }
  assert(
    sitemapUrls.every((url) => url.startsWith(canonicalOrigin)),
    "Sitemap contains a non-canonical origin.",
  );

  const robots = readText("robots.txt");
  assert(/User-agent:\s*\*/i.test(robots), "robots.txt lacks the general policy.");
  assert(/User-agent:\s*OAI-SearchBot/i.test(robots), "OAI-SearchBot is not explicit.");
  assert(/Allow:\s*\//i.test(robots), "robots.txt does not allow crawling.");
  assert(
    robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`),
    "robots.txt does not reference the canonical sitemap.",
  );
}

function readPngDimensions(filePath) {
  const png = readFileSync(filePath);
  assert(png.toString("ascii", 1, 4) === "PNG", `${filePath} is not a PNG.`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function assertPublicAssets(homepage) {
  const faviconPath = homepage
    .querySelector('link[rel="icon"]')
    ?.getAttribute("href");
  assert(faviconPath, "Homepage does not declare a favicon.");
  assert(
    existsSync(join(distributionDirectory, faviconPath.slice(1))),
    `Favicon asset ${faviconPath} is missing.`,
  );

  const socialImageUrl = homepage
    .querySelector('meta[property="og:image"]')
    ?.getAttribute("content");
  assert(
    socialImageUrl === `${canonicalOrigin}/social-preview.png`,
    "Homepage does not reference the canonical social image.",
  );
  const dimensions = readPngDimensions(
    join(distributionDirectory, "social-preview.png"),
  );
  assert(
    dimensions.width === 1200 && dimensions.height === 630,
    "Social preview must be 1200 by 630 pixels.",
  );
}

function assertNotFoundPage() {
  const filePath = join(distributionDirectory, "404.html");
  assert(existsSync(filePath), "Missing generated 404.html.");
  const document = parseHtml(filePath);
  assert(
    document.querySelector('meta[name="robots"]')?.getAttribute("content") ===
      "noindex, nofollow",
    "404.html must be noindex, nofollow.",
  );
  assert(!document.querySelector('link[rel="canonical"]'), "404.html has a canonical URL.");
  assert(!document.querySelector('meta[property="og:url"]'), "404.html has an Open Graph URL.");
  assert(!document.querySelector('script[type="application/ld+json"]'), "404.html has JSON-LD.");
  assert(
    document.body.textContent.includes("Page not found"),
    "404.html does not contain the Not Found experience.",
  );
}

function verifyStaticOutput() {
  assert(existsSync(distributionDirectory), "Build output directory is missing.");
  const glossarySlugs = readPublishedTermSlugs();
  assert(
    new Set(glossarySlugs).size === glossarySlugs.length,
    "Published glossary creates duplicate slugs.",
  );

  const publicPaths = [
    "/",
    "/glossary",
    "/about",
    ...glossarySlugs.map((slug) => `/glossary/${slug}`),
  ];
  const seenTitles = new Set();
  const seenCanonicalUrls = new Set();
  const documentsByPath = new Map();

  for (const pathname of publicPaths) {
    documentsByPath.set(
      pathname,
      assertIndexablePage(pathname, seenTitles, seenCanonicalUrls),
    );
  }

  const glossaryIndex = documentsByPath.get("/glossary");
  const glossaryLinks = new Set(
    [...glossaryIndex.querySelectorAll('a[href^="/glossary/"]')].map((link) =>
      link.getAttribute("href"),
    ),
  );
  for (const slug of glossarySlugs) {
    assert(
      glossaryLinks.has(`/glossary/${slug}`),
      `Glossary index is missing a link to ${slug}.`,
    );
  }

  assertInternalLinksResolve(documentsByPath);
  assertCrawlerFiles(seenCanonicalUrls);
  assertPublicAssets(documentsByPath.get("/"));
  assertNotFoundPage();

  const generatedHtmlCount = readdirSync(distributionDirectory, {
    recursive: true,
  }).filter((relativePath) => relativePath.endsWith(".html")).length;
  assert(
    generatedHtmlCount === publicPaths.length + 1,
    `Found ${generatedHtmlCount} HTML files; expected ${publicPaths.length + 1}.`,
  );

  console.log(
    `Verified ${publicPaths.length} indexable pages, ${glossarySlugs.length} glossary routes, and 404.html.`,
  );
}

verifyStaticOutput();