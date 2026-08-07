import { useState } from "react";
import { translateText } from "./api";
import "./App.css";

const EXAMPLE =
  "Mamesh, Bubbe did teshuvah and it was gesmak. " +
  "She was a tzeadekes!";

export default function App() {
  const [text, setText] = useState(EXAMPLE);
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setTranslation("");

    const trimmed = text.trim();
    if (!trimmed) {
      setError("Enter Yeshivish text to translate.");
      return;
    }

    setLoading(true);
    try {
      setTranslation(await translateText(trimmed));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="translator-card">
        <p className="eyebrow">Yeshivish to plain English</p>
        <h1>Translate a sentence</h1>

        <form onSubmit={handleSubmit}>
          <label htmlFor="source-text">Yeshivish text</label>
          <textarea
            id="source-text"
            rows="7"
            maxLength="3000"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Translating..." : "Translate"}
          </button>
        </form>

        <div aria-live="polite" className="result-region">
          {error && <p role="alert" className="error">{error}</p>}
          {translation && (
            <>
              <h2>Plain English</h2>
              <p>{translation}</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
