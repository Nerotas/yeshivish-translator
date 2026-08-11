"""
Opt-in live translation quality evaluation.

Calls the OpenAI API to assess real model behavior across scoring dimensions:
meaning preservation, playfully loving tone, transliteration/name preservation,
relevant glossary use, formatting preservation, and absence of citations.

AUTHORIZATION REQUIRED
======================
This script consumes OpenAI tokens and must never run in automated tests,
``make check``, or default GitHub Actions workflows.

Run via the dedicated Makefile target:

    make live-eval

Or set the authorization variable manually:

    YESHIVISH_LIVE_EVAL_AUTHORIZED=true python backend/translator/live_evals.py

REVIEWING FAILURES
==================
1. Read the output excerpt for the failing case.
2. If the failure reflects a genuine model regression, investigate changes in
   backend/translator/prompt.py or backend/translator/glossary.json.
3. If the failure reflects an intentional baseline change, update the relevant
   entry in backend/translator/live_eval_cases.json, document the new expected
   behavior in the commit message, and get it reviewed before merging.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Literal, TypedDict, cast

from dotenv import load_dotenv
from openai import OpenAI

# Allow 'from translator.* import ...' when running as a script from the project
# root; mypy resolves this via mypy_path = "backend" in pyproject.toml.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from translator.prompt import build_translation_instructions  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------

AUTHORIZED_ENV_VAR = "YESHIVISH_LIVE_EVAL_AUTHORIZED"

# ---------------------------------------------------------------------------
# Hard budgets — evaluation aborts if any limit is exceeded
# ---------------------------------------------------------------------------

BUDGET_MAX_REQUESTS: int = 10
BUDGET_MAX_INPUT_TOKENS: int = 20_000
BUDGET_MAX_OUTPUT_TOKENS: int = 5_000
BUDGET_MAX_COST_USD: float = 0.10

# gpt-4o-mini pricing per token (mid-2026 rates)
_INPUT_COST_PER_TOKEN: float = 0.15 / 1_000_000
_OUTPUT_COST_PER_TOKEN: float = 0.60 / 1_000_000

# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

_CITATION_PATTERNS = (
    re.compile(r"https?://", re.IGNORECASE),
    re.compile(r"\[(?:source|citation|\d+)[^\]]*\]", re.IGNORECASE),
    re.compile(r"(?:sources?|footnotes?)\s*:", re.IGNORECASE),
)

DEFAULT_CASES_PATH = Path(__file__).with_name("live_eval_cases.json")


def _paragraph_count(text: str) -> int:
    return len(re.split(r"\n\s*\n", text.strip()))


# ---------------------------------------------------------------------------
# Case schema
# ---------------------------------------------------------------------------


class LiveEvalCase(TypedDict):
    id: str
    direction: Literal["yeshivish_to_english", "english_to_yeshivish"]
    source: str
    required_terms: list[str]  # All must appear in translation (case-insensitive)
    forbidden_terms: list[str]  # None may appear in translation (case-insensitive)
    tone_markers: list[str]  # At least one must appear; skip check when empty
    preserve_names: list[str]  # All must appear in translation (case-insensitive)
    preserve_paragraphs: bool
    preserve_quotes: bool
    scoring_note: str  # Human-readable hint for reviewers on failure


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def score_case(case: LiveEvalCase, translation: str) -> dict[str, list[str]]:
    """Return per-dimension failure messages; empty list means PASS."""
    tl = translation.casefold()
    failures: dict[str, list[str]] = {
        "meaning_preservation": [],
        "forbidden_terms": [],
        "no_citations": [],
        "formatting": [],
        "name_preservation": [],
        "tone": [],
    }

    for term in case["required_terms"]:
        if term.casefold() not in tl:
            failures["meaning_preservation"].append(f'missing required term "{term}"')

    for term in case["forbidden_terms"]:
        if term.casefold() in tl:
            failures["forbidden_terms"].append(f'forbidden term "{term}" still present')

    for pat in _CITATION_PATTERNS:
        if pat.search(translation):
            failures["no_citations"].append(
                "contains a citation, source, footnote, or URL"
            )
            break

    if case["preserve_paragraphs"]:
        src_p = _paragraph_count(case["source"])
        out_p = _paragraph_count(translation)
        if src_p != out_p:
            failures["formatting"].append(
                f"paragraph count changed ({src_p} → {out_p})"
            )

    if case["preserve_quotes"]:
        src_q = case["source"].count('"')
        out_q = translation.count('"')
        if src_q != out_q:
            failures["formatting"].append(
                f'quotation mark count changed ({src_q} → {out_q})"'
            )

    for name in case["preserve_names"]:
        if name.casefold() not in tl:
            failures["name_preservation"].append(f'name "{name}" not preserved')

    tone_markers = case["tone_markers"]
    if tone_markers and not any(m.casefold() in tl for m in tone_markers):
        displayed = ", ".join(f'"{m}"' for m in tone_markers[:5])
        failures["tone"].append(
            f"no tone marker found; expected at least one of: {displayed}"
        )

    return failures


# ---------------------------------------------------------------------------
# Case loading
# ---------------------------------------------------------------------------


def load_cases(path: Path = DEFAULT_CASES_PATH) -> list[LiveEvalCase]:
    with path.open(encoding="utf-8") as f:
        data: object = json.load(f)
    if not isinstance(data, list):
        raise ValueError("live_eval_cases.json must be a JSON array.")
    return cast(list[LiveEvalCase], data)


# ---------------------------------------------------------------------------
# Evaluation loop
# ---------------------------------------------------------------------------


def run_live_evals(cases: list[LiveEvalCase]) -> int:
    if len(cases) > BUDGET_MAX_REQUESTS:
        print(
            f"ERROR: {len(cases)} cases exceeds the request budget "
            f"of {BUDGET_MAX_REQUESTS}."
        )
        return 1

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY is not set.")
        return 1

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=api_key)

    sep = "=" * 60
    print(sep)
    print("Live Translation Quality Evaluation")
    print(sep)
    print(f"Model  : {model}")
    print(f"Cases  : {len(cases)}")
    print(
        f"Budget : {BUDGET_MAX_REQUESTS} requests, "
        f"${BUDGET_MAX_COST_USD:.2f} estimated cost"
    )
    print()

    total_input_tokens = 0
    total_output_tokens = 0
    total_requests = 0
    cases_passed = 0
    any_failed = False

    for i, case in enumerate(cases, 1):
        case_id = case["id"]
        source = case["source"]
        direction = case["direction"]

        print(f"[{i}/{len(cases)}] {case_id}  ({direction})")

        instructions = build_translation_instructions(source, direction=direction)

        # Single request per case — no silent retries (policy requirement).
        try:
            response = client.responses.create(
                model=model,
                instructions=instructions,
                input=source,
                max_output_tokens=500,
            )
        except Exception as exc:
            print(f"  REQUEST FAILED: {exc}")
            print("  Not retrying. Confirm the error is transient before re-running.")
            any_failed = True
            print()
            continue

        total_requests += 1

        if response.usage is not None:
            total_input_tokens += response.usage.input_tokens
            total_output_tokens += response.usage.output_tokens

        # Check budgets after every request so we abort before overspending.
        estimated_cost = (
            total_input_tokens * _INPUT_COST_PER_TOKEN
            + total_output_tokens * _OUTPUT_COST_PER_TOKEN
        )
        if total_input_tokens > BUDGET_MAX_INPUT_TOKENS:
            print(
                f"  BUDGET EXCEEDED: {total_input_tokens} input tokens "
                f"> {BUDGET_MAX_INPUT_TOKENS}"
            )
            any_failed = True
            break
        if total_output_tokens > BUDGET_MAX_OUTPUT_TOKENS:
            print(
                f"  BUDGET EXCEEDED: {total_output_tokens} output tokens "
                f"> {BUDGET_MAX_OUTPUT_TOKENS}"
            )
            any_failed = True
            break
        if estimated_cost > BUDGET_MAX_COST_USD:
            print(
                f"  BUDGET EXCEEDED: estimated cost ${estimated_cost:.4f} "
                f"> ${BUDGET_MAX_COST_USD:.2f}"
            )
            any_failed = True
            break

        translation = (response.output_text or "").strip()
        if not translation:
            print("  FAIL: model returned an empty translation")
            any_failed = True
            print()
            continue

        dimension_failures = score_case(case, translation)
        all_failures = [msg for msgs in dimension_failures.values() for msg in msgs]

        if all_failures:
            any_failed = True
            print(f"  FAIL ({len(all_failures)} issue(s)):")
            for dim, msgs in dimension_failures.items():
                for msg in msgs:
                    print(f"    [{dim}] {msg}")
            print(f"  Reviewer hint: {case['scoring_note']}")
        else:
            cases_passed += 1
            print("  PASS")

        excerpt = translation[:120] + ("…" if len(translation) > 120 else "")
        print(f"  Output: {excerpt!r}")
        print()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    final_cost = (
        total_input_tokens * _INPUT_COST_PER_TOKEN
        + total_output_tokens * _OUTPUT_COST_PER_TOKEN
    )

    print(sep)
    print("Summary")
    print(sep)
    print(f"Cases passed  : {cases_passed}/{len(cases)}")
    print(f"Requests made : {total_requests}")
    print(f"Input tokens  : {total_input_tokens:,}")
    print(f"Output tokens : {total_output_tokens:,}")
    print(f"Estimated cost: ${final_cost:.4f} USD")
    print()

    if any_failed:
        print("RESULT: FAIL")
        print()
        print("To review qualitative failures:")
        print(
            "  1. Read the output excerpts above for failing cases and compare"
            " them against the source text and the scoring hint."
        )
        print(
            "  2. If the failure reflects a genuine model regression, investigate"
            " backend/translator/prompt.py and backend/translator/glossary.json."
        )
        print(
            "  3. If the failure reflects an intentional baseline change, update"
            " backend/translator/live_eval_cases.json and include a clear"
            " explanation in the commit message."
        )
        return 1

    print("RESULT: PASS")
    return 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    if os.getenv(AUTHORIZED_ENV_VAR) != "true":
        print(
            f"Live evaluations require explicit authorization.\n"
            f"\n"
            f"Set {AUTHORIZED_ENV_VAR}=true to proceed, or run:\n"
            f"\n"
            f"    make live-eval\n"
            f"\n"
            f"WARNING: live evals consume OpenAI tokens.\n"
            f"Estimated cost per run: up to ${BUDGET_MAX_COST_USD:.2f} USD.\n"
            f"\n"
            f"Never run live evals in automated tests, make check, or CI."
        )
        return 1

    return run_live_evals(load_cases())


if __name__ == "__main__":
    raise SystemExit(main())
