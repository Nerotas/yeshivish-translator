import json
from pathlib import Path

from django.db import migrations


EXPANSION_PATH = (
    Path(__file__).resolve().parent.parent
    / "yeshivish_glossary_yom_tov_calendar_expansion.json"
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


def import_expansion(apps, schema_editor):
    GlossaryTerm = apps.get_model("translator", "GlossaryTerm")
    with EXPANSION_PATH.open(encoding="utf-8") as expansion_file:
        expansion = json.load(expansion_file)

    entries = expansion["entries"]
    if expansion["entry_count"] != len(entries):
        raise RuntimeError("Expansion metadata does not match the entry collection.")

    for entry in entries:
        GlossaryTerm.objects.update_or_create(
            term=entry["term"],
            defaults={field: entry[field] for field in MODEL_FIELDS if field in entry},
        )


class Migration(migrations.Migration):
    dependencies = [("translator", "0006_import_kashrus_expansion")]

    operations = [
        migrations.RunPython(import_expansion, migrations.RunPython.noop),
    ]
