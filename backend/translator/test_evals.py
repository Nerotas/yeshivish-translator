from copy import deepcopy
from io import StringIO
from pathlib import Path
from unittest.mock import mock_open, patch

from django.test import SimpleTestCase

from .evals import EvalCase, evaluate_translation, load_eval_cases, main


class TranslationEvalTests(SimpleTestCase):
    def test_all_committed_eval_fixtures_pass(self):
        for case in load_eval_cases():
            with self.subTest(case=case["id"]):
                self.assertEqual(evaluate_translation(case), [])

    def test_detects_quality_contract_violations(self):
        case: EvalCase = deepcopy(load_eval_cases()[1])
        case["candidate_translation"] = 'mamesh "Sources: https://example.com [1]."'
        case["forbidden_terms"] = ["mamesh"]

        failures = evaluate_translation(case)

        self.assertTrue(any("missing required term" in failure for failure in failures))
        self.assertIn("contains a citation, source, footnote, or URL", failures)
        self.assertIn("paragraph count changed", failures)
        self.assertIn("quotation boundaries changed", failures)

    def test_detects_an_empty_translation(self):
        case: EvalCase = deepcopy(load_eval_cases()[0])
        case["candidate_translation"] = "   "

        self.assertIn("translation is empty", evaluate_translation(case))

    @patch("translator.evals.json.load", return_value={})
    @patch.object(Path, "open", mock_open(read_data="{}"))
    def test_rejects_non_list_fixture_data(self, _load):
        with self.assertRaisesRegex(ValueError, "must be a JSON list"):
            load_eval_cases(Path("unused.json"))

    def test_cli_runner_reports_success(self):
        output = StringIO()

        with patch("sys.stdout", output):
            result = main()

        self.assertEqual(result, 0)
        self.assertIn("PASS plain_english_clarity", output.getvalue())

    def test_cli_runner_reports_failures(self):
        case: EvalCase = deepcopy(load_eval_cases()[0])
        case["candidate_translation"] = ""
        output = StringIO()

        with (
            patch("translator.evals.load_eval_cases", return_value=[case]),
            patch("sys.stdout", output),
        ):
            result = main()

        self.assertEqual(result, 1)
        self.assertIn("FAIL plain_english_clarity", output.getvalue())
