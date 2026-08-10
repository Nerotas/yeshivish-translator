import re
from os import environ
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import SimpleTestCase
from rest_framework.throttling import AnonRateThrottle

from .glossary import (
    MAX_GLOSSARY_MATCHES,
    _validate_entry,
    find_glossary_entries,
    format_glossary_context,
    load_glossary,
)
from .prompt import (
    ENGLISH_TO_YESHIVISH_INSTRUCTIONS,
    TRANSLATOR_INSTRUCTIONS,
    build_translation_instructions,
)
from .views import MAX_INPUT_CHARACTERS, get_openai_client, translate


class OneRequestAnonRateThrottle(AnonRateThrottle):
    rate = "1/hour"


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
                        f'Alias "{alias}" is shared by '
                        f'"{alias_owners.get(normalized_alias)}" '
                        f'and "{entry["term"]}".'
                    ),
                )
                alias_owners[normalized_alias] = entry["term"]

    def test_nosh_entry_uses_runtime_schema(self):
        nosh = next(entry for entry in load_glossary() if entry["term"] == "nosh")

        self.assertIn("a snack or tasty bite to eat", nosh["meanings"])
        self.assertIn("both a verb and a noun", nosh["context_note"])

    def test_rejects_each_invalid_glossary_shape(self):
        invalid_entries = (
            ({"term": "missing fields"}, "required fields"),
            (glossary_entry(" "), "non-empty string"),
            ({**glossary_entry("term"), "variants": "variant"}, "list of strings"),
            ({**glossary_entry("term"), "meanings": []}, "at least one meaning"),
            ({**glossary_entry("term"), "context_note": " "}, "non-empty string"),
        )

        for entry, message in invalid_entries:
            with self.subTest(entry=entry):
                with self.assertRaisesRegex(ValueError, message):
                    _validate_entry(entry)

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

    def test_nonpositive_limit_returns_no_matches(self):
        self.assertEqual(find_glossary_entries("mamesh", limit=0), [])

    def test_rejects_unknown_matching_direction(self):
        with self.assertRaisesRegex(ValueError, "Unsupported translation direction"):
            find_glossary_entries("hello", direction="sideways")

    def test_matches_english_meanings_for_reverse_translation(self):
        matches = find_glossary_entries(
            "That was a very enjoyable lesson.",
            direction="english_to_yeshivish",
        )

        self.assertEqual(
            [entry["term"] for entry in matches],
            ["gishmak", "shiur"],
        )

    def test_reverse_matching_does_not_include_unrelated_entries(self):
        matches = find_glossary_entries(
            "That lesson was enjoyable.",
            direction="english_to_yeshivish",
        )

        self.assertNotIn("bubbe", [entry["term"] for entry in matches])

    def test_reverse_matching_finds_nosh_for_snack(self):
        matches = find_glossary_entries(
            "Let's have a snack before we leave.",
            direction="english_to_yeshivish",
        )

        self.assertIn("nosh", [entry["term"] for entry in matches])

    def test_formats_compact_context(self):
        context = format_glossary_context([glossary_entry("vort", ["vertel"])])

        self.assertIn("- vort (variants: vertel): meaning of vort.", context)

    def test_rejects_unknown_context_direction(self):
        with self.assertRaisesRegex(ValueError, "Unsupported translation direction"):
            format_glossary_context([glossary_entry("vort")], direction="sideways")


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

    def test_reverse_prompt_includes_only_relevant_glossary_entries(self):
        instructions = build_translation_instructions(
            "That was an enjoyable lesson.",
            direction="english_to_yeshivish",
        )

        self.assertIn(ENGLISH_TO_YESHIVISH_INSTRUCTIONS.strip(), instructions)
        self.assertIn('Yeshivish "gishmak"', instructions)
        self.assertIn('Yeshivish "shiur"', instructions)
        self.assertNotIn('Yeshivish "bubbe"', instructions)

    def test_reverse_prompt_without_matches_uses_only_base_instructions(self):
        self.assertEqual(
            build_translation_instructions(
                "ZXQV 12345",
                direction="english_to_yeshivish",
            ),
            ENGLISH_TO_YESHIVISH_INSTRUCTIONS,
        )

    def test_reverse_prompt_requests_maximal_entertaining_yeshivish(self):
        instructions = build_translation_instructions(
            "This was an ordinary afternoon.",
            direction="english_to_yeshivish",
        )

        self.assertIn("make it as Yeshivish as possible", instructions)
        self.assertIn("Take stylistic liberties", instructions)
        self.assertIn("primarily for entertainment", instructions)
        self.assertIn("Return only the translation", instructions)

    def test_both_prompts_forbid_citations_and_explanations(self):
        for direction in ("yeshivish_to_english", "english_to_yeshivish"):
            instructions = build_translation_instructions("Hello", direction=direction)

            self.assertIn("Do not add citations", instructions)
            self.assertIn("explanations", instructions)


