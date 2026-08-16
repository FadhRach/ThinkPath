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

from src.generate import clean_generated, is_daily_quota  # noqa: E402


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

    def test_keeps_body_when_label_and_abstract_share_one_line(self):
        """Kasus nyata yang sempat menghentikan pembangunan gold set.

        Model membalas seluruh abstrak dalam satu baris yang diawali
        "Abstrak: ". Pola lama membuang sampai akhir baris, yaitu seluruh teks,
        sehingga hasilnya nol kata dan sampelnya hilang. Kegagalannya
        sistematis pada satu kombinasi model dan varian prompt, bukan acak.
        """
        raw = (
            "Abstrak: Penelitian ini bertujuan menerapkan metode waterfall "
            "pada desain sistem informasi geografis industri."
        )
        cleaned = clean_generated(raw)
        self.assertFalse(cleaned.startswith("Abstrak"))
        self.assertTrue(cleaned.startswith("Penelitian ini bertujuan"))
        self.assertIn("sistem informasi geografis industri", cleaned)

    def test_title_line_is_dropped_but_abstract_body_survives(self):
        """Dua label, dua nasib berbeda, keduanya satu baris.

        Isi setelah "Judul:" adalah metadata dan harus hilang. Isi setelah
        "Abstrak:" adalah abstraknya sendiri dan harus bertahan.
        """
        raw = (
            "Judul: Sistem Informasi Geografis Industri\n"
            "Abstrak: Penelitian ini mengkaji dampak kebijakan subsidi energi."
        )
        cleaned = clean_generated(raw)
        self.assertNotIn("Sistem Informasi Geografis", cleaned)
        self.assertEqual(
            cleaned, "Penelitian ini mengkaji dampak kebijakan subsidi energi."
        )

    def test_fix_applies_to_every_label_word(self):
        """Perbaikannya bukan tambalan khusus kata "Abstrak"."""
        raw = "Ringkasan: Penelitian ini mengkaji dampak kebijakan subsidi energi."
        self.assertEqual(
            clean_generated(raw),
            "Penelitian ini mengkaji dampak kebijakan subsidi energi.",
        )


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


class DailyQuotaTest(unittest.TestCase):
    """Groq menjawab 429 untuk dua hal yang penanganannya berlawanan.

    Batas per menit pulih dalam hitungan detik dan layak ditunggu. Batas harian
    tidak pulih berapa kali pun diulang, dan membedakannya menentukan apakah
    menjalankan ulang sekarang ada gunanya. Pembangunan gold set pernah
    membuang lima percobaan berbackoff untuk masing masing dari 30 sampel
    karena keduanya terlihat identik.
    """

    # Disalin apa adanya dari balasan Groq yang sebenarnya.
    TPD = (
        "Rate limit reached for model `llama-3.3-70b-versatile` in organization "
        "`org_x` service tier `on_demand` on tokens per day (TPD): Limit 100000, "
        "Used 99873, Requested 623."
    )
    TPM = "Rate limit reached for model `x` on tokens per minute (TPM): Limit 12000."

    def test_daily_quota_is_recognised(self):
        self.assertTrue(is_daily_quota(self.TPD))

    def test_per_minute_limit_is_not_mistaken_for_daily(self):
        self.assertFalse(is_daily_quota(self.TPM))

    def test_empty_body_is_not_daily(self):
        """Penyedia bisa menjawab 429 tanpa isi. Menebaknya harian akan menghentikan proses tanpa alasan."""
        self.assertFalse(is_daily_quota(""))


if __name__ == "__main__":
    unittest.main()
