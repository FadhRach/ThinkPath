"""run_analysis(): satu-satunya pintu masuk analisis.

Skor AI : Winston (via detector_cache) -> heuristik ai_score.py. Groq tidak memberi skor AI.
Bloom   : Groq -> heuristik bloom.py. Detektor hanya MENIMPA field skor AI pada hasil jadi,
          jadi tidak ada jalur kode yang membawa skornya ke Bloom.
"""
from __future__ import annotations

import json
import logging
from dataclasses import replace

import requests

from apps.analysis import detector_cache
from apps.analysis.choices import AnalysisSource, Confidence
from apps.analysis.engines.ai_score import (
    PROCESS_WEIGHT,
    SignalScore,
    build_process_signal,
    text_signal_scores,
)
from apps.analysis.engines.heuristic import (
    analyze_text,
    build_recommendation,
    build_summary,
    overall_confidence,
)
from apps.analysis.engines.process_signals import ProcessContext, assess_process
from apps.analysis.engines.text_features import extract_features
from apps.analysis.injection import injection_markers
from apps.analysis.providers import groq, winston

logger = logging.getLogger(__name__)

VALID_CONFIDENCE = {Confidence.LOW, Confidence.MEDIUM, Confidence.HIGH}

# Selisih level Bloom penilai LLM terhadap penanda teks yang dianggap janggal.
BLOOM_DISAGREE_LEVELS = 3


def _clamp(value: object, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(value)))  # type: ignore[arg-type]


def _blend_with_process(
    text_score: int,
    process: ProcessContext | None,
    *,
    key: str,
    label: str,
    evidence: str,
) -> tuple[int, list[SignalScore]]:
    """Breakdown detektor (bobot 1 - PROCESS_WEIGHT) + baris proses; total tetap merekonstruksi skor."""
    if process is None:
        return text_score, []

    text_signal = SignalScore(
        key=key,
        label=label,
        value=text_score / 100.0,
        weight=round(1.0 - PROCESS_WEIGHT, 4),
        evidence=evidence,
    )
    process_signal = build_process_signal(process)
    breakdown = [text_signal, process_signal]
    blended = sum(signal.value * signal.weight for signal in breakdown)
    return int(round(max(0.0, min(1.0, blended)) * 100)), breakdown


def _parse_llm_result(raw: dict, heuristic: dict, expected_bloom_level: int) -> dict:
    """Tempel level Bloom Groq ke hasil heuristik; skor AI tetap heuristik, summary disusun di kode."""
    bloom_level = _clamp(raw["bloom_level"], 1, 6)

    # bloom_confidence hilang/tidak valid -> low, jangan gagalkan analisis.
    bloom_confidence = str(raw.get("bloom_confidence", "")).lower()
    if bloom_confidence not in VALID_CONFIDENCE:
        bloom_confidence = Confidence.LOW

    raw_signals = raw.get("signals", [])
    if not isinstance(raw_signals, list):
        raise ValueError("signals bukan list")
    signals = [str(signal) for signal in raw_signals if str(signal).strip()][:4]

    return {
        **heuristic,
        "bloom_level": bloom_level,
        "bloom_confidence": bloom_confidence,
        # Dua bukti skor AI di depan agar ringkasan tetap memuat sisi integritas.
        "signals": heuristic["signals"][:2] + signals[:2],
        "summary": build_summary(heuristic["ai_band"], bloom_level, bloom_confidence),
        "recommendation": build_recommendation(
            heuristic["ai_band"], bloom_level, expected_bloom_level
        ),
    }


def _check_bloom_plausibility(result: dict, heuristic_level: int) -> dict:
    """Selisih >= 3 level dari heuristik: tandai (jangan ganti) dan turunkan keyakinan ke low."""
    if abs(result["bloom_level"] - heuristic_level) < BLOOM_DISAGREE_LEVELS:
        return result
    note = (
        f"Level Bloom dari model (L{result['bloom_level']}) berselisih jauh dari "
        f"penanda di teks (L{heuristic_level}); periksa sendiri sebelum dipakai"
    )
    return {
        **result,
        "bloom_confidence": Confidence.LOW,
        "signals": ([note] + result["signals"])[:4],
    }


def _run_base_analysis(
    text: str,
    education_level: str,
    expected_bloom_level: int,
    process: ProcessContext | None,
    *,
    allow_external: bool = True,
) -> dict:
    """Skor AI heuristik, level Bloom dari Groq bila tersedia, ditambah penjagaan terhadap injeksi."""
    heuristic = analyze_text(text, expected_bloom_level, process)
    if not allow_external or not groq.is_configured():
        return heuristic

    # Teks berisi perintah untuk penilai tidak dikirim ke LLM; heuristik tidak bisa diperintah.
    markers = injection_markers(text)
    if markers:
        logger.warning("Teks memuat pola injeksi (%s); Groq dilewati.", ", ".join(markers))
        note = f"Teks memuat kalimat yang ditujukan kepada penilai otomatis ({markers[0]}); penilai LLM tidak dipakai"
        return {**heuristic, "signals": [note] + heuristic["signals"][:3]}

    try:
        raw = groq.call(text, education_level)
        return _check_bloom_plausibility(
            _parse_llm_result(raw, heuristic, expected_bloom_level), heuristic["bloom_level"]
        )
    except (
        requests.RequestException,
        json.JSONDecodeError,
        KeyError,
        ValueError,
        TypeError,
        OverflowError,
    ) as exc:
        logger.warning("Analisis LLM gagal, memakai fallback heuristik: %s", exc)
        return heuristic


