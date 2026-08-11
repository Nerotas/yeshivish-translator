import { type FormEvent, useLayoutEffect, useState } from "react";
import {
  TRANSLATION_DIRECTIONS,
  translateText,
  type TranslationDirection,
} from "./api";
import {
  PRONUNCIATION_PREFERENCES,
} from "./pronunciation";
import { usePronunciationPreference } from "./pronunciation-context";
import "./App.css";

interface DirectionCopy {
  button: string;
  eyebrow: string;
  inputLabel: string;
  outputLabel: string;
  placeholder: string;
  emptyError: string;
}

type Theme = "light" | "dark";

const THEMES: readonly Theme[] = ["light", "dark"];
const THEME_STORAGE_KEY = "yeshivish-translator-theme";

function getSavedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

const DIRECTIONS: Record<TranslationDirection, DirectionCopy> = {
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
  const { preference, setPreference } = usePronunciationPreference();
  const [theme, setTheme] = useState<Theme>(getSavedTheme);
  const [direction, setDirection] = useState<TranslationDirection>(
    "yeshivish_to_english",
  );
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme still applies for this session if storage is unavailable.
    }
  }, [theme]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTranslation("");

    if (!text.trim()) {
      setError(DIRECTIONS[direction].emptyError);
      return;
    }

    setLoading(true);
    try {
      setTranslation(await translateText(text, direction, preference));
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Translation request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDirectionChange(nextDirection: TranslationDirection) {
    if (nextDirection === direction) return;

    setDirection(nextDirection);
    setTranslation("");
    setError("");
  }

  const copy = DIRECTIONS[direction];

  return (
    <main className="app-shell">
      <section className="translator-card">
        <div className="theme-selector" aria-label="Color theme">
          {THEMES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              {value === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>

        <div
          className="pronunciation-selector"
          aria-label="Pronunciation preference"
        >
          <span>Pronunciation</span>
          <div>
            {PRONUNCIATION_PREFERENCES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={preference === value}
                onClick={() => setPreference(value)}
              >
                {value === "shabbos" ? "Shabbos" : "Shabbat"}
              </button>
            ))}
          </div>
        </div>

        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>Translate a sentence</h1>

        <p className="privacy-notice">
          Submitted text is sent to OpenAI to generate your translation. Avoid
          sharing sensitive, confidential, or personally identifying
          information.{" "}
          <a href="#privacy-details">Learn how your data is handled</a>.
        </p>

        <div className="direction-selector" aria-label="Translation direction">
          {TRANSLATION_DIRECTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={direction === value ? "active" : ""}
              aria-pressed={direction === value}
              onClick={() => handleDirectionChange(value)}
            >
              {DIRECTIONS[value].button}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="source-text">{copy.inputLabel}</label>
          <textarea
            id="source-text"
            rows={7}
            maxLength={3000}
            placeholder={copy.placeholder}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <button type="submit" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            {loading ? "Translating..." : "Translate"}
          </button>
        </form>

        <div aria-live="polite" className="result-region">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {translation && (
            <>
              <h2>{copy.outputLabel}</h2>
              <p className="translation-output">{translation}</p>
            </>
          )}
        </div>

        <section
          id="privacy-details"
          className="privacy-details"
          aria-labelledby="privacy-details-heading"
        >
          <h2 id="privacy-details-heading">How your data is handled</h2>
          <p>
            Text you submit is sent to OpenAI&rsquo;s API only to generate your
            translation and is not stored by this application afterward. No
            online service can guarantee complete privacy or security, so please
            avoid submitting passwords, financial details, medical information,
            or other sensitive or personally identifying information.
          </p>
        </section>
      </section>
    </main>
  );
}
