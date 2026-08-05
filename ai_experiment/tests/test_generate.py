"""Tes pembersihan keluaran model.

Contoh di berkas ini diambil dari keluaran nyata saat uji ujung ke ujung, bukan
karangan. Artefak seperti ini pernah lolos, dan kalau lolos ke dataset maka
detektor belajar mengenali penanda format alih alih mengenali teks AI.

Jalankan dari folder ai_experiment:

    python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.generate import clean_generated  # noqa: E402


class ThinkBlockTest(unittest.TestCase):
    def test_removes_closed_think_block(self):
        raw = (
            "<think>\nHere's a thinking process:\n1. Analyze User Input\n</think>\n"
            "Psikologi perkembangan mempelajari perubahan perilaku manusia."
        )
        cleaned = clean_generated(raw)
        self.assertNotIn("think", cleaned.lower())
        self.assertNotIn("Analyze User Input", cleaned)
        self.assertTrue(cleaned.startswith("Psikologi perkembangan"))

    def test_removes_unclosed_think_block(self):
        """Sebagian model terpotong sebelum menutup tagnya."""
        raw = "<think> Here is my reasoning about the topic Isi abstrak sebenarnya."
        cleaned = clean_generated(raw)
        self.assertNotIn("<think", cleaned.lower())

    def test_plain_text_is_untouched(self):
        raw = "Penelitian ini membahas metode kualitatif secara mendalam."
        self.assertEqual(clean_generated(raw), raw)


class LeadLabelTest(unittest.TestCase):
    def test_removes_markdown_heading_label(self):
        raw = "**Abstrak**\n\nPenelitian ini dilatarbelakangi oleh meningkatnya kebutuhan."
        cleaned = clean_generated(raw)
        self.assertTrue(cleaned.startswith("Penelitian ini dilatarbelakangi"))

    def test_removes_stacked_title_and_abstract_labels(self):
        raw = (
            "Judul: Pengantar Metode Penelitian Hukum\n\n"
            "Abstrak:\n\n"
            "Penelitian ini bertujuan untuk membahas metode penelitian hukum."
        )
        cleaned = clean_generated(raw)
        self.assertNotIn("Judul:", cleaned)
        self.assertNotIn("Abstrak:", cleaned)
        self.assertTrue(cleaned.startswith("Penelitian ini bertujuan"))

    def test_does_not_eat_body_text_that_mentions_abstrak(self):
        """Kata "abstrak" di tengah kalimat bukan label dan harus dibiarkan."""
        raw = "Metode kualitatif sering dianggap abstrak dibandingkan kuantitatif."
        self.assertEqual(clean_generated(raw), raw)

    def test_does_not_eat_sentence_starting_with_label_word(self):
        """Abstrak yang diawali kata "Ringkasan" tetap utuh.

        Label hanya dianggap label kalau diikuti titik dua atau berakhir baris.
        """
        raw = "Ringkasan penelitian ini membahas dampak kebijakan subsidi energi."
        self.assertEqual(clean_generated(raw), raw)


class MarkdownTest(unittest.TestCase):
    def test_strips_emphasis_marks(self):
        raw = "Penelitian ini **penting** karena _relevan_ dengan `praktik` lapangan."
        cleaned = clean_generated(raw)
        for mark in ("*", "_", "`"):
            self.assertNotIn(mark, cleaned)
        self.assertIn("penting", cleaned)

    def test_collapses_whitespace(self):
        raw = "Kalimat   pertama.\n\n\nKalimat kedua."
        self.assertEqual(clean_generated(raw), "Kalimat pertama. Kalimat kedua.")


if __name__ == "__main__":
    unittest.main()
