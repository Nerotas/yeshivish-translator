"""Unit tests for the global cost/usage guardrail (backend/translator/guardrails.py)."""

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from . import guardrails


class GuardrailsTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    def test_starts_with_no_usage_recorded(self):
        self.assertEqual(guardrails.current_usage(), (0, 0, 0))
        self.assertFalse(guardrails.budget_exceeded())

    def test_records_cumulative_usage_across_calls(self):
        guardrails.record_usage(input_tokens=100, output_tokens=40)
        guardrails.record_usage(input_tokens=50, output_tokens=10)

        self.assertEqual(guardrails.current_usage(), (2, 150, 50))

    @override_settings(
        OPENAI_INPUT_COST_PER_MILLION_TOKENS=1.0,
        OPENAI_OUTPUT_COST_PER_MILLION_TOKENS=2.0,
    )
    def test_estimated_cost_uses_the_configured_per_token_rates(self):
        cost = guardrails.estimated_cost_usd(
            input_tokens=1_000_000, output_tokens=500_000
        )

        self.assertAlmostEqual(cost, 1.0 + 1.0)

    @override_settings(DAILY_REQUEST_BUDGET=1, DAILY_COST_BUDGET_USD=1000.0)
    def test_trips_once_the_request_budget_is_reached(self):
        self.assertFalse(guardrails.budget_exceeded())

        guardrails.record_usage(input_tokens=1, output_tokens=1)

        self.assertTrue(guardrails.budget_exceeded())

    @override_settings(DAILY_REQUEST_BUDGET=1000, DAILY_COST_BUDGET_USD=0.0001)
    def test_trips_once_the_cost_budget_is_reached(self):
        self.assertFalse(guardrails.budget_exceeded())

        guardrails.record_usage(input_tokens=10_000, output_tokens=10_000)

        self.assertTrue(guardrails.budget_exceeded())

    @override_settings(DAILY_REQUEST_BUDGET=1000, DAILY_COST_BUDGET_USD=1000.0)
    def test_does_not_trip_while_comfortably_under_budget(self):
        guardrails.record_usage(input_tokens=10, output_tokens=10)

        self.assertFalse(guardrails.budget_exceeded())
