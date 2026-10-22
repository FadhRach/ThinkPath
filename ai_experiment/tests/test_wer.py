"""Tes metrik ASR: jawabannya diketahui, jadi tinggal dicocokkan."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.asr import wer  # noqa: E402


class WordErrorTest(unittest.TestCase):
    def test_identical_text_has_no_errors(self):
        self.assertEqual(wer.word_errors("Saya memilih rekursi.", "saya memilih rekursi"), (0, 3))

    def test_substitution_insertion_and_deletion_each_cost_one(self):
        self.assertEqual(wer.word_errors("a b c d", "a x c d"), (1, 4))  # ganti
        self.assertEqual(wer.word_errors("a b c d", "a b c d e"), (1, 4))  # sisip
        self.assertEqual(wer.word_errors("a b c d", "a b d"), (1, 4))  # hapus

    def test_case_and_punctuation_do_not_count(self):
        self.assertEqual(wer.word_errors("Halo, Dunia!", "halo dunia"), (0, 2))

    def test_empty_hypothesis_is_all_deletions(self):
        self.assertEqual(wer.word_errors("satu dua tiga", ""), (3, 3))

    def test_digits_are_not_converted_to_words(self):
        """Disengaja: referensi harus menulis angka sebagai digit (lihat protokol)."""
        self.assertEqual(wer.word_errors("ada 5 orang", "ada lima orang"), (1, 3))

    def test_character_errors(self):
        self.assertEqual(wer.char_errors("abc", "abd"), (1, 3))


class CorpusRateTest(unittest.TestCase):
    def test_weights_by_reference_length_not_by_clip(self):
        # Klip pendek 1 galat dari 2 kata, klip panjang 1 galat dari 98: korpus = 2/100, bukan rata-rata 26%.
        self.assertAlmostEqual(wer.corpus_rate([(1, 2), (1, 98)]), 0.02)

    def test_no_reference_words_is_nan_not_zero(self):
        self.assertNotEqual(wer.corpus_rate([]), 0.0)


class TermRecallTest(unittest.TestCase):
    def test_counts_whole_terms_found(self):
        self.assertEqual(wer.term_recall(["rekursi", "hash map"], "saya pakai Hash-Map dan rekursi"), 1.0)
        self.assertEqual(wer.term_recall(["rekursi", "pohon biner"], "saya pakai rekursi saja"), 0.5)

    def test_no_terms_means_not_applicable(self):
        self.assertIsNone(wer.term_recall([], "apa saja"))


class BootstrapTest(unittest.TestCase):
    def test_too_few_clips_gives_no_interval(self):
        self.assertIsNone(wer.bootstrap_ci([(1, 10)] * 4))

    def test_interval_brackets_the_estimate_and_is_reproducible(self):
        pairs = [(i % 4, 20) for i in range(30)]
        low, high = wer.bootstrap_ci(pairs)
        self.assertLessEqual(low, wer.corpus_rate(pairs))
        self.assertGreaterEqual(high, wer.corpus_rate(pairs))
        self.assertEqual(wer.bootstrap_ci(pairs), (low, high))


if __name__ == "__main__":
    unittest.main()
