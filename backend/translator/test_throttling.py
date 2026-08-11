"""Unit tests for shared, cache-backed rate throttling.

These tests exercise the throttle classes directly against Django's cache
framework. Because the throttle classes only ever coordinate through the
configured cache backend (Redis in production, see docs/operations.md), a
fresh throttle instance behaves exactly as a second worker process sharing
the same Redis instance would - which is what several tests below simulate.
"""

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from .throttling import (
    ClientIPRateThrottle,
    GlobalRateThrottle,
    SessionTokenRateThrottle,
)


class _FakeRequest:
    def __init__(self, remote_addr="1.2.3.4", forwarded_for=None, auth=None):
        self.META = {"REMOTE_ADDR": remote_addr}
        if forwarded_for is not None:
            self.META["HTTP_X_FORWARDED_FOR"] = forwarded_for
        self.auth = auth


class OneRequestIPThrottle(ClientIPRateThrottle):
    scope = "test_ip"
    rate = "1/hour"


class OneRequestSessionThrottle(SessionTokenRateThrottle):
    scope = "test_session"
    rate = "1/hour"


class OneRequestGlobalThrottle(GlobalRateThrottle):
    scope = "test_global"
    rate = "1/hour"


class ClientIPRateThrottleTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    def test_allows_the_first_request_then_deterministically_429s(self):
        request = _FakeRequest()

        self.assertTrue(OneRequestIPThrottle().allow_request(request, None))
        self.assertFalse(OneRequestIPThrottle().allow_request(request, None))

    def test_shared_cache_enforces_the_limit_across_separate_instances(self):
        """A brand-new throttle instance - as a second worker process would
        construct - still sees the first worker's recorded request because
        both read and write the same shared cache key."""
        request = _FakeRequest()

        self.assertTrue(OneRequestIPThrottle().allow_request(request, None))
        self.assertFalse(OneRequestIPThrottle().allow_request(request, None))

    def test_different_ips_are_throttled_independently(self):
        request_a = _FakeRequest(remote_addr="1.1.1.1")
        request_b = _FakeRequest(remote_addr="2.2.2.2")

        self.assertTrue(OneRequestIPThrottle().allow_request(request_a, None))
        self.assertTrue(OneRequestIPThrottle().allow_request(request_b, None))

    @override_settings(REST_FRAMEWORK={"NUM_PROXIES": 0})
    def test_ignores_the_forwarded_for_header_when_no_proxies_are_trusted(self):
        request = _FakeRequest(remote_addr="1.2.3.4", forwarded_for="9.9.9.9")

        self.assertEqual(OneRequestIPThrottle().get_ident(request), "1.2.3.4")

    @override_settings(REST_FRAMEWORK={"NUM_PROXIES": 1})
    def test_trusts_the_forwarded_for_header_up_to_the_configured_proxy_count(self):
        # With one trusted proxy hop, the rightmost X-Forwarded-For entry is
        # the address added by that trusted proxy - not the leftmost,
        # client-supplied (and therefore spoofable) claim.
        request = _FakeRequest(
            remote_addr="10.0.0.1", forwarded_for="9.9.9.9, 10.0.0.5"
        )

        self.assertEqual(OneRequestIPThrottle().get_ident(request), "10.0.0.5")


class SessionTokenRateThrottleTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    def test_does_not_throttle_requests_without_a_session(self):
        request = _FakeRequest(auth=None)

        self.assertIsNone(OneRequestSessionThrottle().get_cache_key(request, None))

    def test_throttles_repeated_requests_from_the_same_session(self):
        request = _FakeRequest(auth={"jti": "abc123"})

        self.assertTrue(OneRequestSessionThrottle().allow_request(request, None))
        self.assertFalse(OneRequestSessionThrottle().allow_request(request, None))

    def test_different_sessions_are_throttled_independently(self):
        request_a = _FakeRequest(auth={"jti": "session-a"})
        request_b = _FakeRequest(auth={"jti": "session-b"})

        self.assertTrue(OneRequestSessionThrottle().allow_request(request_a, None))
        self.assertTrue(OneRequestSessionThrottle().allow_request(request_b, None))


class GlobalRateThrottleTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    def test_the_shared_bucket_applies_regardless_of_caller_identity(self):
        request_a = _FakeRequest(remote_addr="1.1.1.1")
        request_b = _FakeRequest(remote_addr="2.2.2.2")

        self.assertTrue(OneRequestGlobalThrottle().allow_request(request_a, None))
        self.assertFalse(OneRequestGlobalThrottle().allow_request(request_b, None))
