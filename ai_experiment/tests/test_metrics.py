"""Tes metrik evaluasi.

Kalau roc_auc atau false_positive_rate salah, seluruh angka yang dilaporkan ke
naskah ikut salah tanpa ada yang menyadarinya. Nilai yang diuji di sini dipilih
karena jawabannya bisa dihitung tangan.

Jalankan dari folder ai_experiment:

    python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.metrics import (  # noqa: E402
    confusion_at,
    pearson,
    roc_auc,
    threshold_at_max_fpr,
)


class RocAucTest(unittest.TestCase):
    def test_perfect_separation_is_one(self):
        scores = [10.0, 20.0, 80.0, 90.0]
        labels = [0, 0, 1, 1]
        self.assertAlmostEqual(roc_auc(scores, labels), 1.0)

    def test_reversed_separation_is_zero(self):
        """Di bawah 0,5 berarti sinyalnya menunjuk arah yang salah."""
        scores = [90.0, 80.0, 20.0, 10.0]
        labels = [0, 0, 1, 1]
        self.assertAlmostEqual(roc_auc(scores, labels), 0.0)

    def test_all_tied_is_half(self):
        """Semua skor sama berarti tidak ada informasi sama sekali."""
        scores = [50.0, 50.0, 50.0, 50.0]
        labels = [0, 0, 1, 1]
        self.assertAlmostEqual(roc_auc(scores, labels), 0.5)

    def test_partial_overlap(self):
        scores = [10.0, 60.0, 40.0, 90.0]
        labels = [0, 0, 1, 1]
        self.assertAlmostEqual(roc_auc(scores, labels), 0.75)

    def test_single_class_returns_nan(self):
        self.assertNotEqual(roc_auc([1.0, 2.0], [1, 1]), roc_auc([1.0, 2.0], [1, 1]))


class ConfusionTest(unittest.TestCase):
    def test_counts_are_correct(self):
        scores = [80.0, 20.0, 90.0, 10.0]
        labels = [1, 1, 0, 0]
        report = confusion_at(scores, labels, 50)
        self.assertEqual(report.true_positive, 1)
        self.assertEqual(report.false_negative, 1)
        self.assertEqual(report.false_positive, 1)
        self.assertEqual(report.true_negative, 1)

    def test_false_positive_rate_counts_only_humans(self):
        """FPR harus dihitung terhadap jumlah manusia, bukan seluruh sampel."""
        scores = [90.0, 90.0, 90.0, 10.0]
        labels = [1, 0, 0, 0]
        report = confusion_at(scores, labels, 50)
        self.assertEqual(report.false_positive, 2)
        self.assertEqual(report.true_negative, 1)
        self.assertAlmostEqual(report.false_positive_rate, 2 / 3)

    def test_f1_matches_hand_calculation(self):
        scores = [80.0, 80.0, 80.0, 10.0]
        labels = [1, 1, 0, 0]
        report = confusion_at(scores, labels, 50)
        self.assertAlmostEqual(report.precision, 2 / 3)
        self.assertAlmostEqual(report.recall, 1.0)
        self.assertAlmostEqual(report.f1, 0.8)


class ThresholdTest(unittest.TestCase):
    def test_picks_threshold_that_respects_fpr_budget(self):
        """Sepuluh manusia berskor 40, sepuluh AI berskor 80.

        Ambang 41 sampai 80 menjaga FPR nol. Fungsi harus memilih yang terendah
        supaya recall setinggi mungkin tanpa melanggar batas.
        """
        scores = [40.0] * 10 + [80.0] * 10
        labels = [0] * 10 + [1] * 10
        threshold, report = threshold_at_max_fpr(scores, labels, max_fpr=0.05)
        self.assertEqual(threshold, 41)
        self.assertAlmostEqual(report.false_positive_rate, 0.0)
        self.assertAlmostEqual(report.recall, 1.0)

    def test_never_exceeds_the_budget(self):
        scores = [30.0, 45.0, 55.0, 70.0, 85.0, 95.0]
        labels = [0, 0, 0, 1, 1, 1]
        _, report = threshold_at_max_fpr(scores, labels, max_fpr=0.05)
        self.assertLessEqual(report.false_positive_rate, 0.05)


class PearsonTest(unittest.TestCase):
    def test_perfect_positive(self):
        self.assertAlmostEqual(pearson([1.0, 2.0, 3.0], [2.0, 4.0, 6.0]), 1.0)

    def test_perfect_negative(self):
        self.assertAlmostEqual(pearson([1.0, 2.0, 3.0], [6.0, 4.0, 2.0]), -1.0)

    def test_constant_signal_is_zero(self):
        """Sinyal yang nilainya sama untuk semua sampel tidak membawa informasi.

        Inilah yang ditunggu dari diagnostik: sinyal seperti ini harus muncul
        sebagai nol supaya ketahuan layak dibuang.
        """
        self.assertEqual(pearson([0.5, 0.5, 0.5, 0.5], [0.0, 1.0, 0.0, 1.0]), 0.0)


if __name__ == "__main__":
    unittest.main()