class TranslationEndpointTests(SimpleTestCase):
    @patch("translator.views.OpenAI")
    def test_openai_client_is_created_once_and_cached(self, openai):
        client = object()
        openai.return_value = client
        get_openai_client.cache_clear()

        try:
            self.assertIs(get_openai_client(), client)
            self.assertIs(get_openai_client(), client)
            openai.assert_called_once_with()
        finally:
            get_openai_client.cache_clear()

    def test_health_endpoint(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_rejects_get_requests(self):
        response = self.client.get("/api/translate/")

        self.assertEqual(response.status_code, 405)

    def test_rejects_missing_text(self):
        response = self.client.post(
            "/api/translate/",
            {},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "The text field must be a string."})

    def test_rejects_non_string_text(self):
        response = self.client.post(
            "/api/translate/",
            {"text": 123},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_rejects_blank_text(self):
        response = self.client.post(
            "/api/translate/",
            {"text": " \n\t "},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "Enter text to translate."})

    def test_rejects_oversized_text(self):
        response = self.client.post(
            "/api/translate/",
            {"text": "x" * (MAX_INPUT_CHARACTERS + 1)},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(str(MAX_INPUT_CHARACTERS), response.json()["error"])

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

    @patch("translator.views.get_openai_client")
    def test_defaults_to_yeshivish_to_english_when_direction_is_omitted(
        self, get_client
    ):
        create = Mock(return_value=SimpleNamespace(output_text="Really good."))
        get_client.return_value.responses.create = create

        response = self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(
            "Yeshivish-to-plain-English translator",
            create.call_args.kwargs["instructions"],
        )

    @patch("translator.views.get_openai_client")
    def test_sends_reverse_direction_prompt_to_openai(self, get_client):
        create = Mock(
            return_value=SimpleNamespace(output_text="That was a very geshmake shiur.")
        )
        get_client.return_value.responses.create = create

        response = self.client.post(
            "/api/translate/",
            {
                "text": "That was a very enjoyable lesson.",
                "direction": "english_to_yeshivish",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"translation": "That was a very geshmake shiur."},
        )
        instructions = create.call_args.kwargs["instructions"]
        self.assertIn("plain-English-to-Yeshivish creative rewriter", instructions)
        self.assertIn('Yeshivish "gishmak"', instructions)
        self.assertIn('Yeshivish "shiur"', instructions)

    @patch("translator.views.get_openai_client")
    def test_preserves_source_formatting_sent_to_openai(self, get_client):
        create = Mock(
            return_value=SimpleNamespace(output_text='  "Reuven said hello."  ')
        )
        get_client.return_value.responses.create = create
        source = '  Reuven said:\n\n"Hello."  '

        response = self.client.post(
            "/api/translate/",
            {"text": source, "direction": "english_to_yeshivish"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(create.call_args.kwargs["input"], source)

    @patch("translator.views.get_openai_client")
    def test_sends_complete_request_contract_to_openai(self, get_client):
        create = Mock(return_value=SimpleNamespace(output_text="Translated."))
        get_client.return_value.responses.create = create

        with patch.dict(environ, {"OPENAI_MODEL": "test-model"}):
            response = self.client.post(
                "/api/translate/",
                {"text": "Mamesh good."},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        create.assert_called_once()
        request = create.call_args.kwargs
        self.assertEqual(request["model"], "test-model")
        self.assertEqual(request["input"], "Mamesh good.")
        self.assertEqual(request["max_output_tokens"], 500)
        self.assertIn("Yeshivish-to-plain-English translator", request["instructions"])

    @patch("translator.views.get_openai_client")
    def test_strips_only_outer_whitespace_from_model_output(self, get_client):
        get_client.return_value.responses.create.return_value = SimpleNamespace(
            output_text="  First paragraph.\n\nSecond paragraph.  "
        )

        response = self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
        )

        self.assertEqual(
            response.json(),
            {"translation": "First paragraph.\n\nSecond paragraph."},
        )

    @patch("translator.views.get_openai_client")
    def test_rejects_invalid_direction_without_calling_openai(self, get_client):
        response = self.client.post(
            "/api/translate/",
            {"text": "Hello", "direction": "sideways"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("direction", response.json()["error"])
        get_client.assert_not_called()

    def test_rejects_non_string_direction(self):
        response = self.client.post(
            "/api/translate/",
            {"text": "Hello", "direction": ["english_to_yeshivish"]},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    @patch("translator.views.get_openai_client")
    def test_returns_bad_gateway_for_openai_error(self, get_client):
        get_client.return_value.responses.create.side_effect = RuntimeError("offline")

        response = self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            response.json(),
            {"error": "Translation is temporarily unavailable."},
        )

    @patch("translator.views.get_openai_client")
    def test_returns_bad_gateway_for_empty_openai_translation(self, get_client):
        get_client.return_value.responses.create.return_value = SimpleNamespace(
            output_text="  "
        )

        response = self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 502)

    @patch("translator.views.get_openai_client")
    def test_throttles_repeated_anonymous_requests(self, get_client):
        cache.clear()
        get_client.return_value.responses.create.return_value = SimpleNamespace(
            output_text="Translated."
        )
        payload = {"text": "Mamesh good."}

        with patch.object(
            translate.cls, "throttle_classes", [OneRequestAnonRateThrottle]
        ):
            first = self.client.post(
                "/api/translate/", payload, content_type="application/json"
            )
            second = self.client.post(
                "/api/translate/", payload, content_type="application/json"
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        cache.clear()
