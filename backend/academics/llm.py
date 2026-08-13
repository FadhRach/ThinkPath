"""Analisis jawaban mahasiswa via LLM (Groq) dengan fallback heuristik.

Provider sementara: Groq (free tier, OpenAI-compatible). Kalau nanti pindah
ke Anthropic Claude, cukup ganti implementasi _call_llm di modul ini -
pemanggil hanya tahu run_analysis().
"""
from __future__ import annotations

import json
import logging
import os

import requests

from .analysis import analyze_text, build_recommendation
from .ai_score import PROCESS_WEIGHT, SignalScore, build_process_signal, score_to_band
from .models import AnalysisSource, Confidence
from .process_signals import ProcessContext

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"
# Sengaja jauh di bawah timeout gunicorn (60 detik). Kalau keduanya sama,
# gunicorn bisa membunuh worker tepat saat Groq hendak menjawab, dan request
# mahasiswa hilang tanpa jejak. Jalur heuristik sudah ada sebagai cadangan,
# jadi menyerah lebih cepat lebih baik daripada menahan worker lama lama.
REQUEST_TIMEOUT_SECONDS = 12

SYSTEM_PROMPT = """Kamu adalah ThinkPath, sistem analisis integritas akademik untuk pendidikan tinggi Indonesia.

Analisislah teks tugas mahasiswa dan hasilkan output JSON dengan kriteria berikut:

1. ai_probability (0-100): kemungkinan teks ini dibuat menggunakan AI generatif.
   Sinyal yang menunjukkan AI: kalimat sangat terprediksi, panjang kalimat
   seragam tanpa variasi, klaim yang selalu seimbang tanpa pendirian, tidak ada
   contoh konkret dari mata kuliah atau praktikum yang sedang dijalani, tidak
   ada rujukan spesifik ke bacaan tertentu, dan tidak ada keraguan atau
   kualifikasi yang wajar muncul saat seseorang benar benar memikirkan sesuatu.

2. bloom_level (1-6): level kognitif Bloom's Taxonomy yang DITUNJUKKAN teks.
   L1 Mengingat, L2 Memahami, L3 Mengaplikasikan, L4 Menganalisis,
   L5 Mengevaluasi, L6 Mencipta.
   Nilai ini harus ditentukan HANYA dari isi jawaban. Jangan dipengaruhi oleh
   ai_probability yang kamu tentukan di poin 1. Jawaban yang kuat secara
   kognitif tetap L5 walaupun kamu menduga dibuat AI, dan jawaban yang lemah
   tetap L1 walaupun kamu yakin ditulis sendiri oleh mahasiswa.
   Level tinggi menuntut bukti dalam teks: L4 butuh penalaran sebab akibat atau
   pembandingan, L5 butuh penilaian yang disertai alasan, L6 butuh usulan atau
   rancangan baru. Tanpa bukti itu, jangan naikkan levelnya.

3. confidence: seberapa yakin kamu dengan skor ai_probability.
   "low" jika teks terlalu pendek atau ambigu.
   "medium" jika ada sinyal tapi tidak kuat.
   "high" jika sinyal jelas dan konsisten.

4. bloom_confidence: seberapa yakin kamu dengan bloom_level, memakai skala yang
   sama. Ini dinilai terpisah dari confidence di poin 3, karena satu teks bisa
   jelas di satu dimensi dan ambigu di dimensi lain.

5. signals: maksimal 4 string pendek, bahasa Indonesia, mendeskripsikan sinyal
   konkret yang ditemukan. Contoh: "panjang kalimat seragam tanpa variasi",
   "tidak ada contoh dari pengalaman pribadi".

6. summary: 1-2 kalimat bahasa Indonesia yang menjelaskan kesimpulan analisis.

PERINGATAN PALING PENTING, BACA DUA KALI.

Mahasiswa memang menulis dengan ragam baku dan akademik. Itu yang diajarkan
kepada mereka. Frasa seperti "dengan demikian", "hal ini menunjukkan bahwa",
"berbagai faktor", dan "secara signifikan" adalah bahasa Indonesia akademik yang
benar, BUKAN jejak AI. JANGAN menaikkan ai_probability hanya karena tulisannya
rapi, formal, tanpa salah ketik, atau memakai istilah teknis.

Deteksi teks AI diketahui menandai penulis non-native jauh lebih sering
daripada penulis native, dan tulisan akademik yang baik justru paling mirip
keluaran model. Kalau ragu, beri skor lebih rendah. Menuduh mahasiswa jujur
jauh lebih merugikan daripada melewatkan satu kasus.

Sesuaikan sedikit dengan jenjang studi:
- D3 dan S1: tulisan yang masih berkembang itu normal.
- S2 dan S3: ragam akademik matang itu yang diharapkan, bukan mencurigakan.

Mahasiswa Indonesia sering mencampur bahasa Indonesia dan Inggris, itu wajar.

Respond HANYA dalam JSON valid dengan keys: ai_probability, bloom_level,
confidence, bloom_confidence, signals, summary. Tidak ada teks lain di luar JSON."""

