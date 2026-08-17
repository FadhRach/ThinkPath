"""Tes kerangka bersama skrip evaluasi.

Dulu tiap skrip punya salinan sendiri dari penyeimbangan sampel dan cache skor.
Dua salinan aturan yang sama pasti akan berbeda seiring waktu, dan yang paling
berbahaya kalau sampai berbeda adalah penyeimbangan sampel: dua skrip yang
mengambil subset dengan cara berbeda akan melaporkan ROC-AUC yang tidak bisa
dibandingkan sama sekali, tanpa satu pun gejala.

Jalankan dari folder ai_experiment:

    python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.evaluation import ScoreCache, balanced_sample  # noqa: E402


def _rows(n_human: int, n_ai: int) -> list[dict]:
    rows = [{"text": f"manusia {i}", "binary_label": 0} for i in range(n_human)]
    rows += [{"text": f"ai {i}", "binary_label": 1} for i in range(n_ai)]
    return rows


class BalancedSampleTest(unittest.TestCase):
    def test_takes_both_classes_even_when_input_is_sorted(self):
        """Gold set tersimpan manusia dulu, jadi pengambilan naif akan satu kelas."""
        sample = balanced_sample(_rows(500, 499), 200)
        labels = [row["binary_label"] for row in sample]
        self.assertEqual(len(sample), 200)
        self.assertEqual(labels.count(0), 100)
        self.assertEqual(labels.count(1), 100)

    def test_odd_limit_does_not_lose_a_sample(self):
        self.assertEqual(len(balanced_sample(_rows(50, 50), 7)), 7)

    def test_limit_zero_means_everything(self):
        self.assertEqual(len(balanced_sample(_rows(10, 10), 0)), 20)

    def test_limit_larger_than_corpus_means_everything(self):
        self.assertEqual(len(balanced_sample(_rows(3, 3), 999)), 6)

    def test_lopsided_corpus_still_returns_both_classes(self):
        sample = balanced_sample(_rows(100, 4), 20)
        labels = [row["binary_label"] for row in sample]
        self.assertGreater(labels.count(0), 0)
        self.assertGreater(labels.count(1), 0)

    def test_is_deterministic_so_the_cache_actually_hits(self):
        rows = _rows(100, 100)
        first = [row["text"] for row in balanced_sample(rows, 30)]
        second = [row["text"] for row in balanced_sample(rows, 30)]
        self.assertEqual(first, second)

    def test_every_prefix_is_roughly_balanced(self):
        """Inti dari kalibrasi yang dicicil lintas hari.

        Kedua skrip pemakai pasti berhenti di tengah jalan: kredit detektor
        habis, atau jatah token harian Groq tersentuh. Kalau potongan awalnya
        satu kelas saja, cache terlihat terisi tetapi tidak bisa menghasilkan
        satu angka pun, dan itu baru ketahuan setelah kuotanya habis.
        """
        sample = balanced_sample(_rows(500, 499), 60)
        for cut in range(2, len(sample) + 1):
            labels = [row["binary_label"] for row in sample[:cut]]
            with self.subTest(cut=cut):
                self.assertLessEqual(
                    abs(labels.count(0) - labels.count(1)),
                    1,
                    f"potongan {cut} sampel pertama timpang: {labels}",
                )

    def test_interleaving_survives_a_lopsided_corpus(self):
        sample = balanced_sample(_rows(100, 4), 20)
        labels = [row["binary_label"] for row in sample]
        self.assertEqual(labels[:8], [0, 1, 0, 1, 0, 1, 0, 1])
        self.assertEqual(labels.count(1), 4)


class ScoreCacheTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.cache = ScoreCache(Path(self._tmp.name) / "scores.jsonl")

    def test_round_trip(self):
        self.cache.append("abc", 0.42)
        self.assertEqual(self.cache.load(), {"abc": 0.42})

    def test_missing_file_is_empty_not_an_error(self):
        self.assertEqual(self.cache.load(), {})

    def test_corrupt_line_is_skipped_not_fatal(self):
        """Cache adalah penghemat biaya, bukan sumber kebenaran."""
        self.cache.path.write_text(
            '{"key": "a", "score": 0.1}\nbukan json\n{"key": "b", "score": 0.9}\n',
            encoding="utf-8",
        )
        self.assertEqual(self.cache.load(), {"a": 0.1, "b": 0.9})

    def test_appending_survives_a_process_that_dies_midway(self):
        """Ditambah baris demi baris, bukan ditulis ulang di akhir."""
        self.cache.append("a", 0.1)
        self.cache.append("b", 0.2)
        self.assertEqual(self.cache.load(), {"a": 0.1, "b": 0.2})

    def test_same_parts_give_the_same_key(self):
        self.assertEqual(
            ScoreCache.key("model", "teks"), ScoreCache.key("model", "teks")
        )

    def test_changing_any_part_changes_the_key(self):
        """Model dan versi ikut ke dalam kunci.

        Tanpa itu, mengganti model akan membaca skor model lama dari cache dan
        melaporkannya sebagai hasil model baru.
        """
        base = ScoreCache.key("model-a", "4.18", "teks")
        self.assertNotEqual(base, ScoreCache.key("model-b", "4.18", "teks"))
        self.assertNotEqual(base, ScoreCache.key("model-a", "5.00", "teks"))
        self.assertNotEqual(base, ScoreCache.key("model-a", "4.18", "teks lain"))

    def test_parts_cannot_be_confused_by_concatenation(self):
        """("ab", "c") dan ("a", "bc") adalah dua hal berbeda."""
        self.assertNotEqual(ScoreCache.key("ab", "c"), ScoreCache.key("a", "bc"))


if __name__ == "__main__":
    unittest.main()
