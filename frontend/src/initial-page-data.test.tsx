import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  INITIAL_PAGE_DATA_ELEMENT_ID,
  readInitialPageData,
  useInitialPageData,
} from "./initial-page-data";
import InitialPageDataProvider from "./InitialPageDataProvider";
import type { InitialPageData } from "./models/initial-page-data";

afterEach(() => {
  document.getElementById(INITIAL_PAGE_DATA_ELEMENT_ID)?.remove();
});

function addInitialDataScript(content: string) {
  const script = document.createElement("script");
  script.id = INITIAL_PAGE_DATA_ELEMENT_ID;
  script.type = "application/json";
  script.textContent = content;
  document.body.append(script);
}

function InitialTermReader() {
  const { glossaryTerm } = useInitialPageData();
  return <span>{glossaryTerm?.term ?? "No initial term"}</span>;
}

describe("initial page data", () => {
  it("returns an empty object when no embedded data exists", () => {
    expect(readInitialPageData()).toEqual({});
  });

  it("reads valid embedded JSON", () => {
    addInitialDataScript('{"glossaryTerm":{"term":"Shabbos"}}');

    expect(readInitialPageData()).toMatchObject({
      glossaryTerm: { term: "Shabbos" },
    });
  });

  it("ignores malformed embedded JSON", () => {
    addInitialDataScript("not valid JSON");

    expect(readInitialPageData()).toEqual({});
  });

  it("provides initial data to page components", () => {
    const initialPageData = {
      glossaryTerm: { term: "Shabbos" },
    } as InitialPageData;

    render(
      <InitialPageDataProvider value={initialPageData}>
        <InitialTermReader />
      </InitialPageDataProvider>,
    );

    expect(screen.getByText("Shabbos")).toBeVisible();
  });
});