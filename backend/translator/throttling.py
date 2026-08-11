"""Request-rate limiting for the auth handshake and translate endpoints.

Three kinds of limits apply, all backed by Django's shared cache (see
`REDIS_URL` in `config/settings.py` and docs/operations.md so they are
enforced consistently across workers and instances):

- Per-IP (`ClientIPRateThrottle` subclasses) - keyed by the client address
  derived from `TRUSTED_PROXY_COUNT` trusted proxy hops (DRF's `NUM_PROXIES`
  setting).
- Per-session-token (`SessionTokenRateThrottle` subclasses) - keyed by the
  bearer token's `jti`, the only "authenticated identity" this anonymous,
  account-free app has (see docs/authentication.md). Skipped when the
  request has no valid token, since the IP-keyed throttle still applies in
  that case.
- Global (`GlobalRateThrottle` subclasses) - a single shared bucket across
  every caller, providing a hard ceiling independent of IP or session.
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


class SessionTokenRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request: Any, view: Any) -> str | None:
        auth = getattr(request, "auth", None)
        jti = auth.get("jti") if isinstance(auth, dict) else None
        if not jti:
            return None
        return self.cache_format % {"scope": self.scope, "ident": jti}


class GlobalRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request: Any, view: Any) -> str | None:
        return f"throttle_{self.scope}_global"


class SessionIssueRateThrottle(ClientIPRateThrottle):
    scope = "auth_session"


class SessionIssueGlobalRateThrottle(GlobalRateThrottle):
    scope = "auth_session_global"


class TranslateRateThrottle(ClientIPRateThrottle):
    scope = "translate"


class TranslateSessionRateThrottle(SessionTokenRateThrottle):
    scope = "translate_session"


class TranslateGlobalRateThrottle(GlobalRateThrottle):
    scope = "translate_global"
