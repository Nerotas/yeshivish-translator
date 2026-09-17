import { Link } from "react-router-dom";
import { createGlossarySlug } from "./glossary-routing";
import type { GlossaryTerm } from "./models/glossary";
import type { PronunciationPreference } from "./models/pronunciation";

interface GlossaryIndexProps {
  pronunciationPreference: PronunciationPreference;
  terms: readonly GlossaryTerm[];
}

interface GlossaryLetterGroup {
  label: string;
  terms: GlossaryTerm[];
}

function getIndexLabel(term: GlossaryTerm): string {
  return createGlossarySlug(term.term).charAt(0).toUpperCase() || "#";
}

function groupTermsByFirstCharacter(
  terms: readonly GlossaryTerm[],
): GlossaryLetterGroup[] {
  const groupedTerms = new Map<string, GlossaryTerm[]>();

  for (const term of terms) {
    const label = getIndexLabel(term);
    const termsForLabel = groupedTerms.get(label) ?? [];
    termsForLabel.push(term);
    groupedTerms.set(label, termsForLabel);
  }

  return [...groupedTerms.entries()]
    .sort(([leftLabel], [rightLabel]) =>
      leftLabel.localeCompare(rightLabel, "en", { numeric: true }),
    )
    .map(([label, groupedEntries]) => ({ label, terms: groupedEntries }));
}

function getGroupId(label: string): string {
  return `glossary-letter-${label === "#" ? "other" : label.toLowerCase()}`;
}

/**
 * Renders every glossary route outside the virtualized DataGrid so crawlers,
 * keyboard users, and assistive technology can discover the complete index.
 */
export default function GlossaryIndex({
  pronunciationPreference,
  terms,
}: GlossaryIndexProps) {
  const letterGroups = groupTermsByFirstCharacter(terms);

  if (letterGroups.length === 0) {
    return null;
  }

  return (
    <section className="glossary-index" aria-labelledby="glossary-index-heading">
      <h2 id="glossary-index-heading">Browse alphabetically</h2>

      <nav className="glossary-alphabet" aria-label="Glossary alphabet">
        {letterGroups.map(({ label }) => (
          <a key={label} href={`#${getGroupId(label)}`}>
            {label}
          </a>
        ))}
      </nav>

      <div className="glossary-index-groups">
        {letterGroups.map(({ label, terms: groupedTerms }) => (
          <section key={label} aria-labelledby={getGroupId(label)}>
            <h3 id={getGroupId(label)}>{label}</h3>
            <ul>
              {groupedTerms.map((term) => (
                <li key={term.id}>
                  <Link to={`/glossary/${createGlossarySlug(term.term)}`}>
                    {term.display_terms[pronunciationPreference]}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}