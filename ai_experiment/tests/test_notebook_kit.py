import math
import unittest
from unittest import mock

import requests

from src import notebook_kit as kit


def _http_error(status: int, body: str = "", headers: dict | None = None) -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status
    response._content = body.encode()
    response.headers.update(headers or {})
    return requests.HTTPError(response=response)


class WithRetryTest(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch.object(kit, "GROQ_MIN_INTERVAL_S", 0)
        patcher.start()
        self.addCleanup(patcher.stop)

    @mock.patch.object(kit.time, "sleep")
    def test_waits_for_retry_after_on_429(self, sleep):
        fn = mock.Mock(side_effect=[_http_error(429, "tokens per minute", {"retry-after": "30"}), "ok"])
        self.assertEqual(kit.with_retry(fn), "ok")
        self.assertGreaterEqual(sleep.call_args_list[-1].args[0], 31)

    @mock.patch.object(kit.time, "sleep")
    def test_daily_quota_stops_without_retry(self, sleep):
        fn = mock.Mock(side_effect=_http_error(429, "Rate limit reached: tokens per day (TPD)"))
        with self.assertRaises(RuntimeError):
            kit.with_retry(fn)
        self.assertEqual(fn.call_count, 1)

    @mock.patch.object(kit.time, "sleep")
    def test_client_error_is_not_retried(self, sleep):
        fn = mock.Mock(side_effect=_http_error(400, "model not found"))
        with self.assertRaises(requests.HTTPError):
            kit.with_retry(fn)
        self.assertEqual(fn.call_count, 1)

    @mock.patch.object(kit.time, "sleep")
    def test_paces_consecutive_calls(self, sleep):
        with mock.patch.object(kit, "GROQ_MIN_INTERVAL_S", 20):
            kit.with_retry(lambda: None)
            kit.with_retry(lambda: None)
        self.assertGreater(sleep.call_args_list[-1].args[0], 19)


class GroqChatTest(unittest.TestCase):
    def _reply(self, content: str):
        response = mock.Mock()
        response.json.return_value = {"choices": [{"message": {"content": content}}]}
        return response

    def test_strips_finished_and_truncated_thinking(self):
        with mock.patch.dict(kit.os.environ, {"GROQ_API_KEY": "x"}), mock.patch.object(kit.requests, "post") as post:
            post.return_value = self._reply("<think>rencana</think>\nEsai.")
            self.assertEqual(kit.groq_chat("p", "qwen/qwen3-32b"), "Esai.")
            post.return_value = self._reply("<think>berpikir terus sampai token habis")
            self.assertEqual(kit.groq_chat("p", "qwen/qwen3-32b"), "")

    def test_low_reasoning_only_for_gpt_oss(self):
        with mock.patch.dict(kit.os.environ, {"GROQ_API_KEY": "x"}), mock.patch.object(kit.requests, "post") as post:
            post.return_value = self._reply("Esai.")
            kit.groq_chat("p", "openai/gpt-oss-20b")
            self.assertEqual(post.call_args.kwargs["json"]["reasoning_effort"], "low")
            kit.groq_chat("p", "llama-3.1-8b-instant")
            self.assertNotIn("reasoning_effort", post.call_args.kwargs["json"])


class StatsTest(unittest.TestCase):
    def test_wilson_zero_of_five(self):
        low, high = kit.wilson(0, 5)
        self.assertEqual(low, 0.0)
        self.assertAlmostEqual(high, 0.434, places=3)

    def test_quadratic_kappa_perfect_agreement(self):
        self.assertAlmostEqual(kit.quadratic_kappa([1, 2, 3, 6], [1, 2, 3, 6]), 1.0)


if __name__ == "__main__":
    unittest.main()


class ClassificationMetricsTest(unittest.TestCase):
    def test_binary_metrics(self):
        m = kit.binary_metrics(tp=8, fp=2, tn=18, fn=2)
        self.assertAlmostEqual(m["presisi"], 0.8)
        self.assertAlmostEqual(m["recall (TPR)"], 0.8)
        self.assertAlmostEqual(m["F1"], 0.8)
        self.assertAlmostEqual(m["FPR (salah tuduh / manusia)"], 0.1)
        self.assertAlmostEqual(m["FDR (salah tuduh / yang ditandai)"], 0.2)
        self.assertAlmostEqual(m["FP / semua teks"], 2 / 30)

    def test_binary_metrics_without_ai_samples(self):
        m = kit.binary_metrics(tp=0, fp=2, tn=11, fn=0)
        self.assertTrue(math.isnan(m["recall (TPR)"]))
        self.assertAlmostEqual(m["FPR (salah tuduh / manusia)"], 2 / 13)

    def test_multiclass_report(self):
        rows, summary = kit.multiclass_report([1, 1, 2, 2], [1, 2, 2, 2], [1, 2, 3])
        self.assertAlmostEqual(rows[0]["F1"], 2 / 3)
        self.assertAlmostEqual(rows[1]["F1"], 0.8)
        self.assertEqual(rows[2]["support"], 0)
        self.assertAlmostEqual(summary["akurasi"], 0.75)
        self.assertAlmostEqual(summary["F1 makro"], (2 / 3 + 0.8) / 2)
