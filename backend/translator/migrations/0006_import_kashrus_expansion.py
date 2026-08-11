import json
from pathlib import Path

from django.db import migrations


EXPANSION_PATH = (
    Path(__file__).resolve().parent.parent
    / "yeshivish_glossary_kashrus_expansion.json"
)
MODEL_FIELDS = (
    "aleph_beis",
    "dialect_pattern",
    "variants",
    "meanings",
    "context_note",
    "category",
    "language_origin",
    "yeshivish_example",
    "plain_english_example",
    "confidence",
    "needs_human_review",
)


def _remove_variant(glossary_model, term, variant_to_remove):
    glossary_term = glossary_model.objects.get(term=term)
    glossary_term.variants = [
        variant
        for variant in glossary_term.variants
        if variant.casefold().strip() != variant_to_remove
    ]
    glossary_term.save(update_fields=["variants"])


def import_expansion(apps, schema_editor):
    GlossaryTerm = apps.get_model("translator", "GlossaryTerm")
    with EXPANSION_PATH.open(encoding="utf-8") as expansion_file:
        expansion = json.load(expansion_file)

    entries = expansion["entries"]
    if expansion["entry_count"] != len(entries):
        raise RuntimeError("Expansion metadata does not match the entry collection.")

    _remove_variant(GlossaryTerm, "kosher", "kasher")
    _remove_variant(GlossaryTerm, "bishul", "bishul akum")

    for entry in entries:
        GlossaryTerm.objects.update_or_create(
            term=entry["term"],
            defaults={field: entry[field] for field in MODEL_FIELDS if field in entry},
        )


class Migration(migrations.Migration):
    dependencies = [("translator", "0005_import_gemara_shabbos_expansion")]

    operations = [
        migrations.RunPython(import_expansion, migrations.RunPython.noop),
    ]
