import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { translateText } from "./api";
import { PRONUNCIATION_STORAGE_KEY } from "./pronunciation";
import { PronunciationProvider } from "./PronunciationProvider";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  translateText: vi.fn(),
}));

const mockedTranslateText = vi.mocked(translateText);

function renderApp() {
  return render(
    <PronunciationProvider>
      <App />
    </PronunciationProvider>,
  );
}

describe("App", () => {
  beforeEach(() => {
    mockedTranslateText.mockReset();
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("uses light mode by default and persists an explicit dark selection", () => {
    renderApp();

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("yeshivish-translator-theme")).toBe("dark");
  });

  it("restores a saved theme without consulting system preferences", () => {
    localStorage.setItem("yeshivish-translator-theme", "dark");

    renderApp();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches direction, labels, and placeholder text", () => {
    renderApp();

    expect(screen.getByLabelText("Yeshivish text")).toHaveAttribute(
      "placeholder",
      "Enter Yeshivish text to translate",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "English → Yeshivish" }),
    );

    expect(screen.getByLabelText("English text")).toHaveAttribute(
      "placeholder",
      "Enter English text to translate",
    );
    expect(
      screen.getByRole("button", { name: "English → Yeshivish" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("switches back to light mode and updates the saved preference", () => {
    localStorage.setItem("yeshivish-translator-theme", "dark");
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("yeshivish-translator-theme")).toBe("light");
  });

  it("sends the selected direction and clears an old translation on switch", async () => {
    mockedTranslateText.mockResolvedValue("That was a geshmake shiur.");
    renderApp();

    fireEvent.click(
      screen.getByRole("button", { name: "English → Yeshivish" }),
    );
    fireEvent.change(screen.getByLabelText("English text"), {
      target: { value: "That was an enjoyable lesson." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));

    expect(await screen.findByText("That was a geshmake shiur.")).toBeVisible();
    expect(mockedTranslateText).toHaveBeenCalledWith(
      "That was an enjoyable lesson.",
      "english_to_yeshivish",
      "shabbos",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Yeshivish → English" }),
    );
    expect(
      screen.queryByText("That was a geshmake shiur."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Yeshivish text")).toHaveValue(
      "That was an enjoyable lesson.",
    );
  });

  it("shows API errors", async () => {
    mockedTranslateText.mockRejectedValue(
      new Error("Translation request failed."),
    );
    renderApp();

    fireEvent.change(screen.getByLabelText("Yeshivish text"), {
      target: { value: "Mamesh good." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Translation request failed.",
      );
    });
  });

  it("validates empty input without making an API request", () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Translate" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter Yeshivish text to translate.",
    );
    expect(mockedTranslateText).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "English → Yeshivish" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter English text to translate.",
    );
  });

  it("disables submission while a translation is pending", async () => {
    let finishRequest: (translation: string) => void = () => undefined;
    mockedTranslateText.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve;
      }),
    );
    renderApp();

    fireEvent.change(screen.getByLabelText("Yeshivish text"), {
      target: { value: "Mamesh good." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));

    expect(
      screen.getByRole("button", { name: "Translating..." }),
    ).toBeDisabled();

    finishRequest("Really good.");
    expect(await screen.findByText("Really good.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Translate" })).toBeEnabled();
  });

  it("shows a privacy notice with a link to the data-handling details", () => {
    renderApp();

    expect(
      screen.getByText(/submitted text is sent to openai/i),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: "Learn how your data is handled",
    });
    expect(link).toHaveAttribute("href", "#privacy-details");

    expect(
      screen.getByRole("heading", { name: "How your data is handled" }),
    ).toBeInTheDocument();
  });

  it("uses a safe fallback for unexpected non-Error failures", async () => {
    mockedTranslateText.mockRejectedValue("unexpected failure");
    renderApp();

    fireEvent.change(screen.getByLabelText("Yeshivish text"), {
      target: { value: "Mamesh good." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Translation request failed.",
    );
  });

  it("renders model output as escaped plain text", async () => {
    mockedTranslateText.mockResolvedValue(
      '<script data-testid="model-script">alert("unsafe")</script>',
    );
    renderApp();

    fireEvent.change(screen.getByLabelText("Yeshivish text"), {
      target: { value: "Translate this." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));

    expect(await screen.findByText(/<script data-testid=/)).toBeVisible();
    expect(screen.queryByTestId("model-script")).not.toBeInTheDocument();
  });

  it("defaults to Shabbos and persists pronunciation switching", () => {
    renderApp();

    const shabbos = screen.getByRole("button", { name: "Shabbos" });
    const shabbat = screen.getByRole("button", { name: "Shabbat" });
    expect(shabbos).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(PRONUNCIATION_STORAGE_KEY)).toBe("shabbos");

    fireEvent.click(shabbat);
    expect(shabbat).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(PRONUNCIATION_STORAGE_KEY)).toBe("shabbat");

    fireEvent.click(shabbos);
    expect(shabbos).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(PRONUNCIATION_STORAGE_KEY)).toBe("shabbos");
  });

  it("restores a valid pronunciation and rejects an invalid saved value", () => {
    localStorage.setItem(PRONUNCIATION_STORAGE_KEY, "shabbat");
    const { unmount } = renderApp();
    expect(screen.getByRole("button", { name: "Shabbat" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    unmount();
    localStorage.setItem(PRONUNCIATION_STORAGE_KEY, "invalid");
    renderApp();
    expect(screen.getByRole("button", { name: "Shabbos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("sends the active pronunciation preference for translation", async () => {
    mockedTranslateText.mockResolvedValue("A Shabbat meal.");
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Shabbat" }));
    fireEvent.change(screen.getByLabelText("Yeshivish text"), {
      target: { value: "A Shabbos seudah." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));

    await screen.findByText("A Shabbat meal.");
    expect(mockedTranslateText).toHaveBeenCalledWith(
      "A Shabbos seudah.",
      "yeshivish_to_english",
      "shabbat",
    );
  });
});
