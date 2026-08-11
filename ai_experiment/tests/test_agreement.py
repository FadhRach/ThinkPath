"""Tes kesepakatan antar penilai dan metrik klasifikasi.

Kappa itu mudah salah dan salahnya tidak kelihatan: rumusnya tetap
mengembalikan angka yang tampak masuk akal. Karena itu nilai yang diuji di sini
dipilih supaya bisa dihitung tangan dan diperiksa ulang.

Jalankan dari folder ai_experiment:

    python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.agreement import compare_raters, score_predictions  # noqa: E402


class PerfectAndRandomTest(unittest.TestCase):
    def test_perfect_agreement_is_one(self):
        labels = {"a": "1", "b": "3", "c": "5"}
        report = compare_raters(labels, dict(labels))
        self.assertEqual(report.observed, 1.0)
        self.assertAlmostEqual(report.kappa, 1.0)
        self.assertAlmostEqual(report.weighted_kappa, 1.0)

    def test_chance_level_agreement_is_near_zero(self):
        """Dua penilai yang sama sama memakai C1 dan C2 setengah setengah,
        tetapi tidak berkorelasi, harus mendekati nol meski sepakat 50%."""
        a = {str(i): "1" if i % 2 == 0 else "2" for i in range(100)}
        b = {str(i): "1" if i % 4 < 2 else "2" for i in range(100)}
        report = compare_raters(a, b)
        self.assertAlmostEqual(report.observed, 0.5, places=2)
        self.assertLess(abs(report.kappa), 0.1)

    def test_total_disagreement_is_negative(self):
        a = {"a": "1", "b": "1", "c": "2", "d": "2"}
        b = {"a": "2", "b": "2", "c": "1", "d": "1"}
        report = compare_raters(a, b)
        self.assertLess(report.kappa, 0)
        self.assertIn("acak", report.interpretation)


def _shifted(base: list[str], step: int, every: int = 3) -> dict[str, str]:
    """Geser sebagian label sejauh `step` tingkat, sisanya dibiarkan sama."""
    out = list(base)
    for i in range(0, len(base), every):
        out[i] = str(min(6, int(base[i]) + step))
    return {str(i): v for i, v in enumerate(out)}


class OrdinalWeightingTest(unittest.TestCase):
    """Inti dari mengapa kappa berbobot ikut dilaporkan.

    Marginal sengaja dibuat beragam. Kalau salah satu penilai memakai satu
    kategori saja, kappa runtuh ke nol berapa pun jaraknya, dan perbandingan
    apa pun menjadi tidak berarti. Lihat DegenerateMarginalTest di bawah.
    """

    BASE = list("123456") * 3

    def test_plain_kappa_cannot_tell_near_from_far(self):
        """Justru inilah kelemahan kappa biasa pada skala berurutan.

        Dua situasi dengan tingkat kesepakatan persis sama, tetapi yang satu
        selalu meleset satu tingkat dan yang lain selalu meleset tiga tingkat,
        menghasilkan kappa biasa yang identik.
        """
        base = {str(i): v for i, v in enumerate(self.BASE)}
        near = compare_raters(base, _shifted(self.BASE, 1))
        far = compare_raters(base, _shifted(self.BASE, 3))

        self.assertAlmostEqual(near.observed, far.observed)
        self.assertAlmostEqual(near.kappa, far.kappa)

    def test_weighted_kappa_separates_near_from_far(self):
        base = {str(i): v for i, v in enumerate(self.BASE)}
        near = compare_raters(base, _shifted(self.BASE, 1))
        far = compare_raters(base, _shifted(self.BASE, 3))

        self.assertGreater(near.weighted_kappa, far.weighted_kappa)
        # Selisihnya harus besar, bukan sekadar lolos ambang.
        self.assertGreater(near.weighted_kappa - far.weighted_kappa, 0.2)

    def test_weighted_is_kinder_than_plain_on_adjacent_errors(self):
        """Ketidaksepakatan yang selalu bersebelahan tidak seburuk yang
        digambarkan kappa biasa."""
        a = {str(i): v for i, v in enumerate("112233445566")}
        b = {str(i): v for i, v in enumerate("122233445566")}
        report = compare_raters(a, b)
        self.assertGreater(report.weighted_kappa, report.kappa)


class DegenerateMarginalTest(unittest.TestCase):
    """Paradoks kappa, didokumentasikan supaya tidak mengagetkan nanti.

    Kalau seorang penilai memakai satu kategori saja untuk semua item,
    kesepakatan yang diharapkan secara kebetulan menjadi sama dengan
    kesepakatan yang teramati, sehingga kappa runtuh ke nol. Itu perilaku
    matematis yang benar, bukan bug, tetapi mudah disalahartikan sebagai
    "penilainya acak".

    Kalau ini muncul saat kalibrasi, penyebabnya hampir pasti penilai yang
    memilih level yang sama berulang kali karena lelah. Istirahat, jangan
    ganti rumusnya.
    """

    def test_constant_rater_yields_zero_regardless_of_distance(self):
        near = compare_raters(
            {str(i): "3" for i in range(20)}, {str(i): "4" for i in range(20)}
        )
        far = compare_raters(
            {str(i): "3" for i in range(20)}, {str(i): "6" for i in range(20)}
        )
        self.assertAlmostEqual(near.kappa, 0.0)
        self.assertAlmostEqual(far.kappa, 0.0)


class UnrateableTest(unittest.TestCase):
    def test_x_is_excluded_not_counted_as_disagreement(self):
        """X berarti tidak ada data, bukan level nol.

        Memaksanya masuk skala akan mengotori seluruh perhitungan.
        """
        a = {"a": "3", "b": "X", "c": "4"}
        b = {"a": "3", "b": "2", "c": "4"}
        report = compare_raters(a, b)
        self.assertEqual(report.n, 2)
        self.assertEqual(report.excluded, 1)
        self.assertEqual(report.observed, 1.0)

    def test_items_only_one_rater_saw_are_ignored(self):
        a = {"a": "3", "b": "4"}
        b = {"a": "3", "c": "5"}
        report = compare_raters(a, b)
        self.assertEqual(report.n, 1)


class DisagreementListTest(unittest.TestCase):
    def test_sorted_by_distance_descending(self):
        a = {"dekat": "3", "jauh": "1", "sedang": "2"}
        b = {"dekat": "4", "jauh": "6", "sedang": "4"}
        report = compare_raters(a, b)
        self.assertEqual([d[0] for d in report.disagreements], ["jauh", "sedang", "dekat"])


class ClassificationTest(unittest.TestCase):
    def test_accuracy_and_adjacent_accuracy(self):
        gold = {"a": "3", "b": "3", "c": "3", "d": "3"}
        pred = {"a": "3", "b": "4", "c": "2", "d": "6"}
        report = score_predictions(gold, pred)
        self.assertAlmostEqual(report.accuracy, 0.25)
        # a tepat, b dan c meleset satu, d meleset tiga.
        self.assertAlmostEqual(report.adjacent_accuracy, 0.75)

    def test_macro_f1_ignores_labels_absent_from_gold(self):
        """Level yang tidak pernah muncul di acuan tidak boleh dihitung nol.

        Menghukum sistem karena ketiadaan data bukan pengukuran, itu kebetulan.
        """
        gold = {"a": "3", "b": "3", "c": "4", "d": "4"}
        pred = dict(gold)
        report = score_predictions(gold, pred)
        self.assertAlmostEqual(report.macro_f1, 1.0)
        self.assertEqual(report.per_label["1"]["support"], 0)

    def test_per_label_precision_and_recall(self):
        gold = {"a": "3", "b": "3", "c": "4"}
        pred = {"a": "3", "b": "4", "c": "4"}
        report = score_predictions(gold, pred)
        c3 = report.per_label["3"]
        self.assertAlmostEqual(c3["precision"], 1.0)
        self.assertAlmostEqual(c3["recall"], 0.5)
        c4 = report.per_label["4"]
        self.assertAlmostEqual(c4["precision"], 0.5)
        self.assertAlmostEqual(c4["recall"], 1.0)

    def test_empty_overlap_returns_nan(self):
        report = score_predictions({"a": "3"}, {"b": "3"})
        self.assertEqual(report.n, 0)
        self.assertNotEqual(report.accuracy, report.accuracy)


if __name__ == "__main__":
    unittest.main()
