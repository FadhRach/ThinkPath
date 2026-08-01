"""Analisis fallback berbasis heuristik teks.

Dipakai ketika GROQ_API_KEY kosong atau panggilan LLM gagal (lihat llm.py).
Skor dihitung dari sinyal sederhana: variasi panjang kalimat (burstiness),
frasa khas LLM, dan penanda personal. Cukup untuk menjaga flow tetap hidup,
bukan deteksi yang akurat.
"""
from __future__ import annotations

import re

from .models import AiBand, Confidence

LLM_PHRASES = (
    "perlu dicatat",
    "dalam era",
    "sangat penting untuk",
    "secara fundamental",
    "secara holistik",
    "terintegrasi",
    "dapat dikonseptualisasikan",
    "korelasi signifikan",
    "secara simultan",
    "kesimpulannya",
)

PERSONAL_MARKERS = ("saya", "aku", "menurutku", "pengalaman", "saat itu")


def _split_sentences(text: str) -> list[str]:
    sentences = re.split(r"[.!?]+", text)
    return [sentence.strip() for sentence in sentences if sentence.strip()]


def _burstiness(sentences: list[str]) -> float:
    """Rasio deviasi panjang kalimat terhadap rata-rata; rendah = seragam."""
    if len(sentences) < 2:
        return 0.0
    lengths = [len(sentence.split()) for sentence in sentences]
    mean = sum(lengths) / len(lengths)
    if mean == 0:
        return 0.0
    variance = sum((length - mean) ** 2 for length in lengths) / len(lengths)
    return round(min(1.0, (variance ** 0.5) / mean), 2)


def _count_matches(text_lower: str, phrases: tuple[str, ...]) -> int:
    return sum(1 for phrase in phrases if phrase in text_lower)


def score_to_band(ai_score: int) -> str:
    if ai_score < 35:
        return AiBand.LOW
    if ai_score < 70:
        return AiBand.MID
    return AiBand.HIGH


def band_to_bloom(band: str, expected: int) -> int:
    if band == AiBand.LOW:
        return min(6, expected)
    if band == AiBand.MID:
        return max(1, expected - 1)
    return max(1, expected - 2)


def band_to_recommendation(band: str) -> str:
    if band == AiBand.LOW:
        return "Tidak ada indikasi yang perlu ditindaklanjuti. Lanjutkan penilaian seperti biasa."
    if band == AiBand.MID:
        return "Beberapa sinyal bercampur. Disarankan tanya jawab singkat 5-10 menit untuk verifikasi."
    return "Disarankan diskusi 10-15 menit dengan siswa untuk memverifikasi pemahaman."


def _band_to_summary(band: str) -> str:
    if band == AiBand.LOW:
        return "Tulisan menunjukkan pola yang wajar untuk siswa. Tidak ditemukan indikasi kuat penggunaan AI generatif."
    if band == AiBand.MID:
        return "Ada beberapa sinyal yang bercampur antara tulisan siswa dan pola khas AI. Perlu ditinjau bersama konteks proses pengerjaan."
    return "Tulisan memuat beberapa pola kuat yang khas AI generatif. Disarankan verifikasi langsung dengan siswa."


def _build_signals(
    llm_phrase_count: int,
    personal_count: int,
    burstiness: float,
    sentence_count: int,
) -> list[str]:
    signals: list[str] = []
    if llm_phrase_count > 0:
        signals.append(f"Ditemukan {llm_phrase_count} frasa khas AI generatif")
    if sentence_count >= 3 and burstiness < 0.3:
        signals.append("Panjang kalimat seragam tanpa variasi")
    if personal_count == 0:
        signals.append("Tidak ada penanda pengalaman atau sudut pandang pribadi")
    else:
        signals.append("Ada penanda sudut pandang pribadi dalam tulisan")
    if sentence_count < 3:
        signals.append("Teks terlalu pendek untuk dianalisis mendalam")
    return signals[:4]


def analyze_text(text: str, expected_bloom_level: int) -> dict:
    """Hitung hasil analisis fallback untuk satu jawaban siswa.

    Mengembalikan dict dengan shape yang sama seperti hasil LLM sehingga
    langsung bisa dipakai sebagai kwargs AnalysisResult.
    """
    text_lower = text.lower()
    sentences = _split_sentences(text)
    burstiness = _burstiness(sentences)
    llm_phrase_count = _count_matches(text_lower, LLM_PHRASES)
    personal_count = _count_matches(text_lower, PERSONAL_MARKERS)

    score = 50
    score += llm_phrase_count * 12
    score -= personal_count * 10
    score -= int(burstiness * 40)
    ai_score = max(2, min(95, score))

    band = score_to_band(ai_score)
    word_count = len(text.split())
    # Heuristik tidak pernah "high": sinyalnya terlalu dangkal untuk yakin.
    confidence = Confidence.LOW if word_count < 80 else Confidence.MEDIUM

    return {
        "ai_score": ai_score,
        "ai_band": band,
        "bloom_level": band_to_bloom(band, expected_bloom_level),
        "confidence": confidence,
        "signals": _build_signals(
            llm_phrase_count, personal_count, burstiness, len(sentences)
        ),
        "summary": _band_to_summary(band),
        "recommendation": band_to_recommendation(band),
    }
