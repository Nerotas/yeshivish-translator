import json
import re
from pathlib import Path
from typing import Literal, TypedDict, cast


class EvalCase(TypedDict):
    id: str
    direction: Literal["yeshivish_to_english", "english_to_yeshivish"]
    source: str
    candidate_translation: str
    required_terms: list[str]
    forbidden_terms: list[str]
    preserve_paragraphs: bool
    preserve_quotes: bool


CITATION_PATTERNS = (
    re.compile(r"https?://", re.IGNORECASE),
    re.compile(r"\[(?:source|citation|\d+)[^\]]*\]", re.IGNORECASE),
    re.compile(r"(?:sources?|footnotes?)\s*:", re.IGNORECASE),
)
DEFAULT_CASES_PATH = Path(__file__).with_name("eval_cases.json")


def _paragraph_count(value: str) -> int:
    return len(re.split(r"\n\s*\n", value.strip()))


def evaluate_translation(case: EvalCase) -> list[str]:
    source = case["source"]
    translation = case["candidate_translation"]
    normalized_translation = translation.casefold()
    failures = []

    if not translation.strip():
        failures.append("translation is empty")

    for term in case["required_terms"]:
        if term.casefold() not in normalized_translation:
            failures.append(f'missing required term: "{term}"')

    for term in case["forbidden_terms"]:
        if term.casefold() in normalized_translation:
            failures.append(f'contains forbidden term: "{term}"')

    if any(pattern.search(translation) for pattern in CITATION_PATTERNS):
        failures.append("contains a citation, source, footnote, or URL")

    if case["preserve_paragraphs"] and _paragraph_count(source) != _paragraph_count(
        translation
    ):
        failures.append("paragraph count changed")

    if case["preserve_quotes"] and source.count('"') != translation.count('"'):
        failures.append("quotation boundaries changed")

    return failures


def load_eval_cases(path: Path = DEFAULT_CASES_PATH) -> list[EvalCase]:
    with path.open(encoding="utf-8") as cases_file:
        data: object = json.load(cases_file)

    if not isinstance(data, list):
        raise ValueError("Translation eval fixtures must be a JSON list.")

    return cast(list[EvalCase], data)


def main() -> int:
    failed = False

    for case in load_eval_cases():
        failures = evaluate_translation(case)
        if failures:
            failed = True
            print(f"FAIL {case['id']}: {'; '.join(failures)}")
        else:
            print(f"PASS {case['id']}")

    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
