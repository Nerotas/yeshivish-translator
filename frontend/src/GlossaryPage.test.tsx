import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { fetchGlossary } from "./api";
import { PronunciationProvider } from "./PronunciationProvider";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  fetchGlossary: vi.fn(),
}));

const mockedFetchGlossary = vi.mocked(fetchGlossary);
const shabbos = {
  id: 1,
  term: "Shabbos",
  aleph_beis: "שבת",
  display_terms: { shabbos: "Shabbos", shabbat: "Shabbat" },
  variants: ["Shabbat", "Shabbas"],
  meanings: ["the Jewish Sabbath"],
  context_note: "The weekly sacred day of rest.",
  category: "religious practice",
  language_origin: "mixed",
  yeshivish_example: "We are staying for Shabbos.",
  plain_english_example: "We are staying for the Sabbath.",
};

function renderGlossary() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={["/glossary"]}>
      <QueryClientProvider client={queryClient}>
        <PronunciationProvider>
          <App />
        </PronunciationProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("GlossaryPage", () => {
  beforeEach(() => {
    mockedFetchGlossary.mockReset();
    localStorage.clear();
  });

  it(
    "shows loading, then renders glossary rows and details",
    async () => {
      mockedFetchGlossary.mockResolvedValue({ count: 1, results: [shabbos] });
      renderGlossary();

      expect(screen.getByRole("status")).toHaveTextContent("Loading glossary");
      expect(
        await screen.findByText("the Jewish Sabbath", {}, { timeout: 5_000 }),
      ).toBeVisible();
      expect(screen.getByText(/Browse 1 term/)).toBeVisible();
      expect(screen.getByRole("gridcell", { name: "שבת" })).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Aleph Beis" }),
      ).toBeVisible();

      const detailsButton = screen.getByRole("button", {
        name: "View details for Shabbos",
      });
      fireEvent.mouseOver(detailsButton);
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "View details",
      );
      fireEvent.click(detailsButton);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("Alternate spellings: Shabbat, Shabbas");
      expect(dialog).toHaveTextContent("Category: religious practice");
      expect(dialog).toHaveTextContent("Language origin: mixed");
      expect(dialog).toHaveTextContent("The weekly sacred day of rest.");
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    },
    10_000,
  );

  it("uses the global pronunciation preference for display", async () => {
    mockedFetchGlossary.mockResolvedValue({ count: 1, results: [shabbos] });
    renderGlossary();

    await screen.findByText("the Jewish Sabbath");
    fireEvent.click(screen.getByRole("button", { name: "Shabbat" }));
    expect(screen.getByText("Shabbat", { selector: ".MuiDataGrid-cell" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Aleph Beit" }),
    ).toBeVisible();
  });

  it("shows API errors", async () => {
    mockedFetchGlossary.mockRejectedValue(new Error("Unable to load glossary."));
    renderGlossary();

    expect(
      await screen.findByRole("alert", {}, { timeout: 5_000 }),
    ).toHaveTextContent("Unable to load glossary.");
  });

  it("handles an empty glossary", async () => {
    mockedFetchGlossary.mockResolvedValue({ count: 0, results: [] });
    renderGlossary();

    expect(await screen.findByText("No glossary terms were found.")).toBeVisible();
  });
});
