import PageMetadata from "./PageMetadata";
import { createAboutMetadata } from "./page-metadata";

const ABOUT_METADATA = createAboutMetadata();

export default function AboutPage() {
  return (
    <>
      <PageMetadata metadata={ABOUT_METADATA} />
      <article className="about-page">
        <p className="eyebrow">About the project</p>
        <h1>Yeshivish Translator</h1>

        <section>
          <h2>Why I built it</h2>
          <p>
            I am a convert to Judaism, so I did not grow up knowing all of the
            Hebrew, Yiddish, Aramaic, and Yeshivish terminology that can become
            second nature when you have been around it your whole life. I am
            also dyslexic, which can make unfamiliar terms and spellings
            especially difficult to learn and remember.
          </p>
          <blockquote className="about-quote">
            &ldquo;I have no idea what that means.&rdquo;
          </blockquote>
          <p>
            I knew I could not be the only person who occasionally had that
            thought while becoming more observant or spending more time in
            Jewish communities. When I face a challenge, I look for tools that
            can help. When I could not find one that met this need, I started
            making one.
          </p>
        </section>

        <section>
          <h2>What it does</h2>
          <p>
            Yeshivish Translator includes a searchable glossary and can use AI
            to translate Yeshivish and Jewish terminology into plain English.
            It can also translate English into an expressive Yeshivish style,
            although that direction is mostly there for fun. The goal is to
            make unfamiliar language more approachable while treating the
            people, culture, and religious life behind it with care.
          </p>
        </section>

        <section>
          <h2>How the project grew</h2>
          <p>
            I began by researching and cataloguing terminology for a personal
            tool. That work eventually became a larger public software project
            with a React and TypeScript frontend, a Python and Django backend,
            OpenAI integration, API authentication and abuse controls,
            automated testing, continuous integration, and the infrastructure
            needed to keep the application running.
          </p>
        </section>

        <section>
          <h2>Glossary methodology</h2>
          <p>
            The glossary is maintained as structured, version-controlled data.
            Entries may include alternate spellings, definitions, language
            origins, usage context, Hebrew lettering, and parallel examples.
            Alternate spellings are matched carefully so distinct terms do not
            become interchangeable by accident.
          </p>
        </section>

        <section>
          <h2>Translation limitations</h2>
          <p>
            Translations are generated automatically and can misunderstand
            ambiguity, specialized learning, humor, or local usage. Results are
            a communication aid, not a substitute for a fluent speaker,
            professional translator, or qualified religious authority.
          </p>
        </section>

        <section>
          <h2>Open source</h2>
          <p>
            The entire project is open source. Its code, glossary history, and
            issue tracker are available on{` `}
            <a href="https://github.com/Nerotas/yeshivish-translator">
              GitHub
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Support the project</h2>
          <p>
            Yeshivish Translator is a free, open-source tool. If you find it
            useful, please consider supporting continued development on{` `}
            <a
              href="https://ko-fi.com/nicholaserotas"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ko-fi
            </a>
            .
          </p>
        </section>
      </article>
    </>
  );
}