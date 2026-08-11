import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSessionToken, translateText } from "./api";

function jsonResponse(
  body: unknown,
  ok = true,
  status = ok ? 200 : 400,
): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function sessionResponse(token = "session-token", expiresIn = 300): Response {
  return jsonResponse({ access_token: token, expires_in: expiresIn });
}

function bodyOf(call: unknown[] | undefined): Record<string, unknown> {
  return JSON.parse((call?.[1] as RequestInit)?.body as string);
}

function headersOf(call: unknown[] | undefined): Record<string, string> {
  return (call?.[1] as RequestInit)?.headers as Record<string, string>;
}

describe("translateText", () => {
  beforeEach(() => {
    clearSessionToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a session token before translating", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(sessionResponse("session-token"))
      .mockResolvedValueOnce(jsonResponse({ translation: "Really good." }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateText("Mamesh good.")).resolves.toBe("Really good.");

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/auth/session/");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/translate/");
    expect(bodyOf(fetchMock.mock.calls[1])).toEqual({
      text: "Mamesh good.",
      direction: "yeshivish_to_english",
    });
    expect(headersOf(fetchMock.mock.calls[1]).Authorization).toBe(
      "Bearer session-token",
    );
  });

  it("sends an explicitly selected direction", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(
        jsonResponse({ translation: "A geshmake shiur." }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await translateText("An enjoyable lesson.", "english_to_yeshivish");

    expect(bodyOf(fetchMock.mock.calls[1]).direction).toBe(
      "english_to_yeshivish",
    );
  });

  it("reuses a cached, unexpired session token across requests", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(jsonResponse({ translation: "First." }))
      .mockResolvedValueOnce(jsonResponse({ translation: "Second." }));
    vi.stubGlobal("fetch", fetchMock);

    await translateText("First");
    await translateText("Second");

    // One session fetch followed by two translate calls: the token is
    // never re-fetched while it is still valid.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never persists the session token outside of memory", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(sessionResponse())
        .mockResolvedValueOnce(jsonResponse({ translation: "Really good." })),
    );

    await translateText("Mamesh good.");

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it("refreshes an expired session token and retries once on 401", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(sessionResponse("stale-token"))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Session token has expired." }, false, 401),
      )
      .mockResolvedValueOnce(sessionResponse("fresh-token"))
      .mockResolvedValueOnce(jsonResponse({ translation: "Really good." }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateText("Mamesh good.")).resolves.toBe("Really good.");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(headersOf(fetchMock.mock.calls[3]).Authorization).toBe(
      "Bearer fresh-token",
    );
  });

  it("surfaces an error when a retry after refresh still fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(sessionResponse("stale-token"))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Session token has expired." }, false, 401),
      )
      .mockResolvedValueOnce(sessionResponse("fresh-token"))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Invalid session token." }, false, 401),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateText("Hello")).rejects.toThrow(
      "Invalid session token.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("throws when the session endpoint cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, false, 500)),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "Unable to start a translation session.",
    );
  });

  it("uses an API error message when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(sessionResponse())
        .mockResolvedValueOnce(
          jsonResponse(
            { error: "Translation is temporarily unavailable." },
            false,
          ),
        ),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "Translation is temporarily unavailable.",
    );
  });

  it("uses a fallback error for a non-JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(sessionResponse())
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => {
            throw new SyntaxError("not JSON");
          },
        } as unknown as Response),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "Translation request failed.",
    );
  });

  it("rejects a successful response without a translation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(sessionResponse())
        .mockResolvedValueOnce(jsonResponse({ translation: null })),
    );

    await expect(translateText("Hello")).rejects.toThrow(
      "The translation response was invalid.",
    );
  });

  it("surfaces network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(sessionResponse())
        .mockRejectedValueOnce(new TypeError("Network unavailable")),
    );

    await expect(translateText("Hello")).rejects.toThrow("Network unavailable");
  });
});
