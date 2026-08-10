import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { translateText } from "./api";

vi.mock("./api", () => ({
  translateText: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    translateText.mockReset();
  });

  it("switches direction, labels, and placeholder text", () => {
    render(<App />);

    expect(screen.getByLabelText("Yeshivish text")).toHaveAttribute(
      "placeholder",
      "Enter Yeshivish text to translate",
    );

    fireEvent.click(screen.getByRole("button", { name: "English → Yeshivish" }));

    expect(screen.getByLabelText("English text")).toHaveAttribute(
      "placeholder",
      "Enter English text to translate",
    );
    expect(
      screen.getByRole("button", { name: "English → Yeshivish" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("sends the selected direction and clears an old translation on switch", async () => {
    translateText.mockResolvedValue("That was a geshmake shiur.");
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "English → Yeshivish" }));
    fireEvent.change(screen.getByLabelText("English text"), {
      target: { value: "That was an enjoyable lesson." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));

    expect(await screen.findByText("That was a geshmake shiur.")).toBeVisible();
    expect(translateText).toHaveBeenCalledWith(
      "That was an enjoyable lesson.",
      "english_to_yeshivish",
    );

    fireEvent.click(screen.getByRole("button", { name: "Yeshivish → English" }));
    expect(screen.queryByText("That was a geshmake shiur.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Yeshivish text")).toHaveValue(
      "That was an enjoyable lesson.",
    );
  });

  it("shows API errors", async () => {
    translateText.mockRejectedValue(new Error("Translation request failed."));
    render(<App />);

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
});
