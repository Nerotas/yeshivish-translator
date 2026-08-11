from typing import cast

from rest_framework import serializers

from .glossary import GlossaryEntry, get_display_term
from .models import GlossaryTerm


class GlossaryTermSerializer(serializers.ModelSerializer[GlossaryTerm]):
    display_terms = serializers.SerializerMethodField()

    class Meta:
        model = GlossaryTerm
        fields = (
            "id",
            "term",
            "display_terms",
            "variants",
            "meanings",
            "context_note",
            "category",
            "language_origin",
            "yeshivish_example",
            "plain_english_example",
        )

    def get_display_terms(self, term: GlossaryTerm) -> dict[str, str]:
        entry = cast(GlossaryEntry, term.as_glossary_entry())
        return {
            "shabbos": get_display_term(entry, "shabbos"),
            "shabbat": get_display_term(entry, "shabbat"),
        }
