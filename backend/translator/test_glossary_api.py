from django.contrib import admin
from django.core.exceptions import ValidationError
from django.test import TestCase

from .glossary import load_glossary
from .models import GlossaryTerm


class GlossaryModelTests(TestCase):
    def test_migration_imports_complete_runtime_glossary(self):
        self.assertEqual(GlossaryTerm.objects.count(), 596)
        self.assertEqual(GlossaryTerm.objects.exclude(aleph_beis="").count(), 596)
        self.assertEqual(len(load_glossary()), 596)

    def test_rov_is_distinct_from_rav(self):
        rav = GlossaryTerm.objects.get(term="rav")
        rov = GlossaryTerm.objects.get(term="rov")

        self.assertNotIn("rov", [variant.casefold() for variant in rav.variants])
        self.assertIn("majority", rov.meanings)

    def test_kashrus_expansion_terms_are_distinct_from_existing_aliases(self):
        kosher = GlossaryTerm.objects.get(term="kosher")
        bishul = GlossaryTerm.objects.get(term="bishul")

        self.assertNotIn("kasher", [variant.casefold() for variant in kosher.variants])
        self.assertNotIn(
            "bishul akum", [variant.casefold() for variant in bishul.variants]
        )
        self.assertTrue(GlossaryTerm.objects.filter(term="kasher").exists())
        self.assertTrue(GlossaryTerm.objects.filter(term="bishul akum").exists())

    def test_calendar_synonyms_remain_distinct_without_alias_collision(self):
        three_weeks = GlossaryTerm.objects.get(term="the Three Weeks")
        bein_hametzarim = GlossaryTerm.objects.get(term="Bein Hametzarim")

        self.assertEqual(three_weeks.variants, ["Three Weeks"])
        self.assertNotIn(
            "bein hametzarim",
            [variant.casefold() for variant in three_weeks.variants],
        )
        self.assertEqual(bein_hametzarim.variants, [])

    def test_lifecycle_variants_are_unique(self):
        chuppah = GlossaryTerm.objects.get(term="chuppah")

        self.assertEqual(chuppah.variants, ["chupah", "huppah"])

    def test_rejects_invalid_array_fields(self):
        term = GlossaryTerm(
            term="test term",
            aleph_beis="טעסט",
            variants="not a list",
            meanings=[],
            context_note="Context.",
        )

        with self.assertRaises(ValidationError) as raised:
            term.full_clean()

        self.assertIn("variants", raised.exception.message_dict)
        self.assertIn("meanings", raised.exception.message_dict)

    def test_rejects_alias_collision_across_entries(self):
        term = GlossaryTerm(
            term="new canonical term",
            aleph_beis="נײַ",
            variants=["mamash"],
            meanings=["test meaning"],
            context_note="Test context.",
        )

        with self.assertRaises(ValidationError) as raised:
            term.full_clean()

        self.assertIn("mamash", " ".join(raised.exception.messages))

    def test_saving_a_term_immediately_updates_runtime_entries(self):
        original = next(entry for entry in load_glossary() if entry["term"] == "nosh")
        term = GlossaryTerm.objects.get(term="nosh")
        term.context_note = "Updated through Django Admin."
        term.save()

        updated = next(entry for entry in load_glossary() if entry["term"] == "nosh")

        self.assertNotEqual(original["context_note"], updated["context_note"])
        self.assertEqual(updated["context_note"], "Updated through Django Admin.")

    def test_glossary_term_is_registered_in_admin(self):
        self.assertIn(GlossaryTerm, admin.site._registry)


class GlossaryApiTests(TestCase):
    def test_returns_every_term_in_one_alphabetical_collection(self):
        response = self.client.get("/api/glossary/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 596)
        self.assertEqual(len(payload["results"]), 596)
        terms = [entry["term"] for entry in payload["results"]]
        self.assertEqual(terms, sorted(terms, key=str.casefold))

    def test_returns_public_runtime_fields_and_resolved_pronunciations(self):
        response = self.client.get("/api/glossary/")

        shabbos = next(
            entry for entry in response.json()["results"] if entry["term"] == "Shabbos"
        )
        self.assertEqual(
            shabbos["display_terms"],
            {"shabbos": "Shabbos", "shabbat": "Shabbat"},
        )
        self.assertIn("Shabbat", shabbos["variants"])
        self.assertEqual(shabbos["aleph_beis"], "שבת")
        self.assertIsInstance(shabbos["meanings"], list)
        self.assertIn("context_note", shabbos)
        self.assertNotIn("dialect_pattern", shabbos)
        self.assertNotIn("confidence", shabbos)
        self.assertNotIn("needs_human_review", shabbos)

        kashrus = next(
            entry for entry in response.json()["results"] if entry["term"] == "kashrus"
        )
        self.assertEqual(
            kashrus["display_terms"],
            {"shabbos": "kashrus", "shabbat": "kashrut"},
        )

        sukkos = next(
            entry for entry in response.json()["results"] if entry["term"] == "Sukkos"
        )
        self.assertEqual(
            sukkos["display_terms"],
            {"shabbos": "Sukkos", "shabbat": "Sukkot"},
        )

    def test_is_public_read_only_and_rejects_post(self):
        get_response = self.client.get("/api/glossary/")
        post_response = self.client.post(
            "/api/glossary/", {}, content_type="application/json"
        )

        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(post_response.status_code, 405)
