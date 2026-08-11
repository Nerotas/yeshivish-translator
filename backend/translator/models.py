import unicodedata
from typing import Any

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower


def normalize_glossary_alias(value: str) -> str:
    return (
        unicodedata.normalize("NFKC", value)
        .casefold()
        .replace("’", "'")
        .replace("‘", "'")
        .strip()
    )


class GlossaryTerm(models.Model):
    term = models.CharField(max_length=200, unique=True)
    aleph_beis = models.CharField(max_length=200)
    dialect_pattern = models.CharField(max_length=200, blank=True)
    variants = models.JSONField(default=list, blank=True)
    meanings = models.JSONField(default=list)
    context_note = models.TextField()
    category = models.CharField(max_length=120, blank=True)
    language_origin = models.CharField(max_length=80, blank=True)
    yeshivish_example = models.TextField(blank=True)
    plain_english_example = models.TextField(blank=True)
    confidence = models.CharField(max_length=40, blank=True)
    needs_human_review = models.BooleanField(default=False)

    class Meta:
        ordering = (Lower("term"),)

    def __str__(self) -> str:
        return self.term

    def clean(self) -> None:
        super().clean()
        errors: dict[str, list[str]] = {}

        for field_name, value, allow_empty in (
            ("variants", self.variants, True),
            ("meanings", self.meanings, False),
        ):
            if not isinstance(value, list) or not all(
                isinstance(item, str) and item.strip() for item in value
            ):
                errors.setdefault(field_name, []).append(
                    "Enter a list containing only non-empty strings."
                )
            elif not allow_empty and not value:
                errors.setdefault(field_name, []).append(
                    "Enter at least one glossary meaning."
                )

        if not self.term.strip():
            errors.setdefault("term", []).append("Enter a non-empty term.")
        if not self.context_note.strip():
            errors.setdefault("context_note", []).append(
                "Enter a non-empty context note."
            )

        if errors:
            raise ValidationError(errors)

        own_aliases = [self.term, *self.variants]
        normalized_aliases = [normalize_glossary_alias(alias) for alias in own_aliases]
        if len(normalized_aliases) != len(set(normalized_aliases)):
            raise ValidationError(
                {"variants": ["Canonical terms and variants must be unique."]}
            )

        conflicting_aliases: set[str] = set()
        for other in GlossaryTerm.objects.exclude(pk=self.pk).only("term", "variants"):
            other_aliases = {other.term, *other.variants}
            normalized_other_aliases = {
                normalize_glossary_alias(alias) for alias in other_aliases
            }
            conflicting_aliases.update(
                alias
                for alias in own_aliases
                if normalize_glossary_alias(alias) in normalized_other_aliases
            )

        if conflicting_aliases:
            aliases = ", ".join(sorted(conflicting_aliases, key=str.casefold))
            raise ValidationError(
                {"variants": [f"These aliases are already in use: {aliases}."]}
            )

    def as_glossary_entry(self) -> dict[str, Any]:
        entry: dict[str, Any] = {
            "term": self.term,
            "variants": list(self.variants),
            "meanings": list(self.meanings),
            "context_note": self.context_note,
        }
        if self.dialect_pattern:
            entry["dialect_pattern"] = self.dialect_pattern
        return entry
