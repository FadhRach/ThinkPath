"""Menyimpan hasil analisis: keadaan terkini plus riwayat yang tidak pernah ditimpa."""
from __future__ import annotations

import hashlib
from dataclasses import asdict

from apps.analysis.engines.process_signals import ProcessContext
from apps.analysis.models import AnalysisResult, AnalysisRun, AnalysisTrigger


def process_context_dict(process: ProcessContext | None) -> dict:
    """Masukan proses dalam bentuk JSON untuk kalibrasi kelak (tanpa teks jawaban)."""
    if process is None:
        return {}
    data = asdict(process)
    data["samples"] = len(data.pop("progress"))
    data["words_per_minute"] = process.words_per_minute
    return data


def record_analysis(
    submission,
    analysis: dict,
    *,
    trigger: str,
    process: ProcessContext | None = None,
    requested_by=None,
) -> AnalysisResult:
    """Tulis hasil terkini (ditimpa) dan satu baris riwayat (selalu baru).

    Dipanggil di dalam transaksi pemanggil bila ada, supaya hasil terkini dan
    riwayatnya tidak pernah berbeda.
    """
    result, _ = AnalysisResult.objects.update_or_create(
        submission=submission, defaults=analysis
    )
    AnalysisRun.objects.create(
        submission=submission,
        trigger=AnalysisTrigger(trigger),
        requested_by=requested_by,
        ai_score=analysis["ai_score"],
        ai_band=analysis["ai_band"],
        bloom_level=analysis["bloom_level"],
        analysis_source=analysis["analysis_source"],
        payload=analysis,
        process_context=process_context_dict(process),
        text_sha256=hashlib.sha256(submission.text_answer.encode("utf-8")).hexdigest(),
    )
    return result
