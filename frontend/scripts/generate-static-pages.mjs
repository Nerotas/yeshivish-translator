import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const frontendDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryDirectory = join(frontendDirectory, "..");
const distributionDirectory = join(frontendDirectory, "dist");
const serverBundleDirectory = join(frontendDirectory, ".ssr");
const templatePath = join(distributionDirectory, "index.html");
const glossaryPath = join(
  repositoryDirectory,
  "backend",
  "translator",
  "glossary.json",
);
const rootPlaceholder = '<div id="root"></div>';

function serializeInitialData(initialPageData) {
  return JSON.stringify(initialPageData)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function addRenderedApplication(template, applicationHtml, initialPageData) {
  if (!template.includes(rootPlaceholder)) {
    throw new Error("The built HTML does not contain the application root.");
  }

  const serializedData = serializeInitialData(initialPageData);
  const renderedRoot = [
    `<div id="root">${applicationHtml}</div>`,
    `<script id="initial-page-data" type="application/json">${serializedData}</script>`,
  ].join("\n");

  return template.replace(rootPlaceholder, renderedRoot);
}

function outputPathForRoute(route) {
  return route === "/"
    ? templatePath
    : join(distributionDirectory, route.slice(1), "index.html");
}

async function writeRenderedRoute({
  route,
  initialPageData,
  renderApplication,
  template,
}) {
  const applicationHtml = await renderApplication(route, initialPageData);
  const outputPath = outputPathForRoute(route);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    addRenderedApplication(template, applicationHtml, initialPageData),
    "utf8",
  );
}

async function generateStaticPages() {
  const serverEntryPath = join(serverBundleDirectory, "server-entry.js");
  const { createGlossarySlug, createPublishedGlossaryResponse, renderApplication } =
    await import(pathToFileURL(serverEntryPath).href);
  const [template, glossarySource] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(glossaryPath, "utf8"),
  ]);
  const glossary = createPublishedGlossaryResponse(JSON.parse(glossarySource));

  await writeRenderedRoute({
    route: "/",
    initialPageData: {},
    renderApplication,
    template,
  });
  await writeRenderedRoute({
    route: "/glossary",
    initialPageData: { glossary },
    renderApplication,
    template,
  });

  for (const glossaryTerm of glossary.results) {
    await writeRenderedRoute({
      route: `/glossary/${createGlossarySlug(glossaryTerm.term)}`,
      initialPageData: { glossaryTerm },
      renderApplication,
      template,
    });
  }

  console.log(`Generated ${glossary.count + 2} static pages.`);
}

try {
  await generateStaticPages();
} finally {
  await rm(serverBundleDirectory, { recursive: true, force: true });
}

// React's server runtime can retain an idle handle on Node 25 after all work
// has completed. This line is reached only when generation and cleanup succeed.
process.exit(0);