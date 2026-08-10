const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function translateText(text, direction = "yeshivish_to_english") {
  const response = await fetch(`${API_BASE_URL}/api/translate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, direction }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // Keep the fallback error below when the response is not JSON.
  }

  if (!response.ok) {
    throw new Error(data.error || "Translation request failed.");
  }

  return data.translation;
}
