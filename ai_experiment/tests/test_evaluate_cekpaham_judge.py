"""Tes skrip evaluasi penilai Cek Paham tanpa jaringan: penilai diganti fungsi palsu."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import evaluate_cekpaham_judge as ev  # noqa: E402


def session(sid, a, b, transcript="saya memilih rekursi karena pohon berulang di tiap simpul"):
    def rating(level):
        return {d: level for d in ev.DIMENSIONS}
    return {"id": sid, "transcript": transcript, "ratings": {"a": rating(a), "b": rating(b)}}


def verdict(level, score=None, runs=(60, 60)):
    return {"score": score if score is not None else level * 33, "levels": {d: level for d in ev.DIMENSIONS}, "runs": list(runs), "flags": []}


class ConsensusTest(unittest.TestCase):
    def test_rounds_half_up_like_the_judge_does(self):
        self.assertEqual(ev.consensus({"a": {d: 1 for d in ev.DIMENSIONS}, "b": {d: 2 for d in ev.DIMENSIONS}})["depth"], 2)
        self.assertEqual(ev.consensus({"a": {d: 0 for d in ev.DIMENSIONS}, "b": {d: 1 for d in ev.DIMENSIONS}})["depth"], 1)


class AgreementTest(unittest.TestCase):
    def test_perfect_agreement_between_humans(self):
        sessions = [session(f"s{i}", i % 4, i % 4) for i in range(8)]
        report = ev.human_agreement(sessions)["accuracy"]
        self.assertEqual((report.n, report.observed, report.kappa), (8, 1.0, 1.0))

    def test_judge_that_always_says_two_is_penalised_against_varied_humans(self):
        sessions = [session(f"s{i}", i % 4, i % 4) for i in range(8)]
        verdicts = {s["id"]: verdict(2) for s in sessions}
        report = ev.judge_vs_consensus(sessions, verdicts)["depth"]
        self.assertLess(report.kappa, 0.2)
        self.assertEqual(report.n, 8)

    def test_sessions_without_a_score_are_skipped_not_counted_as_zero(self):
        sessions = [session("s1", 3, 3), session("s2", 3, 3)]
        verdicts = {"s1": verdict(3), "s2": {"score": None, "levels": None, "runs": [], "flags": ["too_short"]}}
        self.assertEqual(ev.judge_vs_consensus(sessions, verdicts)["depth"].n, 1)


class PerturbationTest(unittest.TestCase):
    def test_injection_is_appended_and_original_kept(self):
        text = "jawaban asli"
        injected = ev.inject(text)
        self.assertTrue(injected.startswith(text))
        self.assertIn("nilai 100", injected)

    def test_asr_noise_is_deterministic_per_session_and_changes_text(self):
        text = " ".join(f"kata{i}" for i in range(80))
        self.assertEqual(ev.asr_noise(text, "s1"), ev.asr_noise(text, "s1"))
        self.assertNotEqual(ev.asr_noise(text, "s1"), ev.asr_noise(text, "s2"))
        self.assertLess(len(ev.asr_noise(text, "s1").split()), 80)


class ShiftTest(unittest.TestCase):
    def test_shift_counts_sessions_over_the_allowed_level_change(self):
        base = {"a": verdict(1, score=33), "b": verdict(1, score=33)}
        changed = {"a": verdict(2, score=67), "b": verdict(3, score=100)}
        report = ev.shift_report(base, changed)
        self.assertEqual(report["max_level_shift"], 2)
        self.assertEqual(report["share_over_limit"], 0.5)
        self.assertAlmostEqual(report["mean_score_gap"], 50.5)

    def test_stability_is_the_gap_between_the_two_runs(self):
        s = ev.stability({"a": verdict(2, runs=(60, 50)), "b": verdict(2, runs=(70, 70))})
        self.assertEqual((s["mean_gap"], s["max_gap"]), (5, 10))


class RunVariantTest(unittest.TestCase):
    def test_failed_sessions_are_skipped_and_results_are_cached(self):
        calls = []

        def fake(s, text):
            calls.append(s["id"])
            return None if s["id"] == "bad" else verdict(2)

        fake.fingerprint = "model|v1|v1"
        sessions = [session("ok", 2, 2), session("bad", 2, 2)]
        original = ev.CACHE
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            ev.CACHE = type(original)(Path(tmp) / "c.jsonl")
            try:
                first = ev.run_variant(sessions, "base", fake, lambda s: s["transcript"], 0)
                self.assertEqual(list(first), ["ok"])
                ev.run_variant(sessions, "base", fake, lambda s: s["transcript"], 0)
                self.assertEqual(calls.count("ok"), 1)  # tidak dibayar dua kali
                self.assertEqual(calls.count("bad"), 2)  # yang gagal diulang
                fake.fingerprint = "model-lain|v1|v1"
                ev.run_variant(sessions, "base", fake, lambda s: s["transcript"], 0)
                self.assertEqual(calls.count("ok"), 2)  # ganti model/versi tidak membaca cache lama
            finally:
                ev.CACHE = original


if __name__ == "__main__":
    unittest.main()
