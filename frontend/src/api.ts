export const TRANSLATION_DIRECTIONS = [
  "yeshivish_to_english",
  "english_to_yeshivish",
] as const;

export type TranslationDirection = (typeof TRANSLATION_DIRECTIONS)[number];

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

function readStringProperty(value: unknown, property: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "string" ? candidate : undefined;
}

export async function translateText(
  text: string,
  direction: TranslationDirection = "yeshivish_to_english",
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/translate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, direction }),
  });

  let data: unknown = {};
  try {
    data = await response.json();
  } catch {
    // Keep the fallback errors below when the response is not JSON.
  }

  if (!response.ok) {
    throw new Error(readStringProperty(data, "error") || "Translation request failed.");
  }

  const translation = readStringProperty(data, "translation");
  if (translation === undefined) {
    throw new Error("The translation response was invalid.");
  }

  return translation;
}
