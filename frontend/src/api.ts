import type { PronunciationPreference } from "./pronunciation";

export const TRANSLATION_DIRECTIONS = [
  "yeshivish_to_english",
  "english_to_yeshivish",
] as const;

export type TranslationDirection = (typeof TRANSLATION_DIRECTIONS)[number];

export interface GlossaryTerm {
  id: number;
  term: string;
  aleph_beis: string;
  display_terms: Record<PronunciationPreference, string>;
  variants: string[];
  meanings: string[];
  context_note: string;
  category: string;
  language_origin: string;
  yeshivish_example: string;
  plain_english_example: string;
}

export interface GlossaryResponse {
  count: number;
  results: GlossaryTerm[];
}

export const glossaryQueryKey = ["glossary"] as const;
export const GLOSSARY_STALE_TIME_MS = 60 * 60 * 1000;

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// A short-lived translate session token, held only in memory for this tab.
// It is fetched on demand from the backend and is never persisted to
// localStorage/sessionStorage/cookies or compiled into the built bundle.
// See docs/authentication.md for the full token lifecycle.
interface SessionToken {
  token: string;
  expiresAt: number;
}

let cachedToken: SessionToken | null = null;
const TOKEN_EXPIRY_BUFFER_MS = 5_000;

function hasValidCachedToken(): boolean {
  return (
    cachedToken !== null &&
    cachedToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()
  );
}

async function fetchSessionToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/session/`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to start a translation session.");
  }

  const data: unknown = await response.json();
  const token = readStringProperty(data, "access_token");
  const expiresIn = (data as Record<string, unknown> | null)?.["expires_in"];

  if (token === undefined || typeof expiresIn !== "number") {
    throw new Error("Unable to start a translation session.");
  }

  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

async function getSessionToken(): Promise<string> {
  if (hasValidCachedToken()) {
    return (cachedToken as SessionToken).token;
  }

  return fetchSessionToken();
}

/** Drops the in-memory session token, forcing a fresh one on the next request. */
export function clearSessionToken(): void {
  cachedToken = null;
}

function readStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "string" ? candidate : undefined;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isGlossaryTerm(value: unknown): value is GlossaryTerm {
  if (typeof value !== "object" || value === null) return false;

  const term = value as Record<string, unknown>;
  const displayTerms = term.display_terms as Record<string, unknown> | undefined;
  return (
    typeof term.id === "number" &&
    typeof term.term === "string" &&
    typeof term.aleph_beis === "string" &&
    typeof displayTerms?.shabbos === "string" &&
    typeof displayTerms.shabbat === "string" &&
    isStringArray(term.variants) &&
    isStringArray(term.meanings) &&
    typeof term.context_note === "string" &&
    typeof term.category === "string" &&
    typeof term.language_origin === "string" &&
    typeof term.yeshivish_example === "string" &&
    typeof term.plain_english_example === "string"
  );
}

export async function fetchGlossary(): Promise<GlossaryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/glossary/`);
  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error("The glossary response was invalid.");
  }

  if (!response.ok) {
    throw new Error(
      readStringProperty(data, "error") || "Unable to load the glossary.",
    );
  }

  if (typeof data !== "object" || data === null) {
    throw new Error("The glossary response was invalid.");
  }

  const payload = data as Record<string, unknown>;
  if (
    typeof payload.count !== "number" ||
    !Array.isArray(payload.results) ||
    !payload.results.every(isGlossaryTerm) ||
    payload.count !== payload.results.length
  ) {
    throw new Error("The glossary response was invalid.");
  }

  return { count: payload.count, results: payload.results };
}

function requestTranslation(
  text: string,
  direction: TranslationDirection,
  pronunciationPreference: PronunciationPreference,
  token: string,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/translate/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text,
      direction,
      pronunciation_preference: pronunciationPreference,
    }),
  });
}

export async function translateText(
  text: string,
  direction: TranslationDirection = "yeshivish_to_english",
  pronunciationPreference: PronunciationPreference = "shabbos",
): Promise<string> {
  let token = await getSessionToken();
  let response = await requestTranslation(
    text,
    direction,
    pronunciationPreference,
    token,
  );

  if (response.status === 401) {
    // The cached token expired or was rejected; refresh once and retry.
    clearSessionToken();
    token = await getSessionToken();
    response = await requestTranslation(
      text,
      direction,
      pronunciationPreference,
      token,
    );
  }

  let data: unknown = {};
  try {
    data = await response.json();
  } catch {
    // Keep the fallback errors below when the response is not JSON.
  }

  if (!response.ok) {
    throw new Error(
      readStringProperty(data, "error") || "Translation request failed.",
    );
  }

  const translation = readStringProperty(data, "translation");
  if (translation === undefined) {
    throw new Error("The translation response was invalid.");
  }

  return translation;
}
