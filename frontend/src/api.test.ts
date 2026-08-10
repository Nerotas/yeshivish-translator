import { afterEach, describe, expect, it, vi } from "vitest";
import { translateText } from "./api";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe("translateText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to the backward-compatible direction", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ translation: "Really good." }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateText("Mamesh good.")).resolves.toBe("Really good.");

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(request?.body as string)).toEqual({
      text: "Mamesh good.",
      direction: "yeshivish_to_english",
    });
  });

  it("sends an explicitly selected direction", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ translation: "A geshmake shiur." }));
    vi.stubGlobal("fetch", fetchMock);

    await translateText("An enjoyable lesson.", "english_to_yeshivish");

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(request?.body as string).direction).toBe(
      "english_to_yeshivish",
    );
  });

  it("uses an API error message when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ error: "Translation is temporarily unavailable." }, false),
        ),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "Translation is temporarily unavailable.",
    );
  });

  it("uses a fallback error for a non-JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        {
          ok: false,
          json: async () => {
            throw new SyntaxError("not JSON");
          },
        } as unknown as Response,
      ),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "Translation request failed.",
    );
  });

  it("rejects a successful response without a translation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ translation: null })),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "The translation response was invalid.",
    );
  });

  it("surfaces network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Network unavailable")),
    );

    await expect(translateText("Hello")).rejects.toThrow("Network unavailable");
  });
});
