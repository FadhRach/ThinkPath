"""Orkestrator analisis: detektor eksternal untuk skor AI, Groq untuk Bloom.

Pemanggil hanya tahu run_analysis(). Klien penyedia ada di providers/
(groq.py, winston.py); mengganti penyedia cukup di sana.

Rantai skor AI ada dua lapis, diurutkan menurut salah tuduh terendah pada uji E1
(ai_experiment notebook 12): detektor eksternal (winston.py), lalu heuristik
ai_score.py. Groq tidak lagi memberi skor AI karena hasilnya hampir setara
tebakan (AUC 0,60, salah tuduh 60%); tokennya dipakai untuk Bloom dan Cek Paham.
Level Bloom TIDAK ikut rantai itu. Ia punya dua lapis, Groq lalu heuristik, dan
detektor tidak pernah menyentuhnya sama sekali.

Detektor dipasang sebagai lapisan penimpa di atas hasil yang sudah jadi, bukan
sebagai cabang di tengah alur. Bentuk itu dipilih supaya taksiran Bloom mustahil
tercemar secara struktural: tidak ada jalur kode yang bisa membawa skor detektor
ke sana, jadi dekoplingnya tidak bergantung pada kedisiplinan siapa pun.

Detektor dipanggil lewat detector_cache, bukan langsung. Penyedianya menagih per
kata, dan seluruh jalur analisis - pengumpulan, revisi, dan Analisis Ulang -
bertemu di run_analysis(), sehingga satu titik itu cukup untuk memastikan teks
yang sama tidak pernah dibayar dua kali.
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
    """Gabungkan skor detektor eksternal dengan sinyal forensik proses.

    Detektor membaca teks dan hanya teks; ia tidak pernah menerima metadata
    pengerjaan. Justru karena itu penggabungannya sah: dua penilaian yang benar
    benar berdiri sendiri boleh dijumlahkan berbobot, sedangkan dua penilaian
    yang membaca sumber yang sama akan menghitung ganda bukti yang sama.

    Rincian yang dikembalikan tetap merekonstruksi skor akhir, sehingga panel
    "Asal Skor AI" di layar dosen tidak berbohong.
    """
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
    """Tempelkan level Bloom dari Groq ke hasil heuristik; skor AI tetap milik heuristik.

    summary disusun di kode, bukan diambil dari Groq: prosa bebas model bisa
    disetir teks mahasiswa, dan ia tampil tepat di sebelah skor AI.
    """
    bloom_level = _clamp(raw["bloom_level"], 1, 6)

    # Model lama mungkin belum mengirim bloom_confidence. Jangan gagalkan
    # seluruh analisis karenanya, cukup turunkan ke low.
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
        # Dua bukti skor AI heuristik di depan supaya ringkasan sinyal tetap memuat sisi integritas.
        "signals": heuristic["signals"][:2] + signals[:2],
        "summary": build_summary(heuristic["ai_band"], bloom_level, bloom_confidence),
        "recommendation": build_recommendation(
            heuristic["ai_band"], bloom_level, expected_bloom_level
        ),
    }


def _check_bloom_plausibility(result: dict, heuristic_level: int) -> dict:
    """Tandai (jangan ganti) level Bloom LLM yang jauh dari penanda teks.

    Bloom hanya punya satu penilai di jalur ini. Selisih besar bisa berarti
    model yang cerdas menangkap yang tidak tertangkap kata kunci, atau model
    yang dibelokkan; dosen tidak boleh dibiarkan percaya diam-diam.
    """
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

    # Teks yang berisi perintah untuk penilai tidak dititipkan ke LLM sama
    # sekali. Heuristik tidak bisa diperintah, dan dosen diberi tahu.
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
    """Keyakinan terhadap skor AI ketika skornya datang dari detektor eksternal.

    Detektor tidak mengembalikan keyakinan sama sekali, jadi angkanya harus
    disusun di sini. Tiga alasan menahannya tetap rendah:

    Pertama, teks pendek memberi bahan sedikit bagi detektor mana pun, jadi
    aturan panjangnya dipinjam apa adanya dari jalur heuristik supaya kedua
    jalur tidak menjawab berbeda untuk alasan yang sama.

    Kedua, penyedia sendiri menyatakan hasilnya belum andal di bawah panjang
    tertentu. Kalau ia sendiri tidak percaya, kita tidak boleh lebih percaya
    daripada dia.

    Ketiga, dan ini yang paling menentukan, pengukurannya pada teks berbahasa
    Indonesia baru sedikit: uji E1 (notebook 12) hanya 18 tulisan manusia dan 5
    teks AI. Menandai skornya "high" berarti mengklaim ketepatan yang belum
    teruji cukup, tepat di sebelah angka yang dibaca dosen sebelum memanggil
    mahasiswa. Naikkan plafon ini hanya setelah sampelnya memadai.
    """
    if not reliable:
        return Confidence.LOW
    return overall_confidence(word_count)


def _detector_evidence(result: winston.DetectorResult, text_score: int) -> str:
    """Kalimat bukti untuk panel "Asal Skor AI".

    Nama penyedia dan versi modelnya ikut ditulis, dan itu bukan hiasan: inilah
    satu satunya jejak audit yang tersimpan per baris. analysis_source hanya
    mencatat "detector", jadi tanpa kalimat ini tidak ada cara tahu skor lama
    dihasilkan penyedia yang mana.
    """
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
    """Timpa separuh skor AI pada hasil yang sudah jadi, sisanya dibiarkan.

    Yang diganti hanya yang memang milik E1: angka skornya, bandnya, rincian
    sinyalnya, keyakinan terhadap angka itu, dan penanda asalnya.

    summary dan recommendation ikut disusun ulang, dan itu bukan kerapian
    kosmetik. Prosa jalur dasar menjelaskan band heuristik. Kalau angkanya ditimpa
    sementara prosanya dibiarkan, layar dosen akan memuat kalimat yang
    membantah angka di sebelahnya, dan dosen yang membaca keduanya tidak punya
    cara tahu mana yang benar. Alasan yang sama berlaku untuk confidence:
    keyakinan yang diwarisi menerangkan skor yang sudah tidak ada lagi.

    signals justru dipertahankan apa adanya. Isinya pengamatan konkret tentang
    teks, misalnya "panjang kalimat seragam tanpa variasi". Pengamatan itu tetap
    sahih terlepas dari siapa yang memberi angka pada teks yang sama.

    bloom_level dan bloom_confidence tidak disebut sama sekali di sini, dan
    memang tidak boleh disebut.
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
        # Tanpa metadata proses, detektor adalah satu satunya penyumbang skor.
        # Rinciannya tetap ditulis, berbobot penuh, supaya panel "Asal Skor AI"
        # tidak pernah kosong sementara cincin di sebelahnya berangka. Layar
        # yang menunjukkan angka tanpa alasannya persis yang produk ini tolak.
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

    # Pengelabuan yang disengaja layak dibaca dosen lebih dulu daripada
    # pengamatan gaya bahasa. Tidak ada mahasiswa yang tanpa sengaja
    # menempelkan karakter lebar nol ke dalam esainya.
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
    """Baris pembanding S1-S5 ketika skornya datang dari detektor.

    Berbobot NOL dengan sengaja, dan itu bukan pilihan gaya. Penilai eksternal
    dan kelima sinyal ini membaca teks yang sama, sehingga memberi keduanya
    bobot berarti menghitung ganda bukti yang sama. Ambang band 42 juga diukur
    untuk ensemble heuristik murni; mencampur bobot membatalkan pengukurannya.

    Dosen tetap bisa membedah gaya teksnya, dan jumlah kontribusi panel "Asal
    Skor AI" tetap merekonstruksi skor akhir karena baris ini menyumbang 0.
    """
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
    """Entry point tunggal analisis. Selalu mengembalikan dict lengkap.

    Jalur dasar dijalankan lebih dulu dan tanpa syarat, karena level Bloom
    hanya bisa datang dari sana. Detektor eksternal menyusul dan hanya menimpa
    skor AI bila ia benar benar menjawab.

    allow_external=False berarti mahasiswa tidak mengizinkan jawabannya
    dikirim ke penyedia di luar negeri (Pasal 56 ayat (4) UU PDP). Groq dan
    detektor dilewati seluruhnya, termasuk cache detektor, sehingga skornya
    murni heuristik di server ThinkPath dan panel "Asal Skor AI" menyebutnya.
    """
    base = _run_base_analysis(
        text,
        education_level,
        expected_bloom_level,
        process,
        allow_external=allow_external,
    )

    # Lewat cache, bukan lewat winston.detect() langsung. Seluruh pemanggil
    # analisis masuk lewat fungsi ini, termasuk tombol Analisis Ulang milik
    # dosen, sehingga satu tempat ini cukup untuk memastikan teks yang sama
    # tidak pernah dibayar dua kali.
    result = detector_cache.detect_cached(text) if allow_external else None
    final = (
        base
        if result is None
        else _overlay_detector(base, result, text, expected_bloom_level, process)
    )

    # Jalur heuristik sudah menampilkan kelima sinyal sebagai penyumbang skor;
    # hanya jalur detektor yang butuh baris pembanding.
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
