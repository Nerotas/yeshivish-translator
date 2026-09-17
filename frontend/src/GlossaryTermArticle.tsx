import type { GlossaryTerm } from "./models/glossary";
import type { PronunciationPreference } from "./models/pronunciation";

interface GlossaryTermArticleProps {
  pronunciationPreference: PronunciationPreference;
  term: GlossaryTerm;
}

export default function GlossaryTermArticle({
  pronunciationPreference,
  term,
}: GlossaryTermArticleProps) {
  const displayTerm = term.display_terms[pronunciationPreference];

  return (
    <article className="glossary-term-article">
      <header>
        <p className="eyebrow">Yeshivish glossary term</p>
        <h1>{displayTerm}</h1>
        <p className="glossary-term-aleph-beis" dir="rtl">
          {term.aleph_beis}
        </p>
      </header>

      <section aria-labelledby="glossary-term-meanings">
        <h2 id="glossary-term-meanings">Meaning</h2>
        <ul>
          {term.meanings.map((meaning) => (
            <li key={meaning}>{meaning}</li>
          ))}
        </ul>
      </section>

      {term.variants.length > 0 && (
        <section aria-labelledby="glossary-term-variants">
          <h2 id="glossary-term-variants">Alternate spellings</h2>
          <p>{term.variants.join(", ")}</p>
        </section>
      )}

      <section aria-labelledby="glossary-term-context">
        <h2 id="glossary-term-context">Usage and context</h2>
        <p>{term.context_note}</p>
      </section>

      {(term.category || term.language_origin) && (
        <dl className="glossary-term-facts">
          {term.category && (
            <div>
              <dt>Category</dt>
              <dd>{term.category}</dd>
            </div>
          )}
          {term.language_origin && (
            <div>
              <dt>Language origin</dt>
              <dd>{term.language_origin}</dd>
            </div>
          )}
        </dl>
      )}

      {term.yeshivish_example && (
        <section aria-labelledby="glossary-term-yeshivish-example">
          <h2 id="glossary-term-yeshivish-example">Example in Yeshivish</h2>
          <blockquote>{term.yeshivish_example}</blockquote>
        </section>
      )}

      {term.plain_english_example && (
        <section aria-labelledby="glossary-term-english-example">
          <h2 id="glossary-term-english-example">Plain-English example</h2>
          <blockquote>{term.plain_english_example}</blockquote>
        </section>
      )}
    </article>
  );
}