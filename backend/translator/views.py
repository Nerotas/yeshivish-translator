import logging
import os

from openai import OpenAI
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .prompt import TRANSLATOR_INSTRUCTIONS

logger = logging.getLogger(__name__)
client = OpenAI()

MAX_INPUT_CHARACTERS = 3000


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def translate(request):
    text = request.data.get("text")

    if not isinstance(text, str):
        return Response(
            {"error": "The text field must be a string."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    text = text.strip()
    if not text:
        return Response(
            {"error": "Enter text to translate."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(text) > MAX_INPUT_CHARACTERS:
        return Response(
            {"error": f"Text is limited to {MAX_INPUT_CHARACTERS} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        api_response = client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            instructions=TRANSLATOR_INSTRUCTIONS,
            input=text,
            max_output_tokens=500,
        )
        translation = (api_response.output_text or "").strip()

        if not translation:
            raise RuntimeError("The model returned an empty translation.")

        return Response({"translation": translation})

    except Exception:
        logger.exception("Translation request failed")
        return Response(
            {"error": "Translation is temporarily unavailable."},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})
