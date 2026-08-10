import { afterEach, describe, expect, it, vi } from "vitest";
import { translateText } from "./api";

describe("translateText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to the backward-compatible direction", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translation: "Really good." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateText("Mamesh good.")).resolves.toBe("Really good.");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      text: "Mamesh good.",
      direction: "yeshivish_to_english",
    });
  });

  it("sends an explicitly selected direction", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translation: "A geshmake shiur." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await translateText("An enjoyable lesson.", "english_to_yeshivish");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).direction).toBe(
      "english_to_yeshivish",
    );
  });

  it("uses an API error message when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Translation is temporarily unavailable." }),
      }),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "Translation is temporarily unavailable.",
    );
  });

  it("uses a fallback error for a non-JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new SyntaxError("not JSON");
        },
      }),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "Translation request failed.",
    );
  });
});
