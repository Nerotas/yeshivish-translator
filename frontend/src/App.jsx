import { useState } from "react";
import { translateText } from "./api";
import "./App.css";

const DIRECTIONS = {
  yeshivish_to_english: {
    button: "Yeshivish → English",
    eyebrow: "Yeshivish to plain English",
    inputLabel: "Yeshivish text",
    outputLabel: "Plain English",
    placeholder: "Enter Yeshivish text to translate",
    emptyError: "Enter Yeshivish text to translate.",
  },
  english_to_yeshivish: {
    button: "English → Yeshivish",
    eyebrow: "Plain English to Yeshivish",
    inputLabel: "English text",
    outputLabel: "Yeshivish",
    placeholder: "Enter English text to translate",
    emptyError: "Enter English text to translate.",
  },
};

export default function App() {
  const [direction, setDirection] = useState("yeshivish_to_english");
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setTranslation("");

    const trimmed = text.trim();
    if (!trimmed) {
      setError(DIRECTIONS[direction].emptyError);
      return;
    }

    setLoading(true);
    try {
      setTranslation(await translateText(text, direction));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDirectionChange(nextDirection) {
    if (nextDirection === direction) return;

    setDirection(nextDirection);
    setTranslation("");
    setError("");
  }

  const copy = DIRECTIONS[direction];

  return (
    <main className="app-shell">
      <section className="translator-card">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>Translate a sentence</h1>

        <div className="direction-selector" aria-label="Translation direction">
          {Object.entries(DIRECTIONS).map(([value, option]) => (
            <button
              key={value}
              type="button"
              className={direction === value ? "active" : ""}
              aria-pressed={direction === value}
              onClick={() => handleDirectionChange(value)}
            >
              {option.button}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="source-text">{copy.inputLabel}</label>
          <textarea
            id="source-text"
            rows="7"
            maxLength="3000"
            placeholder={copy.placeholder}
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
              <h2>{copy.outputLabel}</h2>
              <p className="translation-output">{translation}</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
