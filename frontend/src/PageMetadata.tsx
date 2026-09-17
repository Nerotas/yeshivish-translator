import { useEffect } from "react";
import type { PageMetadata as PageMetadataModel } from "./models/page-metadata";

interface PageMetadataProps {
  metadata: PageMetadataModel;
}

function getOrCreateHeadElement<T extends HTMLElement>(
  selector: string,
  createElement: () => T,
): T {
  const existingElement = document.head.querySelector<T>(selector);
  if (existingElement) {
    return existingElement;
  }

  const element = createElement();
  document.head.append(element);
  return element;
}

function setMetaContent(
  attributeName: "name" | "property",
  attributeValue: string,
  content: string,
) {
  const selector = `meta[${attributeName}="${attributeValue}"]`;
  const meta = getOrCreateHeadElement(selector, () => {
    const element = document.createElement("meta");
    element.setAttribute(attributeName, attributeValue);
    return element;
  });
  meta.setAttribute("content", content);
}

/** Keeps document metadata synchronized after client-side route changes. */
export default function PageMetadata({ metadata }: PageMetadataProps) {
  useEffect(() => {
    document.title = metadata.title;
    setMetaContent("name", "description", metadata.description);
    setMetaContent("property", "og:type", "website");
    setMetaContent("property", "og:title", metadata.title);
    setMetaContent("property", "og:description", metadata.description);
    setMetaContent("property", "og:url", metadata.canonicalUrl);
    setMetaContent("property", "og:image", metadata.socialImageUrl);
    setMetaContent("name", "twitter:card", "summary_large_image");
    setMetaContent("name", "twitter:title", metadata.title);
    setMetaContent("name", "twitter:description", metadata.description);
    setMetaContent("name", "twitter:image", metadata.socialImageUrl);

    const canonicalLink = getOrCreateHeadElement('link[rel="canonical"]', () => {
      const element = document.createElement("link");
      element.rel = "canonical";
      return element;
    });
    canonicalLink.setAttribute("href", metadata.canonicalUrl);

    const structuredData = getOrCreateHeadElement(
      "#page-structured-data",
      () => {
        const element = document.createElement("script");
        element.id = "page-structured-data";
        element.type = "application/ld+json";
        return element;
      },
    );
    structuredData.textContent = JSON.stringify(metadata.structuredData);
  }, [metadata]);

  return null;
}