def _detector_confidence(word_count: int, reliable: bool) -> str:
    """low bila Winston menyatakan tidak andal, selainnya aturan panjang heuristik (tidak pernah high).

    Uji E1 untuk bahasa Indonesia baru 18 tulisan manusia dan 5 teks AI.
    """
    if not reliable:
        return Confidence.LOW
    return overall_confidence(word_count)


def _detector_evidence(result: winston.DetectorResult, text_score: int) -> str:
    """Bukti untuk panel "Asal Skor AI"; nama penyedia + versi adalah satu-satunya jejak audit per baris."""
    line = (
        f"{winston.PROVIDER_NAME} {winston.MODEL_VERSION} menilai indikasi AI "
        f"pada teks sebesar {text_score} dari 100"
    )
    if not result.reliable:
        line += ", tetapi teksnya terlalu pendek untuk dinilai dengan andal"
    if result.attack_detected:
        line += f". Terdeteksi {' dan '.join(result.attack_kinds)}"
    return line


def _overlay_detector(
    base: dict,
    result: winston.DetectorResult,
    text: str,
    expected_bloom_level: int,
    process: ProcessContext | None,
) -> dict:
    """Timpa field E1 (skor, band, breakdown, confidence, sumber) dan susun ulang summary/rekomendasi.

    signals dipertahankan; bloom_level/bloom_confidence tidak boleh disentuh di sini.
    """
    text_score = int(round(result.ai_probability * 100))
    evidence = _detector_evidence(result, text_score)
    ai_score, breakdown = _blend_with_process(
        text_score,
        process,
        key="external_detector",
        label=f"Detektor {winston.PROVIDER_NAME}",
        evidence=evidence,
    )
    if not breakdown:
        # Tanpa proses, detektor satu-satunya penyumbang; tetap ditulis agar panel "Asal Skor AI" tidak kosong.
        breakdown = [
            SignalScore(
                key="external_detector",
                label=f"Detektor {winston.PROVIDER_NAME}",
                value=result.ai_probability,
                weight=1.0,
                evidence=evidence,
            )
        ]
    band = winston.score_to_band(ai_score)

    # Pengelabuan disengaja ditampilkan sebelum pengamatan gaya bahasa.
    signals = list(base["signals"])
    if result.attack_detected:
        signals = [f"Terdeteksi {kind}" for kind in result.attack_kinds] + signals

    return {
        **base,
        "ai_score": ai_score,
        "ai_band": band,
        "signal_breakdown": [signal.as_dict() for signal in breakdown],
        "signals": signals[:4],
        "confidence": _detector_confidence(len(text.split()), result.reliable),
        "summary": build_summary(
            band, base["bloom_level"], base["bloom_confidence"]
        ),
        "recommendation": build_recommendation(
            band, base["bloom_level"], expected_bloom_level
        ),
        "analysis_source": AnalysisSource.DETECTOR,
    }


def _heuristic_context_rows(text: str) -> list[dict]:
    """S1-S5 berbobot NOL saat skor dari detektor: keduanya membaca teks sama, jangan hitung ganda."""
    features = extract_features(text)
    return [
        replace(signal, weight=0.0).as_dict()
        for signal in text_signal_scores(features)
    ]


def run_analysis(
    text: str,
    education_level: str,
    expected_bloom_level: int,
    process: ProcessContext | None = None,
    *,
    allow_external: bool = True,
) -> dict:
    """Selalu mengembalikan dict lengkap; Winston hanya menimpa skor AI bila benar-benar menjawab.

    allow_external=False (tanpa izin transfer ke luar negeri, Pasal 56 ayat (4) UU PDP): Groq, Winston,
    dan cache detektor dilewati, skor murni heuristik.
    """
    base = _run_base_analysis(
        text,
        education_level,
        expected_bloom_level,
        process,
        allow_external=allow_external,
    )

    # Lewat cache: detektor ditagih per kata, teks yang sama tidak boleh dibayar dua kali.
    result = detector_cache.detect_cached(text) if allow_external else None
    final = (
        base
        if result is None
        else _overlay_detector(base, result, text, expected_bloom_level, process)
    )

    # Hanya jalur detektor yang butuh baris pembanding S1-S5 (heuristik sudah menampilkannya).
    if final["analysis_source"] != AnalysisSource.HEURISTIC:
        final = {
            **final,
            "signal_breakdown": final["signal_breakdown"]
            + _heuristic_context_rows(text),
        }

    # Pola pengerjaan dilaporkan sebagai bukti tersendiri, bukan bagian skor AI.
    assessment = assess_process(process)
    return {
        **final,
        "process_band": assessment.band,
        "process_evidence": assessment.evidence,
    }
