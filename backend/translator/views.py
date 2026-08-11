import logging
import os
from functools import lru_cache
from typing import Any, cast

from openai import OpenAI
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from .authentication import (
    SessionTokenAuthentication,
    issue_session_token,
    revoke_session_token,
)
from .glossary import TranslationDirection
from .prompt import build_translation_instructions
from .throttling import SessionIssueRateThrottle, TranslateRateThrottle

logger = logging.getLogger(__name__)

MAX_INPUT_CHARACTERS = 3000
DEFAULT_DIRECTION: TranslationDirection = "yeshivish_to_english"
SUPPORTED_DIRECTIONS: set[TranslationDirection] = {
    DEFAULT_DIRECTION,
    "english_to_yeshivish",
}


@lru_cache(maxsize=1)
def get_openai_client() -> OpenAI:
    return OpenAI()


@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([IsAuthenticated])
@throttle_classes([TranslateRateThrottle])
def translate(request: Request) -> Response:
    text = request.data.get("text")
    direction = request.data.get("direction", DEFAULT_DIRECTION)

    if not isinstance(direction, str) or direction not in SUPPORTED_DIRECTIONS:
        return Response(
            {
                "error": (
                    "The direction field must be one of: "
                    "yeshivish_to_english, english_to_yeshivish."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not isinstance(text, str):
        return Response(
            {"error": "The text field must be a string."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not text.strip():
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
        api_response = get_openai_client().responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            instructions=build_translation_instructions(text, direction=direction),
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
def health(request: Request) -> Response:
    return Response({"status": "ok"})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([SessionIssueRateThrottle])
def issue_session(request: Request) -> Response:
    token, expires_in = issue_session_token()
    return Response(
        {"access_token": token, "token_type": "Bearer", "expires_in": expires_in}
    )


@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([IsAuthenticated])
def revoke_session(request: Request) -> Response:
    revoke_session_token(cast("dict[str, Any]", request.auth))
    return Response(status=status.HTTP_204_NO_CONTENT)
