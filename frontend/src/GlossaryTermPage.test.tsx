import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

function renderTermRoute(pathname: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <QueryClientProvider client={queryClient}>
        <PronunciationProvider>
          <App />
        </PronunciationProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("GlossaryTermPage", () => {
  beforeEach(() => {
    mockedFetchGlossary.mockReset();
  });

  it("renders the glossary entry selected by the route slug", async () => {
    mockedFetchGlossary.mockResolvedValue({ count: 1, results: [shabbos] });

    renderTermRoute("/glossary/shabbos");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Shabbos" }),
    ).toBeVisible();
    expect(screen.getByText("שבת")).toBeVisible();
    expect(screen.getByText("the Jewish Sabbath")).toBeVisible();
    expect(screen.getByText("Shabbat, Shabbas")).toBeVisible();
    expect(screen.getByText("The weekly sacred day of rest.")).toBeVisible();
    expect(screen.getByText("religious practice")).toBeVisible();
    expect(screen.getByText("mixed")).toBeVisible();
    expect(screen.getByText("We are staying for Shabbos.")).toBeVisible();
    expect(screen.getByText("We are staying for the Sabbath.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the glossary" })).toHaveAttribute(
      "href",
      "/glossary",
    );
  });

  it("shows a term-specific not-found state for an unknown slug", async () => {
    mockedFetchGlossary.mockResolvedValue({ count: 1, results: [shabbos] });

    renderTermRoute("/glossary/not-a-real-term");

    expect(
      await screen.findByRole("heading", { name: "Glossary term not found" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Return to the glossary" }),
    ).toHaveAttribute("href", "/glossary");
  });

  it("shows an API error without replacing it with a not-found state", async () => {
    mockedFetchGlossary.mockRejectedValue(new Error("Unable to load glossary."));

    renderTermRoute("/glossary/shabbos");

    expect(
      await screen.findByRole("alert", {}, { timeout: 5_000 }),
    ).toHaveTextContent("Unable to load glossary.");
  });
});