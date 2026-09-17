import { QueryClient } from "@tanstack/react-query";
import { renderToReadableStream } from "react-dom/server.browser";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import AppProviders from "./AppProviders";
import { createPublishedGlossaryResponse } from "./glossary-publication";
import { createGlossarySlug } from "./glossary-routing";
import type { InitialPageData } from "./models/initial-page-data";
import {
  createAboutMetadata,
  createGlossaryMetadata,
  createGlossaryTermMetadata,
  createHomepageMetadata,
  createNotFoundMetadata,
  renderPageMetadataHtml,
} from "./page-metadata";
import { createSitemapXml } from "./sitemap";

export {
  createAboutMetadata,
  createGlossaryMetadata,
  createGlossarySlug,
  createGlossaryTermMetadata,
  createHomepageMetadata,
  createNotFoundMetadata,
  createPublishedGlossaryResponse,
  createSitemapXml,
  renderPageMetadataHtml,
};

/** Renders one route after all lazy page modules have resolved. */
export async function renderApplication(
  pathname: string,
  initialPageData: InitialPageData,
): Promise<string> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const stream = await renderToReadableStream(
    <MemoryRouter initialEntries={[pathname]}>
      <AppProviders
        initialPageData={initialPageData}
        queryClient={queryClient}
      >
        <App />
      </AppProviders>
    </MemoryRouter>,
  );

  try {
    await stream.allReady;
    return await new Response(stream).text();
  } finally {
    queryClient.clear();
  }
}