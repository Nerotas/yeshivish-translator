"""Global cost/usage guardrails for OpenAI-backed translation requests.

Independent of per-caller throttling, these track cumulative OpenAI usage in
a rolling 24-hour window using the shared cache, and block further OpenAI
calls once either the request-count or the estimated-cost budget configured
in `config/settings.py` is exceeded. See docs/operations.md for tuning and
incident-response guidance.
"""

from __future__ import annotations

import datetime as dt
import logging

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

_WINDOW_TTL_SECONDS = 26 * 3600  # a little over a day, to absorb clock skew
_REQUESTS_KEY_PREFIX = "guardrail:requests:"
_INPUT_TOKENS_KEY_PREFIX = "guardrail:input_tokens:"
_OUTPUT_TOKENS_KEY_PREFIX = "guardrail:output_tokens:"


def _window_suffix() -> str:
    """A key suffix that rotates once per UTC calendar day."""
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")


def _increment(prefix: str, amount: int) -> int:
    key = prefix + _window_suffix()
    cache.add(key, 0, timeout=_WINDOW_TTL_SECONDS)
    try:
        return int(cache.incr(key, amount))
    except ValueError:
        # Lost a race with the key's own TTL expiring between add and incr.
        cache.add(key, 0, timeout=_WINDOW_TTL_SECONDS)
        return int(cache.incr(key, amount))


def estimated_cost_usd(input_tokens: int, output_tokens: int) -> float:
    return (
        input_tokens / 1_000_000 * settings.OPENAI_INPUT_COST_PER_MILLION_TOKENS
        + output_tokens / 1_000_000 * settings.OPENAI_OUTPUT_COST_PER_MILLION_TOKENS
    )


def current_usage() -> tuple[int, int, int]:
    """Return `(requests, input_tokens, output_tokens)` for the current window."""
    requests = int(cache.get(_REQUESTS_KEY_PREFIX + _window_suffix(), 0))
    input_tokens = int(cache.get(_INPUT_TOKENS_KEY_PREFIX + _window_suffix(), 0))
    output_tokens = int(cache.get(_OUTPUT_TOKENS_KEY_PREFIX + _window_suffix(), 0))
    return requests, input_tokens, output_tokens


def budget_exceeded() -> bool:
    """Whether the configured daily request or cost budget has been reached.

    Logs an ERROR-level "OPENAI_COST_GUARDRAIL_TRIPPED" line on every blocked
    call so alerting can be configured on that message (see
    docs/operations.md).
    """
    requests, input_tokens, output_tokens = current_usage()
    cost = estimated_cost_usd(input_tokens, output_tokens)

    if requests >= settings.DAILY_REQUEST_BUDGET:
        logger.error(
            "OPENAI_COST_GUARDRAIL_TRIPPED reason=request_budget requests=%s budget=%s",
            requests,
            settings.DAILY_REQUEST_BUDGET,
        )
        return True

    if cost >= settings.DAILY_COST_BUDGET_USD:
        logger.error(
            "OPENAI_COST_GUARDRAIL_TRIPPED reason=cost_budget "
            "estimated_cost_usd=%.4f budget_usd=%.2f",
            cost,
            settings.DAILY_COST_BUDGET_USD,
        )
        return True

    return False


def record_usage(input_tokens: int, output_tokens: int) -> None:
    """Record a completed OpenAI call's token usage for the current window."""
    _increment(_REQUESTS_KEY_PREFIX, 1)
    _increment(_INPUT_TOKENS_KEY_PREFIX, input_tokens)
    _increment(_OUTPUT_TOKENS_KEY_PREFIX, output_tokens)
