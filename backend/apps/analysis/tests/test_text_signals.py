"""Tes dua bug hitungan teks.

1. **Konektor dihitung ganda.** Pencocokan potongan membuat "menyebabkan"
   terhitung dua kali (memuat "sebab"), begitu juga "disebabkan" dan "oleh
   karena itu". Hitungan konektor dipakai E2, jadi satu kalimat sebab akibat
   bisa mendongkrak level Bloom.

2. **Keragaman kosakata jenuh pada jawaban pendek.** Rasio kata unik teks 60
   kata selalu tinggi secara alami, dan sinyalnya mentok 1,0. Jawaban jujur
   yang pendek terdorong ke band sedang hanya karena panjangnya.
"""
from __future__ import annotations

from django.test import SimpleTestCase

from apps.analysis.engines.ai_score import LEXICAL_MIN_WORDS, score_ai_probability, score_to_band
from apps.analysis.choices import AiBand
from apps.analysis.tests.test_analysis_decoupling import DEEP_HUMAN, SHALLOW_HUMAN
from apps.analysis.engines.text_features import extract_features


class CausalMarkerCountTest(SimpleTestCase):
    def assertCausal(self, text: str, expected: int):
        self.assertEqual(extract_features(text).causal_count, expected, text)

    def test_marker_containing_another_marker_counts_once(self):
        self.assertCausal("Hal ini menyebabkan inflasi yang tinggi.", 1)
        self.assertCausal("Kenaikan itu disebabkan oleh permintaan.", 1)
        self.assertCausal("Oleh karena itu, harga naik.", 1)
        self.assertCausal("Sebagai akibatnya, harga naik.", 1)

    def test_suffixed_forms_still_count(self):
        self.assertCausal("Karenanya kami menunda acara.", 1)

    def test_prefixed_forms_that_used_to_match_still_count(self):
        self.assertCausal("Dikarenakan hujan, acara ditunda.", 1)
        self.assertCausal("Penyebab utamanya adalah permintaan.", 1)

    def test_separate_connectors_are_all_counted(self):
        self.assertCausal(
            "Harga naik karena permintaan naik, sehingga inflasi meningkat.", 2
        )


class ShortAnswerLexicalTest(SimpleTestCase):
    @staticmethod
    def _lexical(text: str):
        result = score_ai_probability(extract_features(text))
        return next(s for s in result.breakdown if s.key == "lexical_uniformity")

    def test_short_answer_is_neutral(self):
        features = extract_features(SHALLOW_HUMAN)
        self.assertLess(features.word_count, LEXICAL_MIN_WORDS)
        signal = self._lexical(SHALLOW_HUMAN)
        self.assertEqual(signal.value, 0.5)
        self.assertIn("terlalu pendek", signal.evidence)

    def test_long_answer_is_still_measured(self):
        self.assertGreaterEqual(extract_features(DEEP_HUMAN).word_count, LEXICAL_MIN_WORDS)
        self.assertIn("Keragaman kosakata", self._lexical(DEEP_HUMAN).evidence)

    def test_short_honest_answer_is_not_pushed_out_of_low_band(self):
        """Fixture jujur 61 kata dulu berskor 50 (sedang) hanya karena pendek."""
        score = score_ai_probability(extract_features(SHALLOW_HUMAN)).score
        self.assertEqual(score_to_band(score), AiBand.LOW)


class BloomManipulationTest(SimpleTestCase):
    """M11: daftar konektor dan teks bahasa lain tidak boleh tampak sebagai penalaran tinggi."""

    def test_connector_stuffing_is_capped_and_low_confidence(self):
        from apps.analysis.engines.bloom import STUFFED_LEVEL_CAP, estimate_bloom_level
        from apps.analysis.engines.text_features import extract_features

        stuffed = ("oleh karena itu karena sehingga namun menilai merancang langkah pertama kemudian " * 45)
        result = estimate_bloom_level(extract_features(stuffed))
        self.assertLessEqual(result.level, STUFFED_LEVEL_CAP)
        self.assertEqual(result.confidence, "low")

    def test_english_text_is_flagged_as_rough(self):
        from apps.analysis.engines.bloom import estimate_bloom_level
        from apps.analysis.engines.text_features import extract_features

        english = ("The main reason the city grew quickly was the harbour, which brought merchants and workers from "
                   "many regions, and over time the market expanded into neighbouring towns as well. ") * 4
        result = estimate_bloom_level(extract_features(english))
        self.assertEqual(result.confidence, "low")
        self.assertIn("bukan bahasa Indonesia", result.evidence[0])

    def test_ordinary_indonesian_reasoning_is_untouched(self):
        from apps.analysis.engines.bloom import estimate_bloom_level
        from apps.analysis.engines.text_features import extract_features

        essay = (
            "Pertumbuhan kota ini dipengaruhi oleh pelabuhan karena pelabuhan menarik pedagang dari banyak daerah. "
            "Namun, pertumbuhan yang cepat juga menimbulkan masalah, sehingga pemerintah perlu menilai ulang kebijakan tata ruang. "
            "Menurut saya, pendekatan yang paling tepat adalah memperbaiki transportasi umum terlebih dahulu, "
            "kemudian menata permukiman di sekitar pelabuhan agar tidak padat. "
        ) * 3
        result = estimate_bloom_level(extract_features(essay))
        self.assertNotIn("bukan bahasa Indonesia", " ".join(result.evidence))
        self.assertNotIn("terlalu rapat", " ".join(result.evidence))


class RecommendationGapTest(SimpleTestCase):
    """Rekomendasi dulu selalu menulis "dua tingkat" untuk selisih berapa pun."""

    def test_gap_is_written_as_the_real_distance(self):
        from apps.analysis.engines.heuristic import build_recommendation

        self.assertIn("satu tingkat di bawah target L4", build_recommendation(AiBand.LOW, 3, 4))
        self.assertIn("dua tingkat di bawah target L4", build_recommendation(AiBand.LOW, 2, 4))
        text = build_recommendation(AiBand.LOW, 1, 5)
        self.assertIn("empat tingkat di bawah target L5", text)
        self.assertNotIn("dua tingkat", text)
