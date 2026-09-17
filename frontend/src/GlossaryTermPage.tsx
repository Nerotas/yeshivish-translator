import { Link, useParams } from "react-router-dom";
import GlossaryTermArticle from "./GlossaryTermArticle";
import { findGlossaryEntryBySlug } from "./glossary-routing";
import { usePronunciationPreference } from "./pronunciation-context";
import { useGlossary } from "./useGlossary";

export default function GlossaryTermPage() {
  const { termSlug = "" } = useParams();
  const { preference } = usePronunciationPreference();
  const glossary = useGlossary();

  if (glossary.isLoading) {
    return (
      <div className="page-loader" role="status">
        <span className="page-loader-spinner" aria-hidden="true" />
        <span>Loading glossary term...</span>
      </div>
    );
  }

  if (glossary.isError) {
    return (
      <section className="glossary-term-page">
        <h1>Unable to load glossary term</h1>
        <p role="alert" className="error">
          {glossary.error instanceof Error
            ? glossary.error.message
            : "Unable to load the glossary."}
        </p>
        <Link to="/glossary">Return to the glossary</Link>
      </section>
    );
  }

  const term = findGlossaryEntryBySlug(
    glossary.data?.results ?? [],
    termSlug,
  );

  if (!term) {
    return (
      <section className="glossary-term-page">
        <p className="eyebrow">Yeshivish glossary</p>
        <h1>Glossary term not found</h1>
        <p>No glossary entry exists at this address.</p>
        <Link to="/glossary">Return to the glossary</Link>
      </section>
    );
  }

  return (
    <section className="glossary-term-page">
      <Link className="glossary-back-link" to="/glossary">
        Back to the glossary
      </Link>
      <GlossaryTermArticle
        pronunciationPreference={preference}
        term={term}
      />
    </section>
  );
}