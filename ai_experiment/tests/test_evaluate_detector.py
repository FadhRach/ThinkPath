"""Tes bagian evaluate_detector yang khas modul ini dan tidak menyentuh jaringan.

Penyeimbangan sampel dan cache skor sudah pindah ke src/evaluation.py karena
dipakai bersama evaluate_groq, dan tesnya ikut ke tests/test_evaluation.py. Yang
tersisa di sini adalah satu satunya aturan yang benar benar milik detektor
berbayar: penyaringan panjang teks.

Kalau teks di luar rentang yang diterima penyedia ikut terkirim, ia ditolak satu
per satu di tengah proses dan sampel yang tersisa jadi condong ke teks panjang
tanpa ada yang menyadarinya. Kredit tetap habis, dan angkanya ikut condong.

Jalankan dari folder ai_experiment:

    python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import evaluate_detector  # noqa: E402


class _FakeDetector:
    """Cukup untuk eligible_rows, tanpa memuat Django."""

    MIN_CHARS = 300
    MAX_CHARS = 150_000


def _rows(n_human: int, n_ai: int, chars: int = 400) -> list[dict]:
    body = "a" * chars
    rows = [
        {"text": f"manusia {i} {body}", "binary_label": 0} for i in range(n_human)
    ]
    rows += [{"text": f"ai {i} {body}", "binary_label": 1} for i in range(n_ai)]
    return rows


class EligibleRowsTest(unittest.TestCase):
    def test_short_text_is_dropped(self):
        rows = _rows(2, 2, chars=400) + _rows(1, 1, chars=10)
        kept, skipped = evaluate_detector.eligible_rows(rows, _FakeDetector)
        self.assertEqual(skipped, 2)
        self.assertEqual(len(kept), 4)

    def test_overlong_text_is_dropped(self):
        rows = _rows(1, 1, chars=400)
        rows.append({"text": "a" * 200_000, "binary_label": 1})
        kept, skipped = evaluate_detector.eligible_rows(rows, _FakeDetector)
        self.assertEqual(skipped, 1)
        self.assertEqual(len(kept), 2)

    def test_nothing_dropped_when_all_fit(self):
        rows = _rows(3, 3)
        kept, skipped = evaluate_detector.eligible_rows(rows, _FakeDetector)
        self.assertEqual(skipped, 0)
        self.assertEqual(len(kept), 6)

    def test_both_classes_survive_the_filter(self):
        """Penyaringan tidak boleh menghabiskan satu kelas diam diam.

        Kalau seluruh teks AI kebetulan lebih pendek dari batas penyedia,
        subsetnya jadi satu kelas dan ROC-AUC tidak terdefinisi. Lebih baik
        ketahuan dari jumlah yang tersisa daripada dari galat di akhir proses.
        """
        rows = _rows(3, 0, chars=400) + _rows(0, 3, chars=10)
        kept, skipped = evaluate_detector.eligible_rows(rows, _FakeDetector)
        self.assertEqual(skipped, 3)
        self.assertEqual({row["binary_label"] for row in kept}, {0})


if __name__ == "__main__":
    unittest.main()
