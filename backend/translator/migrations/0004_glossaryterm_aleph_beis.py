import json
from pathlib import Path

from django.db import migrations, models


GLOSSARY_PATH = Path(__file__).resolve().parent.parent / "glossary.json"


def populate_aleph_beis(apps, schema_editor):
    GlossaryTerm = apps.get_model("translator", "GlossaryTerm")
    with GLOSSARY_PATH.open(encoding="utf-8") as glossary_file:
        entries = json.load(glossary_file)["entries"]

    aleph_beis_by_term = {entry["term"]: entry["aleph_beis"] for entry in entries}
    terms = list(GlossaryTerm.objects.all())
    if len(terms) != len(aleph_beis_by_term):
        raise RuntimeError("Database and glossary snapshot term counts do not match.")

    for term in terms:
        try:
            term.aleph_beis = aleph_beis_by_term[term.term]
        except KeyError as error:
            raise RuntimeError(
                f'No aleph_beis value exists for glossary term "{term.term}".'
            ) from error

    GlossaryTerm.objects.bulk_update(terms, ["aleph_beis"])


class Migration(migrations.Migration):
    dependencies = [("translator", "0003_alter_glossaryterm_options")]

    operations = [
        migrations.AddField(
            model_name="glossaryterm",
            name="aleph_beis",
            field=models.CharField(default="", max_length=200),
            preserve_default=False,
        ),
        migrations.RunPython(populate_aleph_beis, migrations.RunPython.noop),
    ]
