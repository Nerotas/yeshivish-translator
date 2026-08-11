"""Short-lived JWT session-token authentication.

These tokens do not represent a signed-up user account. They prove the
bearer recently completed a throttled handshake with this backend
(`POST /api/auth/session/`), which is the abuse-control boundary in front of
the billable translate endpoint. See docs/authentication.md for the full
design and lifecycle (issuance, refresh, revocation, key rotation).
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any

import jwt
from django.conf import settings
from django.core.cache import cache
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

TRANSLATE_SCOPE = "translate"
_ALGORITHM = "HS256"
_REVOKED_CACHE_PREFIX = "jwt-revoked:"


@dataclass(frozen=True)
class SessionPrincipal:
    """A non-persistent stand-in for `request.user` for session-token holders."""

    jti: str
    is_authenticated: bool = True
    is_anonymous: bool = False

    def __str__(self) -> str:
        return f"session:{self.jti}"


def _signing_keys() -> list[str]:
    """Active key first, then keys kept only to verify older tokens."""
    return [settings.JWT_SIGNING_KEY, *settings.JWT_PREVIOUS_SIGNING_KEYS]


def issue_session_token() -> tuple[str, int]:
    ttl = settings.JWT_ACCESS_TOKEN_TTL_SECONDS
    now = int(time.time())
    payload = {
        "iss": settings.JWT_ISSUER,
        "scope": TRANSLATE_SCOPE,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.JWT_SIGNING_KEY, algorithm=_ALGORITHM)
    return token, ttl


def decode_session_token(token: str) -> dict[str, Any]:
    """Validate signature, issuer, expiry, scope, and revocation status.

    Tries the active signing key first, then previous keys, so tokens issued
    shortly before a key rotation keep working until they naturally expire.
    """
    last_error: Exception | None = None

    for key in _signing_keys():
        try:
            payload: dict[str, Any] = jwt.decode(
                token,
                key,
                algorithms=[_ALGORITHM],
                issuer=settings.JWT_ISSUER,
                options={"require": ["exp", "iat", "jti", "scope"]},
            )
        except jwt.ExpiredSignatureError as error:
            # The signature matched this key, so the token is genuinely
            # expired rather than merely signed with a different key.
            raise AuthenticationFailed("Session token has expired.") from error
        except jwt.InvalidTokenError as error:
            last_error = error
            continue
        else:
            if payload.get("scope") != TRANSLATE_SCOPE:
                raise AuthenticationFailed("Invalid session token.")
            if cache.get(_REVOKED_CACHE_PREFIX + payload["jti"]):
                raise AuthenticationFailed("Session token has been revoked.")
            return payload

    raise AuthenticationFailed("Invalid session token.") from last_error


def revoke_session_token(payload: dict[str, Any]) -> None:
    """Block a token's `jti` from being accepted again before it expires."""
    remaining_seconds = max(int(payload["exp"]) - int(time.time()), 1)
    cache.set(_REVOKED_CACHE_PREFIX + payload["jti"], True, timeout=remaining_seconds)


class SessionTokenAuthentication(BaseAuthentication):
    """Authenticates requests bearing a short-lived `Authorization: Bearer` JWT."""

    keyword = "Bearer"

    def authenticate(
        self, request: Any
    ) -> tuple[SessionPrincipal, dict[str, Any]] | None:
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header:
            return None

        scheme, _, token = header.partition(" ")
        if scheme != self.keyword or not token:
            raise AuthenticationFailed("Invalid Authorization header.")

        payload = decode_session_token(token)
        return SessionPrincipal(jti=payload["jti"]), payload

    def authenticate_header(self, request: Any) -> str:
        return self.keyword
