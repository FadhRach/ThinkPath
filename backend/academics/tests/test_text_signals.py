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

from academics.ai_score import LEXICAL_MIN_WORDS, score_ai_probability, score_to_band
from academics.models import AiBand
from academics.tests.test_analysis_decoupling import DEEP_HUMAN, SHALLOW_HUMAN
from academics.text_features import extract_features


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
