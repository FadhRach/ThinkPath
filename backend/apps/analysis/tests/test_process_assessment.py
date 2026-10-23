"""H8: pola pengerjaan sebagai bukti tersendiri, kalibrasi lonjakan, dan riwayat analisis."""
from __future__ import annotations

from unittest.mock import patch

from django.test import SimpleTestCase, TestCase

from apps.analysis import pipeline
from apps.analysis.engines.process_signals import (
    ProcessBand,
    ProcessContext,
    ProgressSample,
    assess_process,
    evaluate_process,
)
from apps.analysis.providers import groq

TEXT = (
    "Ketimpangan antarwilayah muncul karena investasi menumpuk di Jawa, sementara "
    "infrastruktur di luar Jawa tertinggal sehingga biaya logistik tinggi. " * 6
)


def ctx(samples, words=300, duration=900, inserted=0):
    return ProcessContext(
        duration_seconds=duration,
        revision_count=0,
        word_count=words,
        char_count=words * 6,
        progress=tuple(ProgressSample(t, w) for t, w in samples),
        inserted_words=inserted,
    )


class BurstCalibrationTest(SimpleTestCase):
    def test_gradual_typing_is_normal(self):
        samples = [(0, 0)] + [(30 * i, 20 * i) for i in range(1, 16)]
        self.assertEqual(assess_process(ctx(samples, words=300)).band, ProcessBand.NORMAL)

    def test_one_big_paste_between_close_samples_is_attention(self):
        samples = [(0, 0), (30, 20), (60, 40), (80, 340), (110, 345)]
        self.assertEqual(assess_process(ctx(samples, words=345)).band, ProcessBand.ATTENTION)

    def test_same_words_over_a_long_gap_is_not_a_burst(self):
        """60 kata dalam 5 menit = 12 kata/menit; dulu tetap dihitung lonjakan
        karena cuplikan server tidak berjarak tetap."""
        samples = [(0, 0), (60, 30), (120, 60), (420, 120), (480, 130)]
        self.assertEqual(assess_process(ctx(samples, words=130)).band, ProcessBand.NORMAL)

    def test_short_quote_is_tolerated(self):
        """Satu kutipan 60 kata di esai 400 kata (15%) tetap wajar."""
        samples = [(30 * i, 15 * i) for i in range(0, 12)] + [(360, 165 + 60)] + [(390 + 30 * i, 240 + 15 * i) for i in range(0, 10)]
        result = assess_process(ctx(samples, words=390))
        self.assertIn(result.band, (ProcessBand.NORMAL, ProcessBand.PARTIAL))

    def test_first_sample_that_already_holds_the_text_is_a_burst(self):
        samples = [(2, 400), (32, 402), (62, 405), (92, 405)]
        self.assertEqual(assess_process(ctx(samples, words=405)).band, ProcessBand.ATTENTION)


class DurationStateTest(SimpleTestCase):
    def test_short_answer_typed_fast_is_not_flagged(self):
        context = ProcessContext(duration_seconds=10, revision_count=0, word_count=20, char_count=140)
        self.assertEqual(assess_process(context).band, ProcessBand.NORMAL)

    def test_measured_zero_duration_with_long_text_is_attention(self):
        context = ProcessContext(duration_seconds=0, revision_count=0, word_count=250, char_count=1500)
        self.assertEqual(assess_process(context).band, ProcessBand.ATTENTION)

    def test_unknown_duration_is_unrecorded_not_accusing(self):
        context = ProcessContext(duration_seconds=None, revision_count=0, word_count=250, char_count=1500)
        self.assertEqual(assess_process(context).band, ProcessBand.UNRECORDED)

    def test_imported_answer_has_no_process_band(self):
        self.assertEqual(assess_process(None).band, ProcessBand.NOT_APPLICABLE)

    def test_words_swapped_in_through_a_revision_are_seen(self):
        samples = [(30 * i, 20 * i) for i in range(0, 16)]
        plain = evaluate_process(ctx(samples, words=300))[0]
        swapped = evaluate_process(ctx(samples, words=300, inserted=280))[0]
        self.assertLess(plain, 0.35)
        self.assertGreaterEqual(swapped, 0.6)


class HonestWordPasteTest(SimpleTestCase):
    """Mahasiswa jujur menempel dari Word: pita skor AI tidak boleh berubah."""

    def test_band_is_identical_with_and_without_a_paste_burst(self):
        paste = ProcessContext(duration_seconds=0, revision_count=0, word_count=len(TEXT.split()), char_count=len(TEXT))
        without = pipeline.run_analysis(TEXT, "S1", 4, None, allow_external=False)
        with_paste = pipeline.run_analysis(TEXT, "S1", 4, paste, allow_external=False)
        self.assertEqual(without["ai_score"], with_paste["ai_score"])
        self.assertEqual(without["ai_band"], with_paste["ai_band"])
        self.assertEqual(with_paste["process_band"], ProcessBand.ATTENTION)
        self.assertEqual(without["process_band"], ProcessBand.NOT_APPLICABLE)
        self.assertIn("tiba sekaligus", with_paste["process_evidence"])


class DeterministicGroqTest(SimpleTestCase):
    def test_temperature_is_zero(self):
        class Fake:
            def raise_for_status(self): ...
            def json(self): return {"choices": [{"message": {"content": "{}"}}]}

        with patch.dict("os.environ", {"GROQ_API_KEY": "k"}), patch.object(groq.requests, "post", return_value=Fake()) as post:
            groq.call(TEXT, "S1")
        self.assertEqual(post.call_args.kwargs["json"]["temperature"], 0)
