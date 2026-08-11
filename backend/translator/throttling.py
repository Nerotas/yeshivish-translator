"""Request-rate limiting for the auth handshake and translate endpoints.

Both throttles key by client IP rather than `request.user`, because a valid
session token proves recent completion of the handshake, not a real,
distinguishable identity - keying by IP keeps abuse protection meaningful and
keeps the scope names available for the separate anonymous API-hardening
work to build on (see docs/authentication.md).
"""

from __future__ import annotations

from typing import Any

from rest_framework.throttling import SimpleRateThrottle


class ClientIPRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request: Any, view: Any) -> str | None:
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class SessionIssueRateThrottle(ClientIPRateThrottle):
    scope = "auth_session"


class TranslateRateThrottle(ClientIPRateThrottle):
    scope = "translate"
