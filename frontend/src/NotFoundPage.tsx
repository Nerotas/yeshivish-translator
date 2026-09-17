import { Link } from "react-router-dom";
import PageMetadata from "./PageMetadata";
import { createNotFoundMetadata } from "./page-metadata";

const NOT_FOUND_METADATA = createNotFoundMetadata();

export default function NotFoundPage() {
  return (
    <>
      <PageMetadata metadata={NOT_FOUND_METADATA} />
      <section className="not-found-page">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <Link to="/">Return to the translator</Link>
      </section>
    </>
  );
}