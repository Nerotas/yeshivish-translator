import json
from pathlib import Path

from django.db import migrations


GLOSSARY_PATH = Path(__file__).resolve().parent.parent / "glossary.json"
MODEL_FIELDS = (
    "term",
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


def import_glossary(apps, schema_editor):
    GlossaryTerm = apps.get_model("translator", "GlossaryTerm")
    with GLOSSARY_PATH.open(encoding="utf-8") as glossary_file:
        glossary = json.load(glossary_file)

    entries = glossary["entries"]
    if glossary["entry_count"] != len(entries):
        raise RuntimeError("Glossary metadata does not match the entry collection.")

    terms = [
        GlossaryTerm(
            **{field: entry[field] for field in MODEL_FIELDS if field in entry}
        )
        for entry in entries
    ]
    GlossaryTerm.objects.bulk_create(terms)


def remove_imported_glossary(apps, schema_editor):
    GlossaryTerm = apps.get_model("translator", "GlossaryTerm")
    with GLOSSARY_PATH.open(encoding="utf-8") as glossary_file:
        entries = json.load(glossary_file)["entries"]

    GlossaryTerm.objects.filter(
        term__in=[entry["term"] for entry in entries]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("translator", "0001_initial")]

    operations = [
        migrations.RunPython(import_glossary, remove_imported_glossary),
    ]
