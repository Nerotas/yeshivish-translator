"""Tests for `/api/translate/` upstream-failure resilience and privacy-conscious
logging: OpenAI timeout/connection/rate-limit handling, bounded retries (no
silent/indefinite retries of billable requests), the global cost/usage
guardrail short-circuiting the OpenAI call, and never logging submitted text
or translated output.
"""

from types import SimpleNamespace
from unittest.mock import patch

import httpx
import openai
from django.core.cache import cache
from django.test import TestCase

from . import guardrails
from .tests import bearer_auth_header, openai_translation_response


def _httpx_request() -> httpx.Request:
    return httpx.Request("POST", "https://api.openai.com/v1/responses")


class TranslateUpstreamFailureTests(TestCase):
    def tearDown(self):
        cache.clear()

    @patch("translator.views.get_openai_client")
    def test_timeout_returns_a_generic_502_without_leaking_upstream_details(
        self, get_client
    ):
        get_client.return_value.responses.parse.side_effect = openai.APITimeoutError(
            request=_httpx_request()
        )

        response = self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
            **bearer_auth_header(),
        )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            response.json(), {"error": "Translation is temporarily unavailable."}
        )

    @patch("translator.views.get_openai_client")
    def test_connection_error_returns_a_generic_502(self, get_client):
        get_client.return_value.responses.parse.side_effect = openai.APIConnectionError(
            request=_httpx_request()
        )

        response = self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
            **bearer_auth_header(),
        )

        self.assertEqual(response.status_code, 502)

    @patch("translator.views.get_openai_client")
    def test_rate_limit_error_returns_a_generic_502(self, get_client):
        request = _httpx_request()
        get_client.return_value.responses.parse.side_effect = openai.RateLimitError(
            "rate limited",
            response=httpx.Response(429, request=request),
            body=None,
        )

        response = self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
            **bearer_auth_header(),
        )

        self.assertEqual(response.status_code, 502)

    @patch("translator.views.get_openai_client")
    def test_does_not_retry_a_failed_request_itself(self, get_client):
        """The view must not add its own retry loop on top of the OpenAI
        client's bounded `max_retries` - a failure results in exactly one
        call to `responses.parse`."""
        get_client.return_value.responses.parse.side_effect = RuntimeError("boom")

        self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
            **bearer_auth_header(),
        )

        get_client.return_value.responses.parse.assert_called_once()

    @patch("translator.views.get_openai_client")
    def test_never_logs_the_submitted_text_or_translation(self, get_client):
        get_client.return_value.responses.parse.return_value = (
            openai_translation_response("Secret translated output.")
        )

        with self.assertLogs("translator.views", level="INFO") as captured:
            response = self.client.post(
                "/api/translate/",
                {"text": "Very secret submitted text."},
                content_type="application/json",
                **bearer_auth_header(),
            )

        self.assertEqual(response.status_code, 200)
        for record in captured.records:
            message = record.getMessage()
            self.assertNotIn("Very secret submitted text.", message)
            self.assertNotIn("Secret translated output.", message)

    @patch("translator.views.get_openai_client")
    def test_failure_logs_do_not_include_the_submitted_text(self, get_client):
        get_client.return_value.responses.parse.side_effect = RuntimeError("boom")

        with self.assertLogs("translator.views", level="ERROR") as captured:
            self.client.post(
                "/api/translate/",
                {"text": "Another very secret input."},
                content_type="application/json",
                **bearer_auth_header(),
            )

        for record in captured.records:
            self.assertNotIn("Another very secret input.", record.getMessage())


class TranslateGuardrailTests(TestCase):
    def tearDown(self):
        cache.clear()

    @patch("translator.views.get_openai_client")
    def test_blocks_the_call_and_never_invokes_openai_once_budget_is_exceeded(
        self, get_client
    ):
        with patch.object(guardrails, "budget_exceeded", return_value=True):
            response = self.client.post(
                "/api/translate/",
                {"text": "Mamesh good."},
                content_type="application/json",
                **bearer_auth_header(),
            )

        self.assertEqual(response.status_code, 503)
        get_client.return_value.responses.parse.assert_not_called()

    @patch("translator.views.get_openai_client")
    def test_records_usage_after_a_successful_call(self, get_client):
        get_client.return_value.responses.parse.return_value = (
            openai_translation_response(
                "Translated.",
                usage=SimpleNamespace(input_tokens=12, output_tokens=34),
            )
        )

        response = self.client.post(
            "/api/translate/",
            {"text": "Mamesh good."},
            content_type="application/json",
            **bearer_auth_header(),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(guardrails.current_usage(), (1, 12, 34))
