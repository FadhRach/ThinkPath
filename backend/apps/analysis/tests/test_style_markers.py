"""Tes penanda gaya dan kemiripan: contoh nyata salinan obrolan AI, dan tulisan manusia yang
tidak boleh ikut terjaring."""
from __future__ import annotations

from django.test import SimpleTestCase

from apps.analysis.engines.similarity import most_similar, shingles, similarity
from apps.analysis.engines.style_markers import find_style_markers

CLAUDE_PASTE = """Claude menerapkan sistem penandaan (watermarking) pada konten yang dihasilkannya:
• Tanda Air Teks (Text Watermarking): Model AI diprogram untuk menyisipkan pola statistik tertentu.
• Kepatuhan Regulasi: Sistem ini dikembangkan untuk mematuhi regulasi seperti EU AI Act.
• Deteksi dan Verifikasi: Penandaan ini tidak selalu terlihat — namun dapat dideteksi alat khusus.
Jika Anda ingin mendalami salah satunya, beri tahu saya:
"""

HUMAN_ESSAY = (
    "Menurut saya, ketimpangan antarwilayah muncul karena investasi menumpuk di kota besar. "
    "Pada praktikum kemarin, kelompok kami menghitung rasio gini dan hasilnya berbeda dari buku. "
    "Namun, data hanya dari satu provinsi, jadi kesimpulannya masih perlu diuji."
)


def keys(result):
    return {marker["key"] for marker in result["markers"]}


class StyleMarkersTest(SimpleTestCase):
    def test_pasted_chat_output_is_flagged_with_strong_markers(self):
        result = find_style_markers(CLAUDE_PASTE)
        self.assertTrue({"bullet_symbol", "closing_offer"} <= keys(result))
        self.assertGreaterEqual(result["strong_total"], 4)
        # Label berhuruf besar + titik dua berulang tiga kali: tercatat sebagai gaya (lemah).
        self.assertIn("colon_label", keys(result))

    def test_human_academic_text_is_not_flagged(self):
        result = find_style_markers(HUMAN_ESSAY)
        self.assertEqual(result["markers"], [])
        self.assertEqual(result["strong_total"], 0)

    def test_markdown_and_emoji_and_invisible_characters(self):
        text = "## Kesimpulan\nIni **sangat penting** ✅ dan​ tersembunyi."
        found = keys(find_style_markers(text))
        self.assertTrue({"markdown", "emoji", "invisible"} <= found)

    def test_single_dash_or_colon_is_not_enough(self):
        text = "Faktor utamanya adalah biaya: sewa tanah sangat mahal. Hasilnya berbeda — sedikit saja."
        self.assertNotIn("colon_label", keys(find_style_markers(text)))
        self.assertNotIn("dash", keys(find_style_markers(text)))

    def test_spans_point_into_the_same_text(self):
        result = find_style_markers(CLAUDE_PASTE)
        for span in result["spans"]:
            self.assertLess(span["start"], span["end"])
            self.assertLessEqual(span["end"], len(CLAUDE_PASTE))
        bullets = [s for s in result["spans"] if s["key"] == "bullet_symbol"]
        self.assertEqual(CLAUDE_PASTE[bullets[0]["start"] : bullets[0]["end"]], "•")

    def test_plain_academic_phrases_do_not_trigger_closing_offer(self):
        text = "Berikut ini adalah faktor yang dianalisis. Dengan demikian hipotesis diterima."
        self.assertNotIn("closing_offer", keys(find_style_markers(text)))


class SimilarityTest(SimpleTestCase):
    BASE = (
        "ketimpangan antarwilayah muncul karena investasi menumpuk di kota besar sementara daerah "
        "lain tertinggal jauh dalam hal infrastruktur dan layanan dasar bagi masyarakat setempat"
    )

    def test_copy_is_found_and_independent_text_is_not(self):
        copy = self.BASE + " serta akses pendidikan yang timpang"
        other = (
            "menurut pengamatan saya di lapangan harga komoditas berubah cepat sehingga petani "
            "kecil sulit menyesuaikan pola tanam setiap musim hujan datang"
        )
        found = most_similar(self.BASE, [("a", "Salin", copy), ("b", "Mandiri", other)])
        self.assertEqual([row["student_name"] for row in found], ["Salin"])
        self.assertGreater(found[0]["score"], 0.5)

    def test_short_texts_are_ignored(self):
        self.assertEqual(most_similar("terlalu pendek sekali", [("a", "A", "terlalu pendek sekali")]), [])

    def test_symmetry(self):
        a, b = shingles(self.BASE), shingles(self.BASE + " tambahan kata baru di akhir kalimat ini")
        self.assertAlmostEqual(similarity(a, b), similarity(b, a))
