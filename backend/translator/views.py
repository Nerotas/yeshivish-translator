import logging
import os
import time
from functools import lru_cache
from typing import Any, cast

import httpx
import openai
from django.conf import settings
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

from . import guardrails
from .authentication import (
    SessionTokenAuthentication,
    issue_session_token,
    revoke_session_token,
)
from .glossary import PronunciationPreference, TranslationDirection
from .prompt import build_translation_instructions
from .throttling import (
    SessionIssueGlobalRateThrottle,
    SessionIssueRateThrottle,
    TranslateGlobalRateThrottle,
    TranslateRateThrottle,
    TranslateSessionRateThrottle,
)

logger = logging.getLogger(__name__)

MAX_INPUT_CHARACTERS = 3000
DEFAULT_DIRECTION: TranslationDirection = "yeshivish_to_english"
SUPPORTED_DIRECTIONS: set[TranslationDirection] = {
    DEFAULT_DIRECTION,
    "english_to_yeshivish",
}
DEFAULT_PRONUNCIATION_PREFERENCE: PronunciationPreference = "shabbos"
SUPPORTED_PRONUNCIATION_PREFERENCES: set[PronunciationPreference] = {
    DEFAULT_PRONUNCIATION_PREFERENCE,
    "shabbat",
}


def _classify_openai_error(error: Exception) -> str:
    """A short, log-friendly label for the kind of upstream failure."""
    if isinstance(error, openai.APITimeoutError):
        return "timeout"
    if isinstance(error, openai.APIConnectionError):
        return "connection_error"
    if isinstance(error, openai.RateLimitError):
        return "rate_limited"
    return "error"


@lru_cache(maxsize=1)
def get_openai_client() -> OpenAI:
    return OpenAI(
        timeout=httpx.Timeout(
            connect=settings.OPENAI_CONNECT_TIMEOUT_SECONDS,
            read=settings.OPENAI_READ_TIMEOUT_SECONDS,
            write=settings.OPENAI_READ_TIMEOUT_SECONDS,
            pool=settings.OPENAI_CONNECT_TIMEOUT_SECONDS,
        ),
        max_retries=settings.OPENAI_MAX_RETRIES,
    )


@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([IsAuthenticated])
@throttle_classes(
    [TranslateRateThrottle, TranslateSessionRateThrottle, TranslateGlobalRateThrottle]
)
def translate(request: Request) -> Response:
    text = request.data.get("text")
    direction = request.data.get("direction", DEFAULT_DIRECTION)
    pronunciation_preference = request.data.get(
        "pronunciation_preference", DEFAULT_PRONUNCIATION_PREFERENCE
    )

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

    if (
        not isinstance(pronunciation_preference, str)
        or pronunciation_preference not in SUPPORTED_PRONUNCIATION_PREFERENCES
    ):
        return Response(
            {
                "error": (
                    "The pronunciation_preference field must be one of: "
                    "shabbos, shabbat."
                )
            },
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

    if guardrails.budget_exceeded():
        return Response(
            {"error": "Translation is temporarily unavailable."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    started_at = time.monotonic()

    try:
        api_response = get_openai_client().responses.create(
            model=model,
            instructions=build_translation_instructions(
                text,
                direction=direction,
                pronunciation_preference=pronunciation_preference,
            ),
            input=text,
            max_output_tokens=500,
        )
        translation = (api_response.output_text or "").strip()

        if not translation:
            raise RuntimeError("The model returned an empty translation.")

        usage = getattr(api_response, "usage", None)
        input_tokens = usage.input_tokens if usage else 0
        output_tokens = usage.output_tokens if usage else 0
        guardrails.record_usage(input_tokens, output_tokens)

        # Never log `text` or `translation` - only metadata about the call.
        logger.info(
            "translate_request status=success model=%s direction=%s "
            "latency_ms=%d input_tokens=%d output_tokens=%d",
            model,
            direction,
            round((time.monotonic() - started_at) * 1000),
            input_tokens,
            output_tokens,
        )

        return Response({"translation": translation})

    except Exception as error:
        error_status = _classify_openai_error(error)
        logger.exception(
            "translate_request status=%s model=%s direction=%s latency_ms=%d",
            error_status,
            model,
            direction,
            round((time.monotonic() - started_at) * 1000),
        )
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
@throttle_classes([SessionIssueRateThrottle, SessionIssueGlobalRateThrottle])
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
