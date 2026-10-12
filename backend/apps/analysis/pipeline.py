"""Orkestrator analisis: detektor eksternal untuk skor AI, Groq untuk Bloom.

Pemanggil hanya tahu run_analysis(). Klien penyedia ada di providers/
(groq.py, winston.py); mengganti penyedia cukup di sana.

Rantai skor AI ada tiga lapis, dari yang paling dipercaya ke yang paling
dangkal: detektor eksternal (winston.py), lalu ai_probability dari Groq, lalu
heuristik ai_score.py. Level Bloom TIDAK ikut rantai itu. Ia hanya punya dua
lapis, Groq lalu heuristik, dan detektor tidak pernah menyentuhnya sama sekali.

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
    score_to_band,
    text_signal_scores,
)
from apps.analysis.engines.heuristic import (
    analyze_text,
    build_recommendation,
    build_summary,
    overall_confidence,
)
from apps.analysis.engines.process_signals import ProcessContext
from apps.analysis.engines.text_features import extract_features
from apps.analysis.providers import groq, winston

logger = logging.getLogger(__name__)

VALID_CONFIDENCE = {Confidence.LOW, Confidence.MEDIUM, Confidence.HIGH}


def _clamp(value: object, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(value)))  # type: ignore[arg-type]


def _blend_with_process(
    text_score: int,
    process: ProcessContext | None,
    *,
    key: str = "llm_text",
    label: str = "Penilaian teks oleh model",
    evidence: str | None = None,
) -> tuple[int, list[SignalScore]]:
    """Gabungkan satu penilaian berbasis teks dengan sinyal forensik proses.

    Dipakai dua penilai yang berbeda, Groq dan detektor eksternal, dengan aritmetika yang
    persis sama. Keduanya membaca teks dan hanya teks; tidak satu pun pernah
    menerima metadata pengerjaan. Justru karena itu penggabungannya sah: dua
    penilaian yang benar benar berdiri sendiri boleh dijumlahkan berbobot,
    sedangkan dua penilaian yang membaca sumber yang sama akan menghitung ganda
    bukti yang sama.

    Tanpa penggabungan ini, sinyal terkuat yang dimiliki ThinkPath justru tidak
    terpakai di jalur produksi.

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
        evidence=evidence
        or f"Model menilai indikasi AI pada teks sebesar {text_score} dari 100",
    )
    process_signal = build_process_signal(process)
    breakdown = [text_signal, process_signal]
    blended = sum(signal.value * signal.weight for signal in breakdown)
    return int(round(max(0.0, min(1.0, blended)) * 100)), breakdown


def _parse_llm_result(
    raw: dict, expected_bloom_level: int, process: ProcessContext | None
) -> dict:
    llm_score = _clamp(raw["ai_probability"], 0, 100)
    bloom_level = _clamp(raw["bloom_level"], 1, 6)

    confidence = str(raw.get("confidence", "")).lower()
    if confidence not in VALID_CONFIDENCE:
        raise ValueError(f"confidence tidak valid: {confidence}")

    # Model lama mungkin belum mengirim bloom_confidence. Jangan gagalkan
    # seluruh analisis karenanya, cukup turunkan ke low.
    bloom_confidence = str(raw.get("bloom_confidence", "")).lower()
    if bloom_confidence not in VALID_CONFIDENCE:
        bloom_confidence = Confidence.LOW

    raw_signals = raw.get("signals", [])
    if not isinstance(raw_signals, list):
        raise ValueError("signals bukan list")
    signals = [str(signal) for signal in raw_signals if str(signal).strip()][:4]

    summary = str(raw.get("summary", "")).strip()
    if not summary:
        raise ValueError("summary kosong")

    ai_score, breakdown = _blend_with_process(llm_score, process)
    band = score_to_band(ai_score)
    return {
        "ai_score": ai_score,
        "ai_band": band,
        "bloom_level": bloom_level,
        "confidence": confidence,
        "bloom_confidence": bloom_confidence,
        "signals": signals,
        "signal_breakdown": [signal.as_dict() for signal in breakdown],
        "summary": summary,
        "recommendation": build_recommendation(
            band, bloom_level, expected_bloom_level
        ),
        "analysis_source": AnalysisSource.LLM,
    }


def _run_base_analysis(
    text: str,
    education_level: str,
    expected_bloom_level: int,
    process: ProcessContext | None,
    *,
    allow_external: bool = True,
) -> dict:
    """Dua lapis lama, tidak berubah perilakunya: Groq lalu heuristik."""
    if not allow_external or not groq.is_configured():
        return analyze_text(text, expected_bloom_level, process)

    try:
        raw = groq.call(text, education_level)
        return _parse_llm_result(raw, expected_bloom_level, process)
    except (
        requests.RequestException,
        json.JSONDecodeError,
        KeyError,
        ValueError,
        TypeError,
        OverflowError,
    ) as exc:
        logger.warning("Analisis LLM gagal, memakai fallback heuristik: %s", exc)
        return analyze_text(text, expected_bloom_level, process)


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

    Ketiga, dan ini yang paling menentukan, belum ada satu pun pengukuran
    detektor ini terhadap teks berbahasa Indonesia. Menandai skornya "high"
    berarti mengklaim ketepatan yang belum pernah diuji, tepat di sebelah angka
    yang dibaca dosen sebelum memanggil mahasiswa. Naikkan plafon ini hanya
    setelah ai_experiment/src/evaluate_detector.py memberi angka.
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
    kosmetik. Prosa dari Groq menjelaskan angka Groq. Kalau angkanya ditimpa
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
    """Baris pembanding S1-S5 ketika skornya datang dari Groq atau detektor.

    Berbobot NOL dengan sengaja, dan itu bukan pilihan gaya. Penilai eksternal
    dan kelima sinyal ini membaca teks yang sama, sehingga memberi keduanya
    bobot berarti menghitung ganda bukti yang sama. Ambang band 56 juga diukur
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
    # hanya jalur Groq/detektor yang butuh baris pembanding.
    if final["analysis_source"] != AnalysisSource.HEURISTIC:
        final = {
            **final,
            "signal_breakdown": final["signal_breakdown"]
            + _heuristic_context_rows(text),
        }
    return final
