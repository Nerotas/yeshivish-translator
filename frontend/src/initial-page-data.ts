import { createContext, useContext } from "react";
import type { InitialPageData } from "./models/initial-page-data";

export const INITIAL_PAGE_DATA_ELEMENT_ID = "initial-page-data";

export const InitialPageDataContext = createContext<InitialPageData>({});

export function useInitialPageData(): InitialPageData {
  return useContext(InitialPageDataContext);
}

/** Reads build-controlled JSON embedded beside the application root. */
export function readInitialPageData(): InitialPageData {
  const dataElement = document.getElementById(INITIAL_PAGE_DATA_ELEMENT_ID);
  if (!dataElement?.textContent) {
    return {};
  }

  try {
    return JSON.parse(dataElement.textContent) as InitialPageData;
  } catch {
    return {};
  }
}