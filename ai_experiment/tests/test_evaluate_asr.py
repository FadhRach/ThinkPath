"""Tes skrip evaluasi ASR tanpa jaringan: pembaca manifest, ringkasan, dan laporan."""
from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import evaluate_asr  # noqa: E402
from src.asr import adapters  # noqa: E402
from src.evaluation import ScoreCache  # noqa: E402


def clip(clip_id, style="spontan", ref="saya memilih rekursi", hyp="saya memilih rekursi", raw=None, **extra):
    return {
        "clip_id": clip_id, "language": "id", "device": "laptop", "noise": "tenang", "style": style,
        "reference_text": ref, "keyterms": ["rekursi"], "duration_s": 10.0, "seconds": 2.0,
        "hyp": hyp, "raw": hyp if raw is None else raw, **extra,
    }


class SummarizeTest(unittest.TestCase):
    def test_silent_clips_are_not_in_wer_but_measure_hallucination(self):
        results = [
            clip("a", hyp="saya memilih rekursi"),
            clip("b", hyp="saya memilih iterasi"),  # 1 galat dari 3
            clip("s1", style="silence", ref="", hyp="", raw="Terima kasih."),  # dibuang filter
            clip("s2", style="silence", ref="", hyp="Terima kasih.", raw="Terima kasih."),  # lolos filter
        ]
        s = evaluate_asr.summarize(results)
        self.assertEqual(s["clips"], 2)
        self.assertAlmostEqual(s["wer"], 1 / 6)
        self.assertEqual(s["silent_clips"], 2)
        self.assertEqual(s["hallucination_raw"], 1.0)
        self.assertEqual(s["hallucination_filtered"], 0.5)

    def test_no_silent_clips_gives_no_hallucination_figure(self):
        self.assertIsNone(evaluate_asr.summarize([clip("a")])["hallucination_raw"])

    def test_rtf_is_processing_time_over_audio_duration(self):
        self.assertAlmostEqual(evaluate_asr.summarize([clip("a")])["rtf"], 0.2)


class ReportTest(unittest.TestCase):
    def test_report_has_overall_and_group_sections_and_limitations(self):
        rows = [clip("a"), clip("b", device="hp", language="en")]
        report = evaluate_asr.build_report({"groq-turbo": rows})
        for expected in ("## Keseluruhan", "## Per language", "## Per device", "groq-turbo / hp", "## Keterbatasan"):
            self.assertIn(expected, report)
        self.assertNotIn("## Per noise", report)  # satu nilai saja: tidak ada perbandingan


class ManifestTest(unittest.TestCase):
    def write(self, directory, rows, files):
        with (directory / "manifest.csv").open("w", encoding="utf-8", newline="") as handle:
            out = csv.DictWriter(handle, fieldnames=["clip_id", "language", "device", "noise", "style", "duration_s", "reference_text", "keyterms"])
            out.writeheader()
            out.writerows(rows)
        for name in files:
            (directory / name).write_bytes(b"x")

    def test_reads_terms_and_finds_the_audio_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            self.write(directory, [dict(clip_id="c1", language="id", device="hp", noise="tenang", style="baca",
                                        duration_s="31.5", reference_text="halo", keyterms="rekursi| pohon biner |")], ["c1.m4a"])
            (row,) = evaluate_asr.read_manifest(directory)
            self.assertEqual(row["keyterms"], ["rekursi", "pohon biner"])
            self.assertEqual(row["duration_s"], 31.5)
            self.assertEqual(row["path"].name, "c1.m4a")

    def test_missing_audio_is_an_error_not_a_silent_skip(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            self.write(directory, [dict(clip_id="c1", language="id", device="hp", noise="tenang", style="baca",
                                        duration_s="1", reference_text="halo", keyterms="")], [])
            with self.assertRaises(SystemExit):
                evaluate_asr.read_manifest(directory)


class CacheKeyTest(unittest.TestCase):
    def test_key_depends_on_model_and_file_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "a.wav"
            path.write_bytes(b"satu")
            turbo = evaluate_asr.cache_key("groq-turbo", path)
            self.assertNotEqual(turbo, evaluate_asr.cache_key("groq-large-v3", path))  # ganti model != hasil lama
            path.write_bytes(b"dua")
            self.assertNotEqual(turbo, evaluate_asr.cache_key("groq-turbo", path))  # ganti rekaman != hasil lama

    def test_scorecache_key_is_stable(self):
        self.assertEqual(ScoreCache.key("a", "b"), ScoreCache.key("a", "b"))


class AdapterTest(unittest.TestCase):
    def test_known_names_build_and_unknown_is_rejected(self):
        self.assertEqual(adapters.build_adapter("groq-turbo").model, "whisper-large-v3-turbo")
        self.assertEqual(adapters.build_adapter("groq-large-v3").model, "whisper-large-v3")
        with self.assertRaises(SystemExit):
            adapters.build_adapter("deepgram")


if __name__ == "__main__":
    unittest.main()