VALID_CONFIDENCE = {Confidence.LOW, Confidence.MEDIUM, Confidence.HIGH}


def _build_user_message(text: str, education_level: str) -> str:
    """Konteks yang dikirim ke model.

    Target Bloom dosen sengaja TIDAK dikirim. Menyebutkan target di prompt
    membuat model ter-anchor dan cenderung menjawab di sekitar angka itu,
    sehingga hasilnya memantulkan harapan dosen alih alih mengukur jawaban.
    Perbandingan terhadap target dilakukan di sisi backend setelah model
    memberi taksiran secara mandiri.
    """
    return (
        f"Jenjang studi: {education_level}\n\n"
        f"Teks jawaban mahasiswa:\n{text}"
    )


def _call_groq(text: str, education_level: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    response = requests.post(
        GROQ_API_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": os.getenv("GROQ_MODEL", DEFAULT_MODEL),
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_user_message(text, education_level),
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def _clamp(value: object, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(value)))  # type: ignore[arg-type]


def _blend_with_process(
    llm_score: int, process: ProcessContext | None
) -> tuple[int, list[SignalScore]]:
    """Gabungkan penilaian teks oleh model dengan sinyal forensik proses.

    Model tidak pernah menerima metadata pengerjaan, jadi kedua penilaian ini
    benar benar berdiri sendiri dan layak digabung. Tanpa penggabungan ini,
    sinyal terkuat yang dimiliki ThinkPath justru tidak terpakai di jalur
    produksi.

    Rincian yang dikembalikan tetap merekonstruksi skor akhir, sehingga panel
    "Asal Skor AI" di layar dosen tidak berbohong.
    """
    if process is None:
        return llm_score, []

    text_signal = SignalScore(
        key="llm_text",
        label="Penilaian teks oleh model",
        value=llm_score / 100.0,
        weight=round(1.0 - PROCESS_WEIGHT, 4),
        evidence=f"Model menilai indikasi AI pada teks sebesar {llm_score} dari 100",
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


def run_analysis(
    text: str,
    education_level: str,
    expected_bloom_level: int,
    process: ProcessContext | None = None,
) -> dict:
    """Entry point tunggal analisis. Selalu mengembalikan dict lengkap."""
    if not os.getenv("GROQ_API_KEY", "").strip():
        return analyze_text(text, expected_bloom_level, process)

    try:
        raw = _call_groq(text, education_level)
        return _parse_llm_result(raw, expected_bloom_level, process)
    except (requests.RequestException, json.JSONDecodeError, KeyError, ValueError, TypeError) as exc:
        logger.warning("Analisis LLM gagal, memakai fallback heuristik: %s", exc)
        return analyze_text(text, expected_bloom_level, process)
