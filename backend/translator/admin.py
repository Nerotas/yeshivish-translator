from django.contrib import admin

from .models import GlossaryTerm


@admin.register(GlossaryTerm)
class GlossaryTermAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "term",
        "category",
        "language_origin",
        "confidence",
        "needs_human_review",
    )
    list_filter = (
        "category",
        "language_origin",
        "confidence",
        "needs_human_review",
    )
    search_fields = (
        "term",
        "variants",
        "meanings",
        "context_note",
        "yeshivish_example",
        "plain_english_example",
    )
