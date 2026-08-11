import time
from types import SimpleNamespace

import jwt
from django.conf import settings
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed

from .authentication import (
    SessionTokenAuthentication,
    decode_session_token,
    issue_session_token,
    revoke_session_token,
)


def _make_request(header: str | None):
    meta = {"HTTP_AUTHORIZATION": header} if header is not None else {}
    return SimpleNamespace(META=meta)


def _sign(claims: dict, key: str | None = None) -> str:
    return jwt.encode(claims, key or settings.JWT_SIGNING_KEY, algorithm="HS256")


def _claims(**overrides) -> dict:
    now = int(time.time())
    claims = {
        "iss": settings.JWT_ISSUER,
        "scope": "translate",
        "iat": now,
        "exp": now + 300,
        "jti": "test-jti",
    }
    claims.update(overrides)
    return claims


class SessionTokenLifecycleTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    def test_issues_a_token_with_the_configured_ttl(self):
        token, expires_in = issue_session_token()

        self.assertEqual(expires_in, settings.JWT_ACCESS_TOKEN_TTL_SECONDS)
        payload = decode_session_token(token)
        self.assertEqual(payload["scope"], "translate")
        self.assertEqual(payload["iss"], settings.JWT_ISSUER)
        self.assertIn("jti", payload)

    def test_rejects_a_token_signed_with_an_unknown_key(self):
        bogus = _sign(_claims(), key="some-other-key")

        with self.assertRaises(AuthenticationFailed):
            decode_session_token(bogus)

    def test_rejects_an_expired_token(self):
        expired = _sign(_claims(iat=int(time.time()) - 1000, exp=int(time.time()) - 1))

        with self.assertRaisesMessage(AuthenticationFailed, "expired"):
            decode_session_token(expired)

    def test_rejects_a_token_with_the_wrong_scope(self):
        wrong_scope = _sign(_claims(scope="admin"))

        with self.assertRaises(AuthenticationFailed):
            decode_session_token(wrong_scope)

    def test_rejects_a_token_with_the_wrong_issuer(self):
        wrong_issuer = _sign(_claims(iss="someone-else"))

        with self.assertRaises(AuthenticationFailed):
            decode_session_token(wrong_issuer)

    def test_rejects_a_malformed_token(self):
        with self.assertRaises(AuthenticationFailed):
            decode_session_token("not-a-real-token")

    def test_rejects_a_revoked_token(self):
        token, _ = issue_session_token()
        payload = decode_session_token(token)

        revoke_session_token(payload)

        with self.assertRaisesMessage(AuthenticationFailed, "revoked"):
            decode_session_token(token)

    @override_settings(JWT_PREVIOUS_SIGNING_KEYS=["previous-signing-key"])
    def test_accepts_a_token_signed_with_a_previous_key_during_rotation(self):
        rotated = _sign(_claims(jti="rotated-token"), key="previous-signing-key")

        payload = decode_session_token(rotated)

        self.assertEqual(payload["jti"], "rotated-token")

    def test_rejects_a_key_dropped_after_the_rotation_window(self):
        # Once a previously-valid key is removed from JWT_PREVIOUS_SIGNING_KEYS,
        # tokens signed with it must no longer validate.
        stale = _sign(_claims(jti="stale-token"), key="previous-signing-key")

        with self.assertRaises(AuthenticationFailed):
            decode_session_token(stale)


class SessionTokenAuthenticationTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    def test_returns_none_when_no_header_is_present(self):
        authenticator = SessionTokenAuthentication()

        self.assertIsNone(authenticator.authenticate(_make_request(None)))

    def test_rejects_a_non_bearer_scheme(self):
        authenticator = SessionTokenAuthentication()

        with self.assertRaises(AuthenticationFailed):
            authenticator.authenticate(_make_request("Basic sometoken"))

    def test_rejects_a_bearer_header_without_a_token(self):
        authenticator = SessionTokenAuthentication()

        with self.assertRaises(AuthenticationFailed):
            authenticator.authenticate(_make_request("Bearer "))

    def test_authenticates_a_valid_bearer_token(self):
        token, _ = issue_session_token()
        authenticator = SessionTokenAuthentication()

        principal, payload = authenticator.authenticate(
            _make_request(f"Bearer {token}")
        )

        self.assertTrue(principal.is_authenticated)
        self.assertEqual(payload["jti"], principal.jti)
