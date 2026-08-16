"""Tes bagian evaluate_groq yang khas modul ini dan tidak menyentuh jaringan.

Penyeimbangan sampel dan cache skor sudah pindah ke src/evaluation.py karena
dipakai bersama evaluate_detector, dan tesnya ikut ke tests/test_evaluation.py.
Yang tersisa di sini adalah aturan percobaan ulang, satu satunya bagian yang
memang harus berbeda antar penyedia.

Groq menjawab 429 untuk dua hal yang penanganannya berlawanan: batas per menit
yang pulih dalam hitungan detik dan layak ditunggu, dan batas token per hari
yang tidak akan pulih berapa kali pun diulang. Membedakannya menentukan apakah
menjalankan ulang sekarang ada gunanya atau hanya membuang waktu.

Jalankan dari folder ai_experiment:

    python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import evaluate_groq  # noqa: E402


class _FakeLLM:
    """Cukup untuk fetch_ai_probability, tanpa memuat Django."""

    def __init__(self, outcomes):
        self._outcomes = list(outcomes)
        self.calls = 0

    def _call_groq(self, text, education_level):
        self.calls += 1
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    @staticmethod
    def _clamp(value, minimum, maximum):
        return max(minimum, min(maximum, int(value)))


def _http_error(status: int, body: str = "") -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status
    response._content = body.encode("utf-8")
    return requests.HTTPError(f"status {status}", response=response)


# Pesan asli Groq, disalin apa adanya dari keluaran nyata.
TPD_BODY = (
    '{"error":{"message":"Rate limit reached for model '
    "`llama-3.3-70b-versatile` in organization `org_x` service tier "
    '`on_demand` on tokens per day (TPD): Limit 100000, Used 99873, '
    'Requested 623.","type":"tokens","code":"rate_limit_exceeded"}}'
)
TPM_BODY = (
    '{"error":{"message":"Rate limit reached for model `x` on tokens per '
    'minute (TPM): Limit 12000.","type":"tokens","code":"rate_limit_exceeded"}}'
)


class FetchTest(unittest.TestCase):
    def setUp(self):
        # Backoff produksi menunggu detik, dan tes tidak boleh menunggu.
        patcher = patch.object(evaluate_groq.time, "sleep")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_returns_clamped_score(self):
        llm = _FakeLLM([{"ai_probability": 73}])
        self.assertEqual(evaluate_groq.fetch_ai_probability("teks", "S1", llm), 73.0)

    def test_score_above_range_is_clamped_like_production(self):
        llm = _FakeLLM([{"ai_probability": 140}])
        self.assertEqual(evaluate_groq.fetch_ai_probability("teks", "S1", llm), 100.0)

    def test_per_minute_rate_limit_is_retried_then_succeeds(self):
        llm = _FakeLLM(
            [
                _http_error(429, TPM_BODY),
                _http_error(429, TPM_BODY),
                {"ai_probability": 12},
            ]
        )
        self.assertEqual(evaluate_groq.fetch_ai_probability("teks", "S1", llm), 12.0)
        self.assertEqual(llm.calls, 3)

    def test_daily_quota_stops_immediately_instead_of_retrying(self):
        """Batas harian tidak pulih berapa kali pun diulang.

        Mengulangnya lima kali dengan backoff hanya membuang waktu dan
        menyamarkan penyebabnya sebagai gangguan jaringan biasa.
        """
        llm = _FakeLLM([_http_error(429, TPD_BODY)])
        with self.assertRaises(SystemExit) as caught:
            evaluate_groq.fetch_ai_probability("teks", "S1", llm)
        self.assertEqual(llm.calls, 1)
        self.assertIn("harian", str(caught.exception))

    def test_daily_and_per_minute_limits_are_told_apart(self):
        self.assertTrue(evaluate_groq.is_daily_quota(TPD_BODY))
        self.assertFalse(evaluate_groq.is_daily_quota(TPM_BODY))

    def test_rejected_key_is_not_retried(self):
        """401 tidak akan berubah karena diulang.

        Mengulangnya hanya membakar waktu dan menyamarkan penyebabnya, persis
        seperti yang pernah terjadi saat kunci Groq kedaluwarsa.
        """
        llm = _FakeLLM([_http_error(401)])
        with self.assertRaises(requests.HTTPError):
            evaluate_groq.fetch_ai_probability("teks", "S1", llm)
        self.assertEqual(llm.calls, 1)

    def test_missing_field_eventually_raises_instead_of_returning_zero(self):
        """Kegagalan harus berisik.

        Kalibrasi yang diam diam mengembalikan nol untuk sampel yang gagal akan
        melaporkan angka yang salah dengan penuh percaya diri.
        """
        llm = _FakeLLM([{"bloom_level": 3}] * evaluate_groq.MAX_RETRIES)
        with self.assertRaises(RuntimeError):
            evaluate_groq.fetch_ai_probability("teks", "S1", llm)


if __name__ == "__main__":
    unittest.main()
