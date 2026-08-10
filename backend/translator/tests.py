import re
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from .glossary import (
    MAX_GLOSSARY_MATCHES,
    find_glossary_entries,
    format_glossary_context,
    load_glossary,
)
from .prompt import TRANSLATOR_INSTRUCTIONS, build_translation_instructions


def glossary_entry(term, variants=None):
    return {
        "term": term,
        "variants": variants or [],
        "meanings": [f"meaning of {term}"],
        "context_note": f"context for {term}",
    }


class GlossaryMatchingTests(SimpleTestCase):
    def test_seed_glossary_is_valid(self):
        self.assertGreater(len(load_glossary()), 0)

    def test_seed_glossary_has_no_source_artifacts(self):
        source_pattern = re.compile(
            r"https?://|\[[^\]]+\]\(https?://|\(?\[[^\]]+\]\[\d+\]\)?"
        )

        for entry in load_glossary():
            self.assertNotRegex(entry["context_note"], source_pattern)

    def test_seed_glossary_aliases_are_unique(self):
        alias_owners = {}

        for entry in load_glossary():
            for alias in [entry["term"], *entry["variants"]]:
                normalized_alias = alias.casefold().strip()
                self.assertNotIn(
                    normalized_alias,
                    alias_owners,
                    msg=(
                        f'Alias "{alias}" is shared by "{alias_owners.get(normalized_alias)}" '
                        f'and "{entry["term"]}".'
                    ),
                )
                alias_owners[normalized_alias] = entry["term"]

    def test_matches_canonical_term_and_variant_case_insensitively(self):
        canonical_matches = find_glossary_entries("That was MAMESH wonderful.")
        variant_matches = find_glossary_entries("That was mamash wonderful.")

        self.assertEqual([entry["term"] for entry in canonical_matches], ["mamesh"])
        self.assertEqual([entry["term"] for entry in variant_matches], ["mamesh"])

    def test_matches_multiword_phrase_across_whitespace(self):
        matches = find_glossary_entries("Baruch\nHashem, everyone is well.")

        self.assertEqual([entry["term"] for entry in matches], ["baruch Hashem"])

    def test_does_not_match_inside_larger_word(self):
        matches = find_glossary_entries("The vortex moved quickly.")

        self.assertNotIn("vort", [entry["term"] for entry in matches])

    def test_returns_repeated_entry_only_once(self):
        matches = find_glossary_entries("Mamesh, this is mamesh good.")

        self.assertEqual([entry["term"] for entry in matches], ["mamesh"])

    def test_prefers_longer_overlapping_phrase(self):
        entries = [glossary_entry("vort"), glossary_entry("geshmake vort")]

        matches = find_glossary_entries("That was a geshmake vort.", entries=entries)

        self.assertEqual([entry["term"] for entry in matches], ["geshmake vort"])

    def test_caps_number_of_matches(self):
        entries = [glossary_entry(f"term{index}") for index in range(12)]
        text = " ".join(entry["term"] for entry in entries)

        matches = find_glossary_entries(text, entries=entries)

        self.assertEqual(len(matches), MAX_GLOSSARY_MATCHES)

    def test_formats_compact_context(self):
        context = format_glossary_context([glossary_entry("vort", ["vertel"])])

        self.assertIn("- vort (variants: vertel): meaning of vort.", context)


class TranslationPromptTests(SimpleTestCase):
    def test_returns_base_instructions_when_no_terms_match(self):
        self.assertEqual(
            build_translation_instructions("This is an ordinary sentence."),
            TRANSLATOR_INSTRUCTIONS,
        )

    def test_includes_only_relevant_glossary_entries(self):
        instructions = build_translation_instructions("A geshmake vort.")

        self.assertIn("- gishmak", instructions)
        self.assertIn("- vort", instructions)
        self.assertNotIn("- bubbe", instructions)


class TranslationEndpointTests(SimpleTestCase):
    @patch("translator.views.get_openai_client")
    def test_sends_matched_glossary_context_to_openai(self, get_client):
        create = Mock(return_value=SimpleNamespace(output_text="Really good."))
        get_client.return_value.responses.create = create

        response = self.client.post(
            "/api/translate/",
            {"text": "That was mamesh good."},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"translation": "Really good."})
        instructions = create.call_args.kwargs["instructions"]
        self.assertIn("- mamesh", instructions)
        self.assertNotIn("- bubbe", instructions)
