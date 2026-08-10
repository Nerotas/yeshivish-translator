import json
import re
import unicodedata
from collections.abc import Collection, Sequence
from functools import lru_cache
from pathlib import Path
from typing import Literal, TypedDict, cast


class GlossaryEntry(TypedDict):
    term: str
    variants: list[str]
    meanings: list[str]
    context_note: str


TranslationDirection = Literal["yeshivish_to_english", "english_to_yeshivish"]

GLOSSARY_PATH = Path(__file__).with_name("glossary.json")
MAX_GLOSSARY_MATCHES = 8
ENGLISH_MEANING_SEPARATOR = re.compile(r"\s+(?:or|and)\s+|\s*[/;]\s*")


def _normalize(value: str) -> str:
    return (
        unicodedata.normalize("NFKC", value)
        .casefold()
        .replace("’", "'")
        .replace("‘", "'")
    )


def _validate_entry(entry: object) -> None:
    required_fields = ("term", "variants", "meanings", "context_note")
    if not isinstance(entry, dict) or any(
        field not in entry for field in required_fields
    ):
        raise ValueError("Each glossary entry must contain all required fields.")

    if not isinstance(entry["term"], str) or not entry["term"].strip():
        raise ValueError("Each glossary term must be a non-empty string.")

    for field in ("variants", "meanings"):
        values = entry[field]
        if not isinstance(values, list) or not all(
            isinstance(value, str) and value.strip() for value in values
        ):
            raise ValueError(f"Glossary field {field} must be a list of strings.")

    if not entry["meanings"]:
        raise ValueError("Each glossary entry must contain at least one meaning.")

    if not isinstance(entry["context_note"], str) or not entry["context_note"].strip():
        raise ValueError("Each glossary context note must be a non-empty string.")


@lru_cache(maxsize=1)
def load_glossary() -> tuple[GlossaryEntry, ...]:
    with GLOSSARY_PATH.open(encoding="utf-8") as glossary_file:
        data = json.load(glossary_file)

    entries = data.get("entries")
    if not isinstance(entries, list):
        raise ValueError("The glossary must contain an entries list.")

    for entry in entries:
        _validate_entry(entry)

    return tuple(cast(list[GlossaryEntry], entries))


@lru_cache(maxsize=512)
def _alias_pattern(alias: str) -> re.Pattern[str]:
    normalized_alias = _normalize(alias).strip()
    escaped_alias = re.escape(normalized_alias).replace(r"\ ", r"\s+")
    return re.compile(rf"(?<!\w){escaped_alias}(?!\w)")


def _english_aliases(entry: GlossaryEntry) -> set[str]:
    aliases: list[str] = []

    for meaning in entry["meanings"]:
        aliases.append(meaning)
        aliases.extend(ENGLISH_MEANING_SEPARATOR.split(meaning))

    # Articles describe the glossary definition, but are rarely important to a
    # match (for example, "a Torah class" should match "Torah class").
    return {
        re.sub(r"^(?:a|an|the)\s+", "", alias, flags=re.IGNORECASE).strip(" .?!")
        for alias in aliases
        if alias.strip(" .?!")
    }


def find_glossary_entries(
    text: str,
    entries: Sequence[GlossaryEntry] | None = None,
    limit: int = MAX_GLOSSARY_MATCHES,
    direction: TranslationDirection = "yeshivish_to_english",
) -> list[GlossaryEntry]:
    if limit <= 0:
        return []

    normalized_text = _normalize(text)
    glossary_entries = load_glossary() if entries is None else entries
    candidates: list[tuple[int, int, int, tuple[int, int], GlossaryEntry]] = []

    for entry_index, entry in enumerate(glossary_entries):
        aliases: Collection[str]
        if direction == "yeshivish_to_english":
            aliases = [entry["term"], *entry.get("variants", [])]
        elif direction == "english_to_yeshivish":
            aliases = _english_aliases(entry)
        else:
            raise ValueError(f"Unsupported translation direction: {direction}")

        for alias in aliases:
            for match in _alias_pattern(alias).finditer(normalized_text):
                candidates.append(
                    (
                        -(match.end() - match.start()),
                        match.start(),
                        entry_index,
                        match.span(),
                        entry,
                    )
                )

    candidates.sort(key=lambda candidate: candidate[:3])
    selected: list[tuple[int, GlossaryEntry]] = []
    selected_entry_ids: set[int] = set()
    occupied_spans: list[tuple[int, int]] = []

    for _, start, entry_index, span, entry in candidates:
        if entry_index in selected_entry_ids:
            continue
        if any(span[0] < end and span[1] > begin for begin, end in occupied_spans):
            continue

        selected.append((start, entry))
        selected_entry_ids.add(entry_index)
        occupied_spans.append(span)

        if len(selected) == limit:
            break

    return [entry for _, entry in sorted(selected, key=lambda item: item[0])]


def format_glossary_context(
    entries: Sequence[GlossaryEntry],
    direction: TranslationDirection = "yeshivish_to_english",
) -> str:
    if not entries:
        return ""

    lines = ["Relevant glossary guidance:"]

    if direction == "yeshivish_to_english":
        lines.append(
            "Use these meanings only when supported by the submitted text's context."
        )
    elif direction == "english_to_yeshivish":
        lines.append(
            "Use these context-sensitive choices aggressively whenever they fit; "
            "prefer idiomatic phrasing over literal substitution."
        )
    else:
        raise ValueError(f"Unsupported translation direction: {direction}")

    for entry in entries:
        variants = entry.get("variants", [])
        variant_text = f" (variants: {', '.join(variants)})" if variants else ""
        meanings = "; ".join(entry["meanings"])
        if direction == "yeshivish_to_english":
            mapping = f"{entry['term']}{variant_text}: {meanings}"
        else:
            mapping = (
                f'English "{meanings}" -> Yeshivish "{entry["term"]}"{variant_text}'
            )

        lines.append(f"- {mapping}. Context: {entry['context_note']}")

    return "\n".join(lines)